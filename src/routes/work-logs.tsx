import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime } from "@/lib/ptw";

type WorkLog = {
  id: string;
  notes: string;
  logged_at: string;
  permit_number: string;
  user_name: string;
};

export const Route = createFileRoute("/work-logs")({
  component: WorkLogsPage,
});

function WorkLogsPage() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("permit_work_logs")
        .select(
          `id, notes, logged_at, permit:permits ( permit_number ), logged_by:profiles ( full_name )`,
        )
        .order("logged_at", { ascending: false })
        .limit(40);

      if (!error) {
        setLogs(
          (data ?? []).map((row) => ({
            id: row.id,
            notes: row.notes,
            logged_at: row.logged_at,
            permit_number: row.permit?.permit_number ?? "—",
            user_name: row.logged_by?.full_name ?? "System",
          })),
        );
      }
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <AppShell breadcrumb="OPERATIONS / WORK LOGS" title="WORK LOGS">
      <section className="px-4 py-6 sm:px-6 xl:px-8">
        <SectionRule label="(a) TIMELINE" right={`${logs.length} ENTRIES`} />
        {loading ? (
          <div className="rounded-md border border-border bg-raised p-6 text-sm text-muted">
            Loading live work-log timeline...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-md border border-border bg-raised p-8 text-center text-sm text-muted">
            No work logs recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-raised p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-mono text-[11px] text-muted">{log.permit_number}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {fmtDateTime(log.logged_at)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-foreground/85">{log.notes}</div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted">
                  {log.user_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
