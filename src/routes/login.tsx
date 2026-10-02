import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Tallyard PTW Control" },
      {
        name: "description",
        content: "Sign in to create and manage permit-to-work records.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPending(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setPending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const next = new URLSearchParams(location.search).get("next");

    await navigate({
      to: next?.startsWith("/") ? next : "/",
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-md border border-border bg-surface">
        <div className="flex h-1.5 w-full">
          <span className="flex-1 bg-st-active" />
          <span className="w-8 bg-st-rejected" />
          <span className="flex-1 bg-st-approved" />
          <span className="w-8 bg-st-closed" />
        </div>

        <div className="border-b border-border px-6 py-6">
          <div className="font-display text-4xl leading-none tracking-tight">TALLYARD</div>

          <div className="mt-2 font-mono text-[10px] tracking-[0.2em] text-muted">
            PTW · CONTROL / AUTHENTICATION
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div>
            <div className="font-mono text-[11px] tracking-[0.18em] text-safety">SIGN IN</div>

            <h1 className="mt-1 font-display text-3xl leading-none">ACCESS CONTROL ROOM</h1>

            <p className="mt-3 text-sm text-muted">
              Use your provisioned Supabase account to create and manage permits.
            </p>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-mono text-[10px] tracking-[0.15em] text-muted">
              EMAIL
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-safety"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-mono text-[10px] tracking-[0.15em] text-muted">
              PASSWORD
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-safety"
            />
          </label>

          {error ? (
            <div className="border border-st-rejected/40 bg-st-rejected/10 px-3 py-2.5 text-sm text-st-rejected">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full border border-safety bg-safety px-4 py-3 font-mono text-[11px] tracking-[0.14em] text-safety-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "AUTHENTICATING..." : "SIGN IN"}
          </button>

          <p className="border-t border-border pt-4 font-mono text-[10px] leading-relaxed text-muted">
            Accounts and PTW profiles are provisioned by the system administrator. A Supabase
            account must be linked to a PTW profile before creating permits.
          </p>
        </form>
      </div>
    </main>
  );
}
