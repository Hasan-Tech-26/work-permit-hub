import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-2.5 px-2 py-2 text-muted transition-colors hover:text-foreground"
      activeProps={{ className: "bg-raised !text-foreground" }}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  breadcrumb,
  title,
  status,
  children,
}: {
  breadcrumb: string;
  title: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-1.5 w-full">
          <span className="flex-1 bg-st-active" />
          <span className="w-8 bg-st-rejected" />
          <span className="flex-1 bg-st-approved" />
          <span className="w-8 bg-st-closed" />
        </div>
        <div className="px-5 pt-5 pb-4">
          <div className="font-display text-2xl leading-none tracking-tight">TALLYARD</div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-muted">PTW · CONTROL</div>
        </div>
        <div className="border-t border-border px-4 pt-3">
          <div className="font-mono text-[10px] tracking-[0.18em] text-muted">PLANT</div>
          <div className="mt-1 text-sm font-semibold">RIVERBEND 04</div>
          <div className="font-mono text-[10px] text-muted">UNIT B · TURBINE</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4 text-sm">
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/permits" label="Permits" />
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-st-approved/15 font-mono text-[11px] font-medium text-st-approved">
              MS
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold">M. Sandoval</div>
              <div className="font-mono text-[10px] text-muted">SAFETY OFFICER</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden pb-10">
        <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-3.5">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted">{breadcrumb}</div>
            <h1 className="mt-0.5 font-display text-3xl leading-none tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-5">
            {status ?? (
              <div className="flex items-center gap-2">
                <span className="size-2 animate-pulse rounded-full bg-st-approved" />
                <span className="font-mono text-[11px] text-muted">ALL SYSTEMS NOMINAL</span>
              </div>
            )}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export function SectionRule({ label, right }: { label: string; right?: string }) {
  return (
    <div className="mb-5 flex items-end gap-2">
      <div className="font-mono text-[11px] tracking-[0.2em] text-safety">{label}</div>
      <div className="mb-1 h-px flex-1 bg-border" />
      {right ? <div className="mb-1 font-mono text-[10px] text-muted">{right}</div> : null}
    </div>
  );
}
