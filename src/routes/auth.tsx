import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In · Tallyard PTW Control" },
      {
        name: "description",
        content:
          "Sign in to Tallyard PTW Control to review permits to work, approvals and live plant status.",
      },
      { property: "og:title", content: "Sign In · Tallyard PTW Control" },
      {
        property: "og:description",
        content: "Operator sign-in for the Tallyard permit to work control board.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const status = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate, status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/" });
        else setNotice("ACCOUNT CREATED — CONFIRM VIA THE EMAIL LINK, THEN SIGN IN");
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm border border-border bg-surface">
        <div className="flex h-1.5 w-full">
          <span className="flex-1 bg-st-active" />
          <span className="w-8 bg-st-rejected" />
          <span className="flex-1 bg-st-approved" />
          <span className="w-8 bg-st-closed" />
        </div>
        <div className="px-7 pt-7">
          <div className="font-display text-3xl leading-none tracking-tight">TALLYARD</div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.2em] text-muted">
            PTW · CONTROL ACCESS
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-7 pt-6 pb-7">
          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-muted" htmlFor="email">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-border bg-raised px-3 py-2 text-sm outline-none focus:border-safety"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] tracking-[0.18em] text-muted" htmlFor="password">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-border bg-raised px-3 py-2 text-sm outline-none focus:border-safety"
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="border border-st-rejected/40 bg-st-rejected/10 px-3 py-2 font-mono text-[11px] text-st-rejected"
            >
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="border border-st-approved/40 bg-st-approved/10 px-3 py-2 font-mono text-[11px] text-st-approved">
              {notice}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-safety px-3 py-2.5 font-mono text-[11px] tracking-[0.18em] text-safety-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "WORKING…" : mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="w-full font-mono text-[10px] tracking-[0.15em] text-muted hover:text-foreground"
          >
            {mode === "signin" ? "NO ACCOUNT? REGISTER" : "HAVE AN ACCOUNT? SIGN IN"}
          </button>
        </form>
      </div>
    </div>
  );
}
