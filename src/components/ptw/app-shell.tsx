import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/permits", label: "Permits", icon: ClipboardList },
  { to: "/permits/new", label: "Create Permit", icon: Plus },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/work-logs", label: "Work Logs", icon: Activity },
  { to: "/audit-trail", label: "Audit Trail", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
      activeProps={{ className: "bg-raised text-foreground ring-1 ring-border" }}
    >
      <Icon size={15} />
      <span>{label}</span>
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
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("Operations User");
  const [role, setRole] = useState("requester");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;
      if (!active) return;
      setEmail(sessionUser?.email ?? null);
      if (!sessionUser) {
        setFullName("Operations User");
        setRole("requester");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .or(`user_id.eq.${sessionUser.id},id.eq.${sessionUser.id}`)
        .maybeSingle();
      if (!profile) {
        const metadataFullName = sessionUser.user_metadata?.["full_name"];
        setFullName(
          typeof metadataFullName === "string"
            ? metadataFullName
            : (sessionUser.email ?? "Operations User"),
        );
        return;
      }

      setFullName(profile.full_name ?? sessionUser.email ?? "Operations User");
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("profile_id", profile.id);
      const nextRole = rolesData?.[0]?.role ?? "requester";
      setRole(nextRole);
    };

    void loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      if (!session) {
        setFullName("Operations User");
        setRole("requester");
      } else {
        void loadProfile();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  };

  const sidebar = (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-1.5 w-full">
        <span className="flex-1 bg-st-active" />
        <span className="w-8 bg-st-rejected" />
        <span className="flex-1 bg-st-approved" />
        <span className="w-8 bg-st-closed" />
      </div>
      <div className="px-5 pb-4 pt-5">
        <div className="font-display text-2xl leading-none tracking-tight">TALLYARD</div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-muted">PTW · CONTROL</div>
      </div>
      <div className="border-y border-border px-4 py-3">
        <div className="font-mono text-[10px] tracking-[0.18em] text-muted">PLANT</div>
        <div className="mt-1 text-sm font-semibold">RIVERBEND 04</div>
        <div className="font-mono text-[10px] text-muted">UNIT B · TURBINE</div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavItem key={to} to={to} label={label} icon={Icon} />
        ))}
      </nav>
      <div className="border-t border-border p-3">
        {email ? (
          <div className="rounded-md border border-border bg-background p-2.5">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-full bg-st-approved/15 text-st-approved">
                <UserRound size={14} />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-xs font-semibold">{fullName}</div>
                <div className="font-mono text-[9px] uppercase text-muted">{role}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-3 flex w-full items-center justify-center gap-2 border border-border px-2 py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted transition-colors hover:text-foreground"
            >
              <LogOut size={12} />
              SIGN OUT
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="block rounded-md border border-safety bg-safety px-2 py-2 text-center font-mono text-[10px] tracking-[0.12em] text-safety-ink"
          >
            SIGN IN
          </Link>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex bg-black/60 lg:hidden">
          <div className="w-72 max-w-[80vw] overflow-y-auto border-r border-border bg-surface">
            {sidebar}
          </div>
          <button
            type="button"
            className="ml-auto mt-4 mr-4 rounded-full border border-border bg-surface p-2 text-muted"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 overflow-x-hidden pb-10">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6 xl:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex rounded-md border border-border bg-background p-2 text-muted lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-muted">{breadcrumb}</div>
              <h1 className="mt-0.5 font-display text-2xl leading-none tracking-tight sm:text-3xl">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <label className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-muted sm:flex">
              <Search size={14} />
              <input
                aria-label="Search permits"
                placeholder="Search"
                className="w-32 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </label>
            <button
              type="button"
              className="relative rounded-md border border-border bg-background p-2 text-muted"
              aria-label="Notifications"
            >
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-st-pending" />
            </button>
            <div className="hidden items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 sm:flex">
              <div className="grid size-7 place-items-center rounded-full bg-st-approved/15 text-st-approved">
                <UserRound size={13} />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-xs font-medium">{fullName}</div>
                <div className="font-mono text-[9px] uppercase text-muted">{role}</div>
              </div>
            </div>
            {status ?? (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="size-2 animate-pulse rounded-full bg-st-approved" />
                <span className="font-mono text-[10px] uppercase text-muted">systems nominal</span>
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
