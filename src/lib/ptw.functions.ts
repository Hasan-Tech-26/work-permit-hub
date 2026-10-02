import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PermitTypeRow } from "@/lib/ptw";

const permitTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  accent: z.string(),
  field_schema: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(["text", "number", "boolean"]),
    }),
  ),
});

function publicClient(): SupabaseClient {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PERMIT_SELECT = `
  id, permit_number, status, contractor_company, work_team, work_description,
  equipment, planned_start, planned_end, hazards, ppe, precautions, type_data,
  permit_type:permit_types ( code, name, accent, field_schema ),
  plant:plants ( name, code ),
  area:areas ( name, code ),
  requester:profiles!permits_requester_id_fkey ( full_name, job_title )
`;

type AuthContext = { supabase: SupabaseClient; userId: string };
const authContext = (context: unknown): AuthContext => {
  const candidate =
    context && typeof context === "object" && "supabase" in context
      ? context
      : context && typeof context === "object" && "context" in context
        ? (context as { context?: unknown }).context
        : undefined;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("supabase" in candidate) ||
    !("userId" in candidate) ||
    !candidate.supabase ||
    typeof candidate.userId !== "string"
  ) {
    throw new Error("Unauthorized: Supabase authentication context is unavailable.");
  }

  return candidate as AuthContext;
};

async function profileForUser(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name")
    .or(`user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Authenticated user has no PTW profile.");
  return data as { id: string; full_name: string };
}

async function audit(
  sb: SupabaseClient,
  permitId: string,
  actorId: string,
  action: string,
  values: Record<string, unknown> = {},
) {
  const { error } = await sb
    .from("permit_audit_log")
    .insert({ permit_id: permitId, actor_id: actorId, action, ...values });
  if (error) throw new Error(error.message);
}

async function transition(
  sb: SupabaseClient,
  userId: string,
  permitId: string,
  toStatus: string,
  note: string,
) {
  const actor = await profileForUser(sb, userId);
  const { data: permit, error: readError } = await sb
    .from("permits")
    .select("id, status")
    .eq("id", permitId)
    .single();
  if (readError || !permit) throw new Error("Permit not found.");
  const { data: updated, error } = await sb
    .from("permits")
    .update({ status: toStatus })
    .eq("id", permitId)
    .eq("status", permit.status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Unable to change permit status: ${error.message}`);
  if (!updated)
    throw new Error("Permit status changed before this action completed. Refresh and try again.");
  const { error: historyError } = await sb.from("permit_status_history").insert({
    permit_id: permitId,
    from_status: permit.status,
    to_status: toStatus,
    changed_by: actor.id,
    note,
  });
  if (historyError) throw new Error(historyError.message);
  await audit(sb, permitId, actor.id, "STATUS_CHANGED", {
    from_status: permit.status,
    to_status: toStatus,
    comment: note,
  });
  return { status: toStatus };
}

async function loadPermit(sb: SupabaseClient, permitId: string) {
  const { data, error } = await sb
    .from("permits")
    .select("id, status, requester_id, area_id, planned_start, planned_end")
    .eq("id", permitId)
    .single();
  if (error || !data) throw new Error("Permit not found.");
  return data as {
    id: string;
    status: string;
    requester_id: string | null;
    area_id: string | null;
    planned_start: string;
    planned_end: string;
  };
}

async function rolesFor(sb: SupabaseClient, profileId: string) {
  const { data, error } = await sb.from("user_roles").select("role").eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.role as string));
}

async function requireRole(sb: SupabaseClient, userId: string, allowed: string[]) {
  const profile = await profileForUser(sb, userId);
  const roles = await rolesFor(sb, profile.id);
  if (!allowed.some((role) => roles.has(role)))
    throw new Error(`Permission denied. Required role: ${allowed.join(" or ")}.`);
  return { profile, roles };
}

async function expireIfNeeded(sb: SupabaseClient, permit: Awaited<ReturnType<typeof loadPermit>>) {
  if (
    [
      "DRAFT",
      "PENDING_APPROVAL",
      "REJECTED",
      "CANCELLED",
      "CLOSED",
      "CLOSED_VERIFIED",
      "EXPIRED",
    ].includes(permit.status)
  )
    return permit;
  if (new Date(permit.planned_end).getTime() <= Date.now()) {
    throw new Error("Permit validity has ended. It cannot be activated or resumed.");
  }
  return permit;
}

export const listPermits = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("permits")
    .select(PERMIT_SELECT)
    .order("planned_start", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listPermitTypes = createServerFn({ method: "GET" }).handler(
  async (): Promise<PermitTypeRow[]> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("permit_types")
      .select("id, code, name, description, accent, field_schema")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return z.array(permitTypeSchema).parse(data ?? []);
  },
);

export const listPlantAreas = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("plants")
    .select("id, code, name, areas(id, code, name, plant_id)")
    .order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("permit_status_history")
    .select(
      `id, from_status, to_status, note, created_at,
       permit:permits ( permit_number, area:areas ( name ) ),
       changed_by:profiles ( full_name )`,
    )
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPermit = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ number: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: permit, error } = await sb
      .from("permits")
      .select(PERMIT_SELECT)
      .eq("permit_number", data.number)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!permit) return null;
    const { data: expiryStatus } = await sb.rpc("expire_permit_if_needed", {
      _permit_id: permit.id,
    });
    if (expiryStatus === "EXPIRED") (permit as { status: string }).status = "EXPIRED";

    const { data: approvals, error: aErr } = await sb
      .from("permit_approvals")
      .select(
        `id, step_order, required_role, decision, comment, decided_at,
         approver:profiles ( full_name )`,
      )
      .eq("permit_id", (permit as { id: string }).id)
      .order("step_order");
    if (aErr) throw new Error(aErr.message);

    const [
      { data: history, error: hErr },
      { data: logs, error: lErr },
      { data: auditLog, error: auditErr },
    ] = await Promise.all([
      sb
        .from("permit_status_history")
        .select("id, from_status, to_status, note, created_at, changed_by:profiles(full_name)")
        .eq("permit_id", permit.id)
        .order("created_at", { ascending: false }),
      sb
        .from("permit_work_logs")
        .select("id, notes, logged_at, logged_by:profiles(full_name)")
        .eq("permit_id", permit.id)
        .order("logged_at", { ascending: false }),
      sb
        .from("permit_audit_log")
        .select(
          "id, action, from_status, to_status, comment, field_changes, created_at, actor:profiles(full_name)",
        )
        .eq("permit_id", permit.id)
        .order("created_at", { ascending: false }),
    ]);
    if (hErr || lErr || auditErr)
      throw new Error(hErr?.message ?? lErr?.message ?? auditErr?.message);
    return {
      permit,
      approvals: approvals ?? [],
      history: history ?? [],
      logs: logs ?? [],
      audit: auditLog ?? [],
    };
  });

export const createPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        permitTypeId: z.string().uuid(),
        contractorCompany: z.string().trim().min(1),
        workTeam: z.string().trim().min(1),
        workDescription: z.string().trim().min(1),
        plantId: z.string().uuid(),
        areaId: z.string().uuid(),
        equipment: z.string().trim().min(1),
        plannedStart: z.string().datetime(),
        plannedEnd: z.string().datetime(),
        hazards: z.array(z.string()).default([]),
        ppe: z.array(z.string()).default([]),
        precautions: z.array(z.string()).default([]),
        typeData: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const requester = await profileForUser(sb, userId);
    if (new Date(data.plannedEnd) <= new Date(data.plannedStart))
      throw new Error("Planned end must be after planned start.");

    const [{ data: permitType, error: typeError }, { data: area, error: areaError }] =
      await Promise.all([
        sb
          .from("permit_types")
          .select("id")
          .eq("id", data.permitTypeId)
          .eq("is_active", true)
          .maybeSingle(),
        sb.from("areas").select("id, plant_id").eq("id", data.areaId).maybeSingle(),
      ]);
    if (typeError) throw new Error(typeError.message);
    if (areaError) throw new Error(areaError.message);
    if (!permitType) throw new Error("The selected permit type is unavailable.");
    if (!area || area.plant_id !== data.plantId)
      throw new Error("The selected area does not belong to the selected plant.");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const permitNumber = `PTW-${new Date().getFullYear()}-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.floor(
        Math.random() * 36,
      )
        .toString(36)
        .toUpperCase()}`;
      const { data: permit, error } = await sb
        .from("permits")
        .insert({
          permit_number: permitNumber,
          permit_type_id: data.permitTypeId,
          requester_id: requester.id,
          contractor_company: data.contractorCompany,
          work_team: data.workTeam,
          work_description: data.workDescription,
          plant_id: data.plantId,
          area_id: data.areaId,
          equipment: data.equipment,
          planned_start: data.plannedStart,
          planned_end: data.plannedEnd,
          hazards: data.hazards,
          ppe: data.ppe,
          precautions: data.precautions,
          type_data: data.typeData,
          status: "DRAFT",
        })
        .select("id, permit_number")
        .maybeSingle();

      if (!error && permit) {
        await audit(sb, permit.id, requester.id, "CREATED");
        return permit;
      }
      if (!error || error.code !== "23505")
        throw new Error(`Unable to create permit: ${error?.message ?? "No permit was returned."}`);
    }
    throw new Error("Unable to generate a unique permit number. Please try again.");
  });

export const submitPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const { profile } = await requireRole(sb, userId, ["requester", "admin"]);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.requester_id !== profile.id && !(await rolesFor(sb, profile.id)).has("admin"))
      throw new Error("Only the requester can submit this permit.");
    if (permit.status !== "DRAFT") throw new Error(`Cannot submit a ${permit.status} permit.`);
    if (!permit.area_id) throw new Error("An area is required before submission.");
    if (new Date(permit.planned_end) <= new Date(permit.planned_start))
      throw new Error("Planned end must be after planned start.");
    const { error: deleteError } = await sb
      .from("permit_approvals")
      .delete()
      .eq("permit_id", data.permitId);
    if (deleteError) throw new Error(deleteError.message);
    const steps = [
      { step_order: 1, required_role: "area_owner" },
      { step_order: 2, required_role: "safety_officer" },
      { step_order: 3, required_role: "admin" },
    ];
    const { error: approvalError } = await sb
      .from("permit_approvals")
      .insert(steps.map((step) => ({ permit_id: data.permitId, ...step })));
    if (approvalError) throw new Error(approvalError.message);
    return transition(
      sb,
      userId,
      data.permitId,
      "PENDING_APPROVAL",
      data.comment ?? "Submitted for approval.",
    );
  });

export const approvePermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        permitId: z.string().uuid(),
        approvalId: z.string().uuid(),
        comment: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const { profile, roles } = await requireRole(sb, userId, [
      "area_owner",
      "safety_officer",
      "admin",
    ]);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.status !== "PENDING_APPROVAL")
      throw new Error("Only pending permits can be approved.");
    if (permit.requester_id === profile.id)
      throw new Error("A requester cannot approve their own permit.");
    const { data: step, error: stepError } = await sb
      .from("permit_approvals")
      .select("id, step_order, required_role, decision")
      .eq("id", data.approvalId)
      .eq("permit_id", data.permitId)
      .single();
    if (stepError || !step) throw new Error("Approval step not found.");
    if (step.decision !== "PENDING")
      throw new Error("This approval step has already been decided.");
    if (!roles.has(step.required_role))
      throw new Error(`Only a ${step.required_role} can approve this step.`);
    const { data: earlierSteps, error: earlierError } = await sb
      .from("permit_approvals")
      .select("decision")
      .eq("permit_id", data.permitId)
      .lt("step_order", step.step_order);
    if (earlierError) throw new Error(earlierError.message);
    if (earlierSteps?.some((approval) => approval.decision !== "APPROVED"))
      throw new Error("Earlier approval steps must be approved first.");
    if (step.required_role === "area_owner") {
      const { data: area } = await sb
        .from("areas")
        .select("area_owner_id")
        .eq("id", permit.area_id)
        .single();
      if (area?.area_owner_id !== profile.id && !roles.has("admin"))
        throw new Error("Area Owners may only approve permits in their own area.");
    }
    const { error } = await sb
      .from("permit_approvals")
      .update({
        decision: "APPROVED",
        approver_id: profile.id,
        decided_at: new Date().toISOString(),
        comment: data.comment,
      })
      .eq("id", data.approvalId)
      .eq("decision", "PENDING");
    if (error) throw new Error(error.message);
    await audit(sb, data.permitId, profile.id, "APPROVAL_APPROVED", { comment: data.comment });
    const { data: remaining } = await sb
      .from("permit_approvals")
      .select("decision")
      .eq("permit_id", data.permitId)
      .eq("decision", "PENDING");
    if (!remaining?.length)
      return transition(sb, userId, data.permitId, "APPROVED", "All required approvals recorded.");
    return { status: "PENDING_APPROVAL" };
  });

export const rejectPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        permitId: z.string().uuid(),
        approvalId: z.string().uuid(),
        comment: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const { profile, roles } = await requireRole(sb, userId, [
      "area_owner",
      "safety_officer",
      "admin",
    ]);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.status !== "PENDING_APPROVAL")
      throw new Error("Only pending permits can be rejected.");
    if (permit.requester_id === profile.id)
      throw new Error("A requester cannot reject their own permit.");
    const { data: step, error: stepError } = await sb
      .from("permit_approvals")
      .select("id, step_order, required_role, decision")
      .eq("id", data.approvalId)
      .eq("permit_id", data.permitId)
      .single();
    if (stepError || !step || step.decision !== "PENDING" || !roles.has(step.required_role))
      throw new Error("You cannot decide this approval step.");
    const { data: earlierSteps, error: earlierError } = await sb
      .from("permit_approvals")
      .select("decision")
      .eq("permit_id", data.permitId)
      .lt("step_order", step.step_order);
    if (earlierError) throw new Error(earlierError.message);
    if (earlierSteps?.some((approval) => approval.decision !== "APPROVED"))
      throw new Error("Earlier approval steps must be approved first.");
    if (step.required_role === "area_owner") {
      const { data: area } = await sb
        .from("areas")
        .select("area_owner_id")
        .eq("id", permit.area_id)
        .single();
      if (area?.area_owner_id !== profile.id && !roles.has("admin"))
        throw new Error("Area Owners may only reject permits in their own area.");
    }
    const { error } = await sb
      .from("permit_approvals")
      .update({
        decision: "REJECTED",
        approver_id: profile.id,
        decided_at: new Date().toISOString(),
        comment: data.comment,
      })
      .eq("id", data.approvalId);
    if (error) throw new Error(error.message);
    return transition(sb, userId, data.permitId, "REJECTED", data.comment);
  });

export const activatePermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    await requireRole(sb, userId, ["safety_officer", "admin"]);
    const permit = await expireIfNeeded(sb, await loadPermit(sb, data.permitId));
    if (permit.status !== "APPROVED") throw new Error("Only approved permits can be activated.");
    const now = Date.now();
    if (now < new Date(permit.planned_start).getTime())
      throw new Error("Permit cannot become active before planned start.");
    const { data: pending } = await sb
      .from("permit_approvals")
      .select("id")
      .eq("permit_id", data.permitId)
      .neq("decision", "APPROVED");
    if (pending?.length)
      throw new Error("All required approvals must be approved before activation.");
    return transition(sb, userId, data.permitId, "ACTIVE", data.comment ?? "Work activated.");
  });

export const suspendPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    await requireRole(sb, userId, ["safety_officer", "admin"]);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.status !== "ACTIVE") throw new Error("Only active permits can be suspended.");
    return transition(sb, userId, data.permitId, "SUSPENDED", data.comment);
  });

export const resumePermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    await requireRole(sb, userId, ["safety_officer", "admin"]);
    const permit = await expireIfNeeded(sb, await loadPermit(sb, data.permitId));
    if (permit.status !== "SUSPENDED") throw new Error("Only suspended permits can resume.");
    if (Date.now() < new Date(permit.planned_start).getTime())
      throw new Error("Permit cannot resume before planned start.");
    return transition(sb, userId, data.permitId, "ACTIVE", data.comment ?? "Work resumed.");
  });

export const closePermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const { profile, roles } = await requireRole(sb, userId, ["requester", "admin"]);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.status !== "ACTIVE") throw new Error("Only active permits can be closed.");
    if (permit.requester_id !== profile.id && !roles.has("admin"))
      throw new Error("Only the requester or an Admin can close this permit.");
    return transition(sb, userId, data.permitId, "CLOSED", data.comment);
  });

export const verifyClosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    await requireRole(sb, userId, ["safety_officer", "admin"]);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.status !== "CLOSED") throw new Error("Only closed permits can be verified.");
    return transition(sb, userId, data.permitId, "CLOSED_VERIFIED", data.comment);
  });

export const cancelPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ permitId: z.string().uuid(), comment: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const { profile, roles } = await requireRole(sb, userId, [
      "requester",
      "safety_officer",
      "admin",
    ]);
    const permit = await loadPermit(sb, data.permitId);
    if (["CLOSED", "CLOSED_VERIFIED", "CANCELLED", "EXPIRED"].includes(permit.status))
      throw new Error("Terminal permits cannot be cancelled.");
    if (permit.requester_id !== profile.id && !roles.has("safety_officer") && !roles.has("admin"))
      throw new Error("Only the requester, Safety Officer, or Admin can cancel this permit.");
    return transition(sb, userId, data.permitId, "CANCELLED", data.comment);
  });

export const logWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ permitId: z.string().uuid(), notes: z.string().min(1), loggedAt: z.string() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = authContext(context);
    const profile = await profileForUser(sb, userId);
    const permit = await loadPermit(sb, data.permitId);
    if (permit.status !== "ACTIVE")
      throw new Error("Work can only be logged while the permit is ACTIVE.");
    const { data: log, error } = await sb
      .from("permit_work_logs")
      .insert({
        permit_id: data.permitId,
        logged_by: profile.id,
        notes: data.notes,
        logged_at: data.loggedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(sb, data.permitId, profile.id, "WORK_LOGGED", { comment: data.notes });
    return log;
  });
