import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading };
}

export function initials(nameOrEmail: string) {
  const base = nameOrEmail.split("@")[0]!.replace(/[._-]+/g, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : base.slice(0, 2)).toUpperCase();
}

/** Turn Supabase auth errors into short, operator-readable text. */
export function authErrorMessage(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "INVALID EMAIL OR PASSWORD";
  if (m.includes("email logins are disabled")) return "EMAIL SIGN-IN IS TURNED OFF FOR THIS BACKEND";
  if (m.includes("email not confirmed")) return "EMAIL NOT CONFIRMED — CHECK YOUR INBOX";
  if (m.includes("rate limit")) return "TOO MANY ATTEMPTS — TRY AGAIN SHORTLY";
  return message.toUpperCase();
}
