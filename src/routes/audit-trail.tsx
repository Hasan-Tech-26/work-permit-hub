import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/ptw";

type AuditRow = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  created_at: string;
  actor_name: string;
  permit_number: string;
};

export const Route = createFileRoute("/audit-trail")({
  component: AuditTrailPage,
});

function AuditTrailPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("permit_audit_log")
        .select(
          `id, action, from_status, to_status, comment, created_at, permit:permits ( permit_number ), actor:profiles ( full_name )`,
        )
        .order("created_at", { ascending: false })
        .limit(40);

      if (!error) {
        setRows(
          (data ?? []).map((row) => ({
            id: row.id,
            action: row.action,
            from_status: row.from_status,
            to_status: row.to_status,
            comment: row.comment,
            created_at: row.created_at,
            actor_name: row.actor?.full_name ?? "System",
            permit_number: row.permit?.permit_number ?? "—",
          })),
        );
      }
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <AppShell breadcrumb="OPERATIONS / AUDIT TRAIL" title="AUDIT TRAIL">
      <section className="px-4 py-6 sm:px-6 xl:px-8">
        <SectionRule label="(a) HISTORY" right={`${rows.length} EVENTS`} />
        {loading ? (
          <div className="rounded-md border border-border bg-raised p-6 text-sm text-muted">
            Loading audit timeline...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-border bg-raised p-8 text-center text-sm text-muted">
            No audit events recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-border bg-raised p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium">{row.action}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {fmtDateTime(row.created_at)}
                  </div>
                </div>
                <div className="mt-2 font-mono text-[11px] text-muted">
                  {row.permit_number} · {row.actor_name}
                </div>
                <div className="mt-2 text-sm text-foreground/80">
                  {row.from_status ?? "INITIAL"} → {row.to_status ?? "CURRENT"}
                </div>
                {row.comment ? <div className="mt-2 text-sm text-muted">{row.comment}</div> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
