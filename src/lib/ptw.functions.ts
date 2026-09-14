import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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

export const listPermits = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("permits")
    .select(PERMIT_SELECT)
    .order("planned_start", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listPermitTypes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("permit_types")
    .select("id, code, name, description, accent, field_schema")
    .eq("is_active", true)
    .order("sort_order");
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

    const { data: approvals, error: aErr } = await sb
      .from("permit_approvals")
      .select(
        `id, step_order, required_role, decision, comment, decided_at,
         approver:profiles ( full_name )`,
      )
      .eq("permit_id", (permit as { id: string }).id)
      .order("step_order");
    if (aErr) throw new Error(aErr.message);

    return { permit, approvals: approvals ?? [] };
  });
