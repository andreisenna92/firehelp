import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isManagerRole } from "@/lib/accounts";

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
  isSuperAdmin: boolean;
  loading: boolean;
  recovery: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (_event === "PASSWORD_RECOVERY") setRecovery(true);
      if (_event === "PASSWORD_RECOVERY") window.sessionStorage.setItem("firehelp-recovery", "true");
      if (_event === "SIGNED_OUT") { setRecovery(false); setLoadedUserId(null); }
      if (_event === "SIGNED_OUT") window.sessionStorage.removeItem("firehelp-recovery");
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setRecovery(Boolean(data.session && window.sessionStorage.getItem("firehelp-recovery") === "true"));
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
      setIsSuperAdmin(false);
      return;
    }
    void (async () => {
      const principal = await supabase.rpc("claim_super_admin");
      if (!active) return;
      setIsSuperAdmin(principal.data === true && !principal.error);
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, created_at, blocked, deleted_at")
          .eq("id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!active) return;
      if (profileRes.error || rolesRes.error) {
        setProfile(null);
        setRoles([]);
        setLoadedUserId(userId);
        return;
      }
      if (profileRes.data?.blocked || profileRes.data?.deleted_at) {
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
      setLoadedUserId(userId);
      void supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
    })();
    return () => {
      active = false;
    };
  }, [userId, profileVersion]);

  const value = useMemo<AuthValue>(() => {
    return {
      user: session?.user ?? null,
      session,
      profile,
      roles,
      isStaff: loadedUserId === userId && (isSuperAdmin || isManagerRole(roles)),
      isAdmin: loadedUserId === userId && (isSuperAdmin || isManagerRole(roles)),
      isSuperAdmin: loadedUserId === userId && isSuperAdmin,
      loading: loading || Boolean(userId && loadedUserId !== userId),
      recovery,
      refreshProfile: async () => { setProfileVersion((v) => v + 1); },
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
      },
    };
  }, [session, profile, roles, loading, userId, loadedUserId, recovery, queryClient, isSuperAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
