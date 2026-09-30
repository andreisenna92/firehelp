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
  signInWithPassword: (credentials: { cpf: string; email: string; password: string }) => Promise<{ error?: string }>;
  signUpWithPassword: (credentials: { cpf: string; email: string; password: string; fullName: string }) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
};

const PRIMARY_MANAGER_EMAIL = "luisandreisenna@gmail.com";

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
      const currentUser = session?.user;
      const metadata = currentUser?.user_metadata ?? {};
      const fullName =
        metadata.full_name ||
        metadata.name ||
        currentUser?.email?.split("@")[0] ||
        "Membro FIREHELP";
      const avatarUrl = metadata.avatar_url || metadata.picture || null;

      await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName,
          email: currentUser?.email ?? null,
          avatar_url: avatarUrl,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );

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
      isStaff:
        roles.includes("admin") ||
        roles.includes("moderator") ||
        session?.user.email?.toLowerCase() === PRIMARY_MANAGER_EMAIL,
      isAdmin: roles.includes("admin") || session?.user.email?.toLowerCase() === PRIMARY_MANAGER_EMAIL,
      loading,
      signInWithGoogle: async () => {
        const redirectTo =
          import.meta.env["VITE_SUPABASE_REDIRECT_URL"] ||
          import.meta.env["NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL"] ||
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${window.location.origin}/auth`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) return { error: "Não foi possível iniciar o login com Google." };
        return {};
      },
      signInWithPassword: async ({ cpf, email, password }) => {
        const normalizedCpf = cpf.replace(/\D/g, "");
        if (normalizedCpf.length !== 11) return { error: "Informe um CPF válido." };
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) return { error: "CPF, e-mail ou senha inválidos." };
        const savedCpf = String(data.user.user_metadata?.cpf ?? "").replace(/\\D/g, "");
        if (savedCpf && savedCpf !== normalizedCpf) {
          await supabase.auth.signOut();
          return { error: "CPF, e-mail ou senha inválidos." };
        }
        return {};
      },
      signUpWithPassword: async ({ cpf, email, password, fullName }) => {
        const normalizedCpf = cpf.replace(/\D/g, "");
        if (normalizedCpf.length !== 11) return { error: "Informe um CPF válido." };
        if (password.length < 6) return { error: "A senha deve ter pelo menos 6 caracteres." };
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = fullName.trim();
        if (!normalizedName) return { error: "Informe seu nome completo." };
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { cpf: normalizedCpf, full_name: normalizedName },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (!error && data.user && data.user.identities?.length === 0) {
          return { error: "Este e-mail já possui uma conta. Use a aba de login." };
        }
        if (error) {
          const errorCode = error.code?.toLowerCase() ?? "";
          const errorMessage = error.message.toLowerCase();
          if (
            errorCode === "user_already_exists" ||
            errorCode === "email_exists" ||
            errorMessage.includes("already registered") ||
            errorMessage.includes("already exists") ||
            errorMessage.includes("user already registered")
          ) {
            return { error: "Este e-mail já possui uma conta. Use a aba Entrar com a mesma senha." };
          }
          if (errorCode === "email_address_invalid" || errorMessage.includes("invalid email")) {
            return { error: "Informe um e-mail válido." };
          }
          if (errorCode === "weak_password" || errorMessage.includes("password should be at least")) {
            return { error: "A senha deve ter pelo menos 6 caracteres." };
          }
          if (errorCode === "over_email_send_rate_limit" || errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
            return { error: "O limite de envio de e-mails foi atingido. Aguarde alguns minutos antes de tentar novamente." };
          }
          if (errorCode === "signup_disabled" || errorMessage.includes("signups not allowed")) {
            return { error: "O cadastro está temporariamente desativado no serviço de autenticação." };
          }
          if (errorMessage.includes("database error saving new user")) {
            return { error: "O cadastro foi bloqueado pela configuração do banco. É necessário corrigir a tabela de perfis no Supabase." };
          }
          return { error: "Não foi possível criar sua conta agora. Tente outro e-mail ou entre com uma conta já criada." };
        }
        return { needsConfirmation: !data.session };
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
