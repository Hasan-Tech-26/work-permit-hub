import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { StatusChip, TypeChip } from "@/components/ptw/chips";
import { listPermits, listPermitTypes } from "@/lib/ptw.functions";
import {
  PERMIT_STATUSES,
  STATUS_META,
  fmtDateTime,
  type PermitRow,
  type PermitStatus,
  type PermitTypeRow,
} from "@/lib/ptw";

const permitsQuery = queryOptions({
  queryKey: ["permits"],
  queryFn: () => listPermits() as Promise<unknown> as Promise<PermitRow[]>,
});

const typesQuery = queryOptions({
  queryKey: ["permit-types"],
  queryFn: () => listPermitTypes() as Promise<unknown> as Promise<PermitTypeRow[]>,
});

export const Route = createFileRoute("/permits/")({
  head: () => ({
    meta: [
      { title: "Permit Register — Tallyard PTW Control" },
      {
        name: "description",
        content:
          "Full permit-to-work register: filter every permit by type and lifecycle status across plants, areas and equipment.",
      },
      { property: "og:title", content: "Permit Register — Tallyard PTW Control" },
      {
        property: "og:description",
        content: "Filter every permit by type and lifecycle status across plants and areas.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(permitsQuery),
      context.queryClient.ensureQueryData(typesQuery),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="p-8 font-mono text-sm text-st-rejected">Register unavailable: {error.message}</div>
  ),
  component: PermitRegister,
});

function PermitRegister() {
  const { data: permits } = useSuspenseQuery(permitsQuery);
  const { data: types } = useSuspenseQuery(typesQuery);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [status, setStatus] = useState<PermitStatus | null>(null);

  const rows = permits.filter(
    (p) =>
      (!typeCode || p.permit_type?.code === typeCode) && (!status || p.status === status),
  );

  return (
    <AppShell breadcrumb="OPERATIONS / REGISTER" title="PERMIT REGISTER">
      <section className="px-8 pt-6">
        <SectionRule label="(a) FILTERS" right={`${rows.length} OF ${permits.length} RECORDS`} />
        <div className="space-y-3 border border-border bg-raised p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 w-12 font-mono text-[10px] tracking-[0.15em] text-muted">TYPE</span>
            <Chip active={typeCode === null} onClick={() => setTypeCode(null)} label="ALL" />
            {types.map((t) => (
              <Chip
                key={t.id}
                active={typeCode === t.code}
                onClick={() => setTypeCode(t.code)}
                label={t.name.toUpperCase()}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 w-12 font-mono text-[10px] tracking-[0.15em] text-muted">STATUS</span>
            <Chip active={status === null} onClick={() => setStatus(null)} label="ALL" />
            {PERMIT_STATUSES.map((s) => (
              <Chip
                key={s}
                active={status === s}
                onClick={() => setStatus(s)}
                label={STATUS_META[s].label}
                token={STATUS_META[s].token}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-8 pt-6">
        <SectionRule label="(b) RECORDS" right="SORTED BY WINDOW" />
        <div className="border border-border bg-raised">
          <div className="grid grid-cols-12 gap-3 border-b border-border px-4 py-2.5 font-mono text-[10px] tracking-[0.12em] text-muted">
            <div className="col-span-2">PERMIT NO.</div>
            <div className="col-span-2">TYPE</div>
            <div className="col-span-2">PLANT / AREA</div>
            <div className="col-span-2">REQUESTER</div>
            <div className="col-span-2">EQUIPMENT</div>
            <div className="col-span-1">WINDOW</div>
            <div className="col-span-1">STATUS</div>
          </div>
          <div className="divide-y divide-border">
            {rows.map((p) => (
              <Link
                key={p.id}
                to="/permits/$permitNumber"
                params={{ permitNumber: p.permit_number }}
                className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface/60"
              >
                <div className="col-span-2 font-mono text-[12px]">{p.permit_number}</div>
                <div className="col-span-2">
                  <TypeChip name={p.permit_type?.name ?? "—"} accent={p.permit_type?.accent ?? "safety"} />
                </div>
                <div className="col-span-2 text-muted">
                  {p.plant?.name ?? "—"} · {p.area?.name ?? "—"}
                </div>
                <div className="col-span-2 text-muted">{p.requester?.full_name ?? "—"}</div>
                <div className="col-span-2 text-muted">{p.equipment ?? "—"}</div>
                <div className="col-span-1 font-mono text-[11px] text-muted">{fmtDateTime(p.planned_start)}</div>
                <div className="col-span-1">
                  <StatusChip status={p.status} />
                </div>
              </Link>
            ))}
            {rows.length === 0 ? (
              <div className="px-4 py-10 text-center font-mono text-[11px] text-muted">
                NO PERMITS MATCH THESE FILTERS
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Chip({
  label,
  active,
  onClick,
  token,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  token?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border px-2 py-1 font-mono text-[10px] tracking-[0.1em] transition-colors"
      style={{
        color: active ? "var(--safety-ink)" : (token ?? "var(--muted)"),
        background: active ? "var(--safety)" : "transparent",
        borderColor: active ? "var(--safety)" : "var(--border)",
      }}
    >
      {label}
    </button>
  );
}
