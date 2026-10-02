import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { StatusChip, TypeChip } from "@/components/ptw/chips";
import { listPermits, listRecentActivity } from "@/lib/ptw.functions";
import {
  PERMIT_STATUSES,
  STATUS_META,
  fmtDateTime,
  fmtTime,
  type HistoryRow,
  type PermitRow,
  type PermitStatus,
} from "@/lib/ptw";

const permitsQuery = queryOptions({
  queryKey: ["permits"],
  queryFn: () => listPermits() as Promise<unknown> as Promise<PermitRow[]>,
});

const activityQuery = queryOptions({
  queryKey: ["activity"],
  queryFn: () => listRecentActivity() as Promise<unknown> as Promise<HistoryRow[]>,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Permit Board — Tallyard PTW Control" },
      {
        name: "description",
        content:
          "Live permit-to-work control board: active, pending and expiring permits across plant areas with status lifecycle and approvals.",
      },
      { property: "og:title", content: "Permit Board — Tallyard PTW Control" },
      {
        property: "og:description",
        content: "Live permit-to-work control board for industrial plant operations.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(permitsQuery),
      context.queryClient.ensureQueryData(activityQuery),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="p-8 font-mono text-sm text-st-rejected">Board unavailable: {error.message}</div>
  ),
  component: Dashboard,
});

const OPEN_STATUSES: PermitStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
];

function Dashboard() {
  const { data: permits } = useSuspenseQuery(permitsQuery);
  const { data: activity } = useSuspenseQuery(activityQuery);

  const count = (s: PermitStatus) => permits.filter((p) => p.status === s).length;
  const now = Date.now();
  const expiring = permits.filter(
    (p) =>
      (p.status === "ACTIVE" || p.status === "APPROVED") &&
      new Date(p.planned_end).getTime() - now < 24 * 3600 * 1000 &&
      new Date(p.planned_end).getTime() > now,
  ).length;
  const open = permits.filter((p) => OPEN_STATUSES.includes(p.status)).length;
  const areas = new Set(permits.map((p) => p.area?.name).filter(Boolean)).size;
  const max = Math.max(1, ...PERMIT_STATUSES.map((s) => count(s)));

  const kpis = [
    {
      label: "ACTIVE",
      value: count("ACTIVE"),
      note: "IN-SERVICE WORK",
      token: "var(--st-active)",
      pulse: true,
    },
    {
      label: "PENDING APPROVAL",
      value: count("PENDING_APPROVAL"),
      note: "AWAITING SIGN-OFF",
      token: "var(--st-pending)",
      pulse: false,
    },
    {
      label: "EXPIRING < 24H",
      value: expiring,
      note: "REQUIRES RENEWAL",
      token: "var(--st-suspended)",
      pulse: false,
    },
    {
      label: "TOTAL OPEN",
      value: open,
      note: `ACROSS ${areas} AREAS`,
      token: "var(--st-approved)",
      pulse: false,
    },
  ];

  const register = permits.slice(0, 7);

  return (
    <AppShell breadcrumb="OPERATIONS / DASHBOARD" title="PERMIT BOARD">
      <section className="px-8 pt-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <SectionRule label="(a) LIVE STATUS" />
          </div>
          <Link
            to="/permits/new"
            className="mb-5 border border-safety bg-safety px-3 py-2 font-mono text-[10px] tracking-[0.12em] text-safety-ink"
          >
            + CREATE PERMIT
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((k, i) => (
            <div
              key={k.label}
              className="animate-fadeup border border-border bg-raised p-4"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="font-mono text-[10px] tracking-[0.15em] text-muted">{k.label}</div>
                <div
                  className={`size-2.5 rounded-full ${k.pulse ? "animate-pulse" : ""}`}
                  style={{ background: k.token }}
                />
              </div>
              <div className="mt-2 font-display text-5xl leading-none">{k.value}</div>
              <div className="mt-2 font-mono text-[10px] text-muted">{k.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-8 pt-6">
        <SectionRule label="(b) STATUS BREAKDOWN" />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="border border-border bg-raised p-4">
            <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-muted">
              LIFECYCLE DISTRIBUTION
            </div>
            <div className="space-y-2.5 text-[11px]">
              {PERMIT_STATUSES.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-24 font-mono text-muted">{STATUS_META[s].label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                    <span
                      className="block h-full"
                      style={{
                        width: `${(count(s) / max) * 100}%`,
                        background: STATUS_META[s].token,
                      }}
                    />
                  </span>
                  <span className="w-4 text-right font-mono">{count(s)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-raised p-4">
            <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-muted">
              RECENT ACTIVITY
            </div>
            <div className="space-y-3 text-[11px]">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span
                    className="mt-1 size-1.5 shrink-0 rounded-full"
                    style={{ background: STATUS_META[a.to_status].token }}
                  />
                  <div>
                    <span className="font-medium">{a.permit?.permit_number}</span>{" "}
                    {a.note ?? `moved to ${STATUS_META[a.to_status].label}`}
                    <div className="mt-0.5 font-mono text-[10px] text-muted">
                      {fmtTime(a.created_at)} · {(a.permit?.area?.name ?? "PLANT").toUpperCase()}
                      {a.changed_by ? ` · ${a.changed_by.full_name}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-raised p-4">
            <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-muted">
              PERMIT TYPES IN PLAY
            </div>
            <div className="space-y-3 text-[11px]">
              {Array.from(
                permits.reduce((m, p) => {
                  const name = p.permit_type?.name ?? "Unknown";
                  m.set(name, (m.get(name) ?? 0) + 1);
                  return m;
                }, new Map<string, number>()),
              ).map(([name, n]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="font-medium">{name}</span>
                  <span className="font-mono text-[10px] text-muted">{n} PERMITS</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="font-medium">Registered permits</span>
                <span className="font-mono text-[10px] text-safety">{permits.length}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 pt-6">
        <SectionRule
          label="(c) PERMIT REGISTER"
          right={`${permits.length} RECORDS · SORTED BY WINDOW`}
        />
        <div className="border border-border bg-raised">
          <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] text-muted">
            <div className="col-span-2">PERMIT NO.</div>
            <div className="col-span-3">TYPE</div>
            <div className="col-span-2">AREA</div>
            <div className="col-span-2">REQUESTER</div>
            <div className="col-span-2">WINDOW</div>
            <div className="col-span-1">STATUS</div>
          </div>
          <div className="divide-y divide-border">
            {register.map((p) => (
              <Link
                key={p.id}
                to="/permits/$permitNumber"
                params={{ permitNumber: p.permit_number }}
                className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface/60"
              >
                <div className="col-span-2 font-mono text-[12px]">{p.permit_number}</div>
                <div className="col-span-3">
                  <TypeChip
                    name={p.permit_type?.name ?? "—"}
                    accent={p.permit_type?.accent ?? "safety"}
                  />
                </div>
                <div className="col-span-2 text-muted">{p.area?.name ?? "—"}</div>
                <div className="col-span-2 text-muted">{p.requester?.full_name ?? "—"}</div>
                <div className="col-span-2 font-mono text-[11px] text-muted">
                  {fmtDateTime(p.planned_start)}
                </div>
                <div className="col-span-1">
                  <StatusChip status={p.status} />
                </div>
              </Link>
            ))}
          </div>
          <div className="border-t border-border px-4 py-2.5 text-right">
            <Link
              to="/permits"
              className="font-mono text-[10px] tracking-[0.15em] text-safety hover:underline"
            >
              OPEN FULL REGISTER →
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
