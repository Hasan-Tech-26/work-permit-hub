import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { StatusChip, TypeChip } from "@/components/ptw/chips";
import { supabase } from "@/integrations/supabase/client";
import { approvePermit, rejectPermit } from "@/lib/ptw.functions";
import { ROLE_LABELS, fmtDateTime, type PermitStatus } from "@/lib/ptw";

type ApprovalItem = {
  id: string;
  permit_id: string;
  permit_number: string;
  status: string;
  work_description: string;
  required_role: "area_owner" | "safety_officer" | "admin";
  step_order: number;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  decided_at: string | null;
  requested_at: string | null;
  permit_type: { name: string; accent: string } | null;
  plant: { name: string; code: string } | null;
  area: { name: string; code: string } | null;
  requester: { full_name: string } | null;
};

export const Route = createFileRoute("/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) {
        setItems([]);
        setError("Please sign in to review approvals.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (!profile) {
        setItems([]);
        setError("No PTW profile is linked to this account.");
        return;
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("profile_id", profile.id);
      const roles = new Set((rolesData ?? []).map((row) => row.role));
      const allowedRoles = Array.from(roles);

      if (!allowedRoles.length) {
        setItems([]);
        setError("This account has no approval permissions.");
        return;
      }

      const roleQuery =
        allowedRoles.length === 1
          ? `required_role.eq.${allowedRoles[0]}`
          : allowedRoles.map((role) => `required_role.eq.${role}`).join(",");
      const { data, error: queryError } = await supabase
        .from("permit_approvals")
        .select(
          `id, permit_id, required_role, step_order, decision, decided_at, permit:permits!permit_approvals_permit_id_fkey (id, permit_number, status, work_description, planned_start, permit_type:permit_types ( name, accent ), plant:plants ( name, code ), area:areas ( name, code ), requester:profiles!permits_requester_id_fkey ( full_name ) )`,
        )
        .eq("decision", "PENDING")
        .or(roleQuery)
        .order("step_order", { foreignTable: "permits" });

      if (queryError) throw queryError;
      const nextItems = (data ?? []).map((row) => ({
        id: row.id,
        permit_id: row.permit_id,
        permit_number: row.permit?.permit_number ?? "—",
        status: row.permit?.status ?? "DRAFT",
        work_description: row.permit?.work_description ?? "—",
        required_role: row.required_role,
        step_order: row.step_order,
        decision: row.decision,
        decided_at: row.decided_at,
        requested_at: row.permit?.planned_start ?? null,
        permit_type: row.permit?.permit_type ?? null,
        plant: row.permit?.plant ?? null,
        area: row.permit?.area ?? null,
        requester: row.permit?.requester ?? null,
      })) as ApprovalItem[];

      setItems(nextItems);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load approvals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (approvalId: string, permitId: string, action: "approve" | "reject") => {
    const comment =
      action === "reject"
        ? window.prompt("Rejection reason", "")
        : window.prompt("Approval comment", "Approved");
    if (!comment || !comment.trim()) {
      if (action === "reject") return;
    }
    try {
      if (action === "approve") {
        await approvePermit({
          data: { permitId, approvalId, comment: comment?.trim() || "Approved." },
        });
      } else {
        await rejectPermit({
          data: { permitId, approvalId, comment: comment?.trim() || "Rejected." },
        });
      }
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Action failed.");
    }
  };

  return (
    <AppShell breadcrumb="OPERATIONS / APPROVALS" title="APPROVAL CENTER">
      <section className="px-4 py-6 sm:px-6 xl:px-8">
        <SectionRule label="(a) PENDING DECISIONS" right={`${items.length} ITEMS`} />
        {error ? (
          <div className="rounded-md border border-st-rejected/40 bg-st-rejected/10 p-4 text-sm text-st-rejected">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-md border border-border bg-raised p-6 text-sm text-muted">
              Loading approvals...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-border bg-raised p-8 text-center text-sm text-muted">
              No pending approvals match your current role.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-border bg-raised p-4 md:p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/permits/$permitNumber"
                        params={{ permitNumber: item.permit_number }}
                        className="text-lg font-semibold text-foreground hover:text-safety"
                      >
                        {item.permit_number}
                      </Link>
                      <TypeChip
                        name={item.permit_type?.name ?? "Permit"}
                        accent={item.permit_type?.accent ?? "safety"}
                      />
                      <StatusChip status={item.status as PermitStatus} />
                    </div>
                    <p className="max-w-3xl text-sm text-foreground/80">{item.work_description}</p>
                    <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
                      <div>Plant: {item.plant?.name ?? "—"}</div>
                      <div>Area: {item.area?.name ?? "—"}</div>
                      <div>Requester: {item.requester?.full_name ?? "—"}</div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 text-xs text-muted">
                    <div>
                      Required role:{" "}
                      <span className="font-medium text-foreground">
                        {ROLE_LABELS[item.required_role]}
                      </span>
                    </div>
                    <div>Step: {item.step_order}</div>
                    <div>Due: {item.requested_at ? fmtDateTime(item.requested_at) : "—"}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void act(item.id, item.permit_id, "approve")}
                    className="rounded-md border border-st-approved bg-st-approved px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-safety-ink"
                  >
                    APPROVE
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(item.id, item.permit_id, "reject")}
                    className="rounded-md border border-st-rejected bg-st-rejected/10 px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-st-rejected"
                  >
                    REJECT
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
