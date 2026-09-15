import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { StatusChip, TypeChip } from "@/components/ptw/chips";
import { getPermit } from "@/lib/ptw.functions";
import {
  ROLE_LABELS,
  fmtDateTime,
  type ApprovalRow,
  type PermitRow,
  type TypeField,
} from "@/lib/ptw";

type PermitDetail = { permit: PermitRow; approvals: ApprovalRow[] };

const detailQuery = (number: string) =>
  queryOptions({
    queryKey: ["permit", number],
    queryFn: () =>
      getPermit({ data: { number } }) as Promise<unknown> as Promise<PermitDetail | null>,
  });

export const Route = createFileRoute("/permits/$permitNumber")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(detailQuery(params.permitNumber));
    if (!data) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.permitNumber} — Permit Detail | Tallyard PTW` },
      {
        name: "description",
        content: `Permit ${params.permitNumber}: work scope, plant and area, hazards, PPE, type-specific checks and the approval chain.`,
      },
      { property: "og:title", content: `${params.permitNumber} — Permit Detail` },
      {
        property: "og:description",
        content: "Work scope, hazards, PPE, type-specific checks and approval chain for this permit.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 font-mono text-sm text-st-rejected">Permit unavailable: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 font-mono text-sm text-muted">
      NO SUCH PERMIT ·{" "}
      <Link to="/permits" className="text-safety hover:underline">
        BACK TO REGISTER
      </Link>
    </div>
  ),
  component: PermitDetailPage,
});

function renderValue(field: TypeField, raw: unknown) {
  if (raw === null || raw === undefined || raw === "") return "—";
  if (field.type === "boolean") return raw ? "CONFIRMED" : "NOT DONE";
  return String(raw);
}

function PermitDetailPage() {
  const { permitNumber } = Route.useParams();
  const { data } = useSuspenseQuery(detailQuery(permitNumber));
  if (!data) return null;
  const { permit, approvals } = data;
  const schema = permit.permit_type?.field_schema ?? [];

  return (
    <AppShell
      breadcrumb="OPERATIONS / PERMIT"
      title={permit.permit_number}
      status={<StatusChip status={permit.status} />}
    >
      <section className="px-8 pt-6">
        <SectionRule label="(a) PERMIT RECORD" right={permit.contractor_company?.toUpperCase() ?? ""} />
        <div className="grid grid-cols-1 border border-border bg-raised xl:grid-cols-12">
          <div className="border-border p-6 xl:col-span-8 xl:border-r">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TypeChip
                  name={permit.permit_type?.name ?? "—"}
                  accent={permit.permit_type?.accent ?? "safety"}
                />
                <StatusChip status={permit.status} />
              </div>
              <div className="font-mono text-[11px] text-muted">{permit.permit_number}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[12px] xl:grid-cols-4">
              <Field label="PLANT / AREA" value={`${permit.plant?.name ?? "—"} · ${permit.area?.name ?? "—"}`} />
              <Field label="EQUIPMENT" value={permit.equipment ?? "—"} />
              <Field
                label="REQUESTER"
                value={`${permit.requester?.full_name ?? "—"}${
                  permit.requester?.job_title ? ` — ${permit.requester.job_title}` : ""
                }`}
              />
              <Field label="CONTRACTOR / TEAM" value={`${permit.contractor_company ?? "—"} · ${permit.work_team ?? "—"}`} />
              <Field
                label="PLANNED WINDOW"
                value={`${fmtDateTime(permit.planned_start)} → ${fmtDateTime(permit.planned_end)}`}
                mono
              />
            </div>

            <div className="mt-5 border-t border-border pt-5">
              <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-muted">WORK DESCRIPTION</div>
              <p className="max-w-[68ch] text-[13px] leading-relaxed text-foreground/85">
                {permit.work_description}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
              <TagList label="HAZARDS" items={permit.hazards} />
              <TagList label="PPE REQUIRED" items={permit.ppe} />
              <TagList label="PRECAUTIONS" items={permit.precautions} />
            </div>
          </div>

          <div className="border-t border-border p-6 xl:col-span-4 xl:border-t-0">
            <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-safety">
              {(permit.permit_type?.name ?? "TYPE").toUpperCase()} · CHECKLIST
            </div>
            <div className="space-y-2.5 text-[12px]">
              {schema.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <span>{f.label}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {renderValue(f, (permit.type_data as Record<string, unknown>)[f.key])}
                  </span>
                </div>
              ))}
              {schema.length === 0 ? (
                <div className="font-mono text-[11px] text-muted">NO TYPE-SPECIFIC FIELDS</div>
              ) : null}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-muted">APPROVAL CHAIN</div>
              <div className="space-y-3 text-[12px]">
                {approvals.map((a) => {
                  const token =
                    a.decision === "APPROVED"
                      ? "var(--st-approved)"
                      : a.decision === "REJECTED"
                        ? "var(--st-rejected)"
                        : "var(--st-active)";
                  return (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <span
                        className="grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold"
                        style={{ background: `color-mix(in srgb, ${token} 20%, transparent)`, color: token }}
                      >
                        {a.decision === "APPROVED" ? "✓" : a.decision === "REJECTED" ? "✕" : "●"}
                      </span>
                      <div className="leading-tight">
                        <div className="font-medium">{a.approver?.full_name ?? "Unassigned"}</div>
                        <div className="font-mono text-[10px] text-muted">
                          {ROLE_LABELS[a.required_role].toUpperCase()} ·{" "}
                          {a.decided_at ? fmtDateTime(a.decided_at) : "PENDING"}
                        </div>
                        {a.comment ? <div className="mt-1 text-[11px] text-muted">{a.comment}</div> : null}
                      </div>
                    </div>
                  );
                })}
                {approvals.length === 0 ? (
                  <div className="font-mono text-[11px] text-muted">NO APPROVAL STEPS RAISED</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link to="/permits" className="font-mono text-[10px] tracking-[0.15em] text-safety hover:underline">
            ← BACK TO REGISTER
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.12em] text-muted">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? <span className="text-[11px] text-muted">—</span> : null}
        {items.map((i) => (
          <span key={i} className="rounded border border-border px-2 py-0.5 text-[11px]">
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}
