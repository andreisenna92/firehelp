import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }
    void (async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, created_at, blocked")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!active) return;
      if (profileRes.data?.blocked) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
          window.alert("Sua conta está suspensa. Entre em contato com a gestão do FIREHELP.");
        }
        return;
      }
      setProfile(
        profileRes.data
          ? { ...profileRes.data, email: session?.user.email ?? null }
          : null,
      );
      setRoles((rolesRes.data ?? []).map((r) => r.role as string));
      void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const value = useMemo<AuthValue>(() => {
    return {
      user: session?.user ?? null,
      session,
      profile,
      roles,
      isStaff: roles.includes("admin") || roles.includes("moderator"),
      isAdmin: roles.includes("admin"),
      loading,
      signInWithGoogle: async () => {
        const redirectTo =
          (import.meta.env["VITE_SUPABASE_REDIRECT_URL"] as string | undefined) ||
          window.location.origin;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });
        if (error) return { error: error.message };
        return {};
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
      },
    };
  }, [session, profile, roles, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
