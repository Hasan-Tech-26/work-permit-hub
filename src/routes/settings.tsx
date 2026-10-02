import { createFileRoute } from "@tanstack/react-router";

import { AppShell, SectionRule } from "@/components/ptw/app-shell";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell breadcrumb="OPERATIONS / SETTINGS" title="SYSTEM SETTINGS">
      <section className="px-4 py-6 sm:px-6 xl:px-8">
        <SectionRule label="(a) CONTROL ROOM" right="ADMIN READY" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-raised p-5">
            <div className="font-mono text-[10px] tracking-[0.18em] text-safety">PROFILE</div>
            <div className="mt-3 text-lg font-semibold">PTW operating profile</div>
            <p className="mt-2 text-sm text-muted">
              The app is wired to the existing Supabase role model and workflow rules. Role
              management and advanced configuration remain in the database and security layer.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-raised p-5">
            <div className="font-mono text-[10px] tracking-[0.18em] text-safety">WORKFLOW</div>
            <div className="mt-3 text-lg font-semibold">Lifecycle controls</div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>• DRAFT → PENDING_APPROVAL</li>
              <li>• Approval chain remains authoritative</li>
              <li>• Safety and area ownership controls are enforced</li>
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
