import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, SectionRule } from "@/components/ptw/app-shell";
import { StatusChip, TypeChip } from "@/components/ptw/chips";
import {
  activatePermit,
  approvePermit,
  cancelPermit,
  closePermit,
  getPermit,
  logWork,
  rejectPermit,
  resumePermit,
  submitPermit,
  suspendPermit,
  verifyClosure,
} from "@/lib/ptw.functions";
import {
  ROLE_LABELS,
  fmtDateTime,
  type ApprovalRow,
  type PermitRow,
  type TypeField,
  type AuditRow,
  type HistoryRow,
  type WorkLogRow,
} from "@/lib/ptw";

type PermitDetail = {
  permit: PermitRow;
  approvals: ApprovalRow[];
  history: HistoryRow[];
  logs: WorkLogRow[];
  audit: AuditRow[];
};

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
        content:
          "Work scope, hazards, PPE, type-specific checks and approval chain for this permit.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 font-mono text-sm text-st-rejected">
      Permit unavailable: {error.message}
    </div>
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
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  if (!data) return null;
  const { permit, approvals, history, logs, audit } = data;
  const schema = permit.permit_type?.field_schema ?? [];

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setFeedback(null);
    try {
      await operation();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["permit", permitNumber] }),
        queryClient.invalidateQueries({ queryKey: ["permits"] }),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
      ]);
      setFeedback({ kind: "success", text: "Permit updated successfully." });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusy(false);
    }
  };
  const comment = (label: string, required = false) => {
    const value = window.prompt(label, "");
    if (required && !value?.trim()) return null;
    return value?.trim() ?? "";
  };
  const actions = (
    <div className="flex flex-wrap gap-2">
      {permit.status === "DRAFT" ? (
        <ActionButton
          disabled={busy}
          label="SUBMIT FOR APPROVAL"
          onClick={() => run(() => submitPermit({ data: { permitId: permit.id } }))}
        />
      ) : null}
      {permit.status === "PENDING_APPROVAL"
        ? approvals
            .filter((a) => a.decision === "PENDING")
            .map((a) => (
              <span key={a.id} className="flex gap-1">
                <ActionButton
                  disabled={busy}
                  label={`APPROVE ${ROLE_LABELS[a.required_role].toUpperCase()}`}
                  onClick={() => {
                    const note = comment("Approval comment", true);
                    if (note)
                      void run(() =>
                        approvePermit({
                          data: { permitId: permit.id, approvalId: a.id, comment: note },
                        }),
                      );
                  }}
                />
                <ActionButton
                  disabled={busy}
                  label="REJECT"
                  danger
                  onClick={() => {
                    const note = comment("Rejection reason", true);
                    if (note)
                      void run(() =>
                        rejectPermit({
                          data: { permitId: permit.id, approvalId: a.id, comment: note },
                        }),
                      );
                  }}
                />
              </span>
            ))
        : null}
      {permit.status === "APPROVED" ? (
        <ActionButton
          disabled={busy}
          label="START WORK"
          onClick={() => run(() => activatePermit({ data: { permitId: permit.id } }))}
        />
      ) : null}
      {permit.status === "ACTIVE" ? (
        <>
          <ActionButton
            disabled={busy}
            label="SUSPEND"
            onClick={() => {
              const note = comment("Suspension reason", true);
              if (note)
                void run(() => suspendPermit({ data: { permitId: permit.id, comment: note } }));
            }}
          />
          <ActionButton
            disabled={busy}
            label="CLOSE"
            onClick={() => {
              const note = comment("Closure comment", true);
              if (note)
                void run(() => closePermit({ data: { permitId: permit.id, comment: note } }));
            }}
          />
        </>
      ) : null}
      {permit.status === "SUSPENDED" ? (
        <ActionButton
          disabled={busy}
          label="RESUME"
          onClick={() => run(() => resumePermit({ data: { permitId: permit.id } }))}
        />
      ) : null}
      {permit.status === "CLOSED" ? (
        <ActionButton
          disabled={busy}
          label="VERIFY CLOSURE"
          onClick={() => {
            const note = comment("Verification comment", true);
            if (note)
              void run(() => verifyClosure({ data: { permitId: permit.id, comment: note } }));
          }}
        />
      ) : null}
      {!["CLOSED", "CLOSED_VERIFIED", "CANCELLED", "EXPIRED"].includes(permit.status) ? (
        <ActionButton
          disabled={busy}
          label="CANCEL"
          danger
          onClick={() => {
            const note = comment("Cancellation reason", true);
            if (note)
              void run(() => cancelPermit({ data: { permitId: permit.id, comment: note } }));
          }}
        />
      ) : null}
    </div>
  );

  return (
    <AppShell
      breadcrumb="OPERATIONS / PERMIT"
      title={permit.permit_number}
      status={<StatusChip status={permit.status} />}
    >
      <section className="px-8 pt-6">
        <SectionRule
          label="(a) PERMIT RECORD"
          right={permit.contractor_company?.toUpperCase() ?? ""}
        />
        <div className="mb-4">{actions}</div>
        {feedback ? (
          <div
            className={`mb-4 border p-3 text-sm ${feedback.kind === "success" ? "border-st-approved/30 bg-st-approved/10 text-st-approved" : "border-st-rejected/30 bg-st-rejected/10 text-st-rejected"}`}
            role="status"
          >
            {feedback.text}
          </div>
        ) : null}
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
              <Field
                label="PLANT / AREA"
                value={`${permit.plant?.name ?? "—"} · ${permit.area?.name ?? "—"}`}
              />
              <Field label="EQUIPMENT" value={permit.equipment ?? "—"} />
              <Field
                label="REQUESTER"
                value={`${permit.requester?.full_name ?? "—"}${
                  permit.requester?.job_title ? ` — ${permit.requester.job_title}` : ""
                }`}
              />
              <Field
                label="CONTRACTOR / TEAM"
                value={`${permit.contractor_company ?? "—"} · ${permit.work_team ?? "—"}`}
              />
              <Field
                label="PLANNED WINDOW"
                value={`${fmtDateTime(permit.planned_start)} → ${fmtDateTime(permit.planned_end)}`}
                mono
              />
            </div>

            <div className="mt-5 border-t border-border pt-5">
              <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-muted">
                WORK DESCRIPTION
              </div>
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
              <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-muted">
                APPROVAL CHAIN
              </div>
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
                        style={{
                          background: `color-mix(in srgb, ${token} 20%, transparent)`,
                          color: token,
                        }}
                      >
                        {a.decision === "APPROVED" ? "✓" : a.decision === "REJECTED" ? "✕" : "●"}
                      </span>
                      <div className="leading-tight">
                        <div className="font-medium">{a.approver?.full_name ?? "Unassigned"}</div>
                        <div className="font-mono text-[10px] text-muted">
                          {ROLE_LABELS[a.required_role].toUpperCase()} ·{" "}
                          {a.decided_at ? fmtDateTime(a.decided_at) : "PENDING"}
                        </div>
                        {a.comment ? (
                          <div className="mt-1 text-[11px] text-muted">{a.comment}</div>
                        ) : null}
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
        {permit.status === "ACTIVE" ? (
          <WorkLogForm
            permitId={permit.id}
            busy={busy}
            onLog={(notes, loggedAt) =>
              run(() => logWork({ data: { permitId: permit.id, notes, loggedAt } }))
            }
            logs={logs}
          />
        ) : null}
        <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Timeline
            title="STATUS HISTORY"
            rows={history.map((row) => ({
              id: row.id,
              text: `${row.from_status ?? "INITIAL"} -> ${row.to_status}${row.note ? ` · ${row.note}` : ""}`,
              who: row.changed_by?.full_name ?? "SYSTEM",
              at: row.created_at,
            }))}
          />
          <Timeline
            title="AUDIT TIMELINE"
            rows={audit.map((row) => ({
              id: row.id,
              text: `${row.action}${row.from_status || row.to_status ? ` · ${row.from_status ?? ""} -> ${row.to_status ?? ""}` : ""}${row.comment ? ` · ${row.comment}` : ""}`,
              who: row.actor?.full_name ?? "SYSTEM",
              at: row.created_at,
            }))}
          />
        </section>
        <div className="mt-4">
          <Link
            to="/permits"
            className="font-mono text-[10px] tracking-[0.15em] text-safety hover:underline"
          >
            ← BACK TO REGISTER
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border px-3 py-2 font-mono text-[10px] tracking-[0.1em] disabled:opacity-40 ${danger ? "border-st-rejected text-st-rejected" : "border-safety bg-safety text-safety-ink"}`}
    >
      {label}
    </button>
  );
}

function WorkLogForm({
  permitId,
  busy,
  onLog,
  logs,
}: {
  permitId: string;
  busy: boolean;
  onLog: (notes: string, loggedAt: string) => Promise<void>;
  logs: WorkLogRow[];
}) {
  const [notes, setNotes] = useState("");
  return (
    <section className="mt-6 border border-border bg-raised p-5">
      <SectionRule label="(b) WORK LOG" right="ACTIVE PERMIT" />
      <div className="flex flex-wrap gap-2">
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Work notes"
          className="min-w-64 flex-1 border border-border bg-background px-3 py-2 text-sm"
        />
        <ActionButton
          label="LOG WORK"
          disabled={busy || !notes.trim()}
          onClick={() => {
            void onLog(notes, new Date().toISOString());
            setNotes("");
          }}
        />
      </div>
      <div className="mt-4 space-y-2 text-[11px]">
        {logs.map((log) => (
          <div key={log.id} className="border-t border-border pt-2">
            <span className="font-mono text-muted">
              {fmtDateTime(log.logged_at)} · {log.logged_by?.full_name ?? "Unknown"}
            </span>{" "}
            {log.notes}
          </div>
        ))}
      </div>
    </section>
  );
}

function Timeline({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; text: string; who?: string; at: string }>;
}) {
  return (
    <div className="border border-border bg-raised p-5">
      <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-muted">{title}</div>
      <div className="space-y-3 text-[11px]">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="border-l-2 border-safety pl-3">
              <div>{row.text}</div>
              <div className="mt-1 font-mono text-[10px] text-muted">
                {row.who ?? "SYSTEM"} · {fmtDateTime(row.at)}
              </div>
            </div>
          ))
        ) : (
          <span className="font-mono text-muted">NO RECORDS</span>
        )}
      </div>
    </div>
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
