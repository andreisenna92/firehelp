import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { registrationSchema } from "./accounts";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator(registrationSchema)
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return { error: "Cadastro indisponível. Tente novamente mais tarde.", session: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID() + crypto.randomUUID();
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
    // Expired attempts are never valid and are removed without exposing CPF.
    await supabaseAdmin.from("account_enrollments").delete().lt("expires_at", new Date().toISOString());
    const enrollment = await supabaseAdmin.from("account_enrollments").insert({
      token_hash: tokenHash, cpf: data.cpf, full_name: data.fullName, email: data.email,
    });
    if (enrollment.error) return { error: "Não foi possível cadastrar. Confira seus dados e tente novamente.", session: null };
    const publicClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    try {
      const result = await publicClient.auth.signUp({ email: data.email, password: data.password,
        options: { data: { enrollment_token: token }, emailRedirectTo: `${new URL(getRequest().url).origin}/auth` },
      });
      if (result.error) return { error: "Não foi possível cadastrar. Confira seus dados ou recupere sua senha se já possui conta.", session: null };
      return { error: null, session: result.data.session ? { access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token } : null };
    } finally {
      await supabaseAdmin.from("account_enrollments").delete().eq("token_hash", tokenHash);
    }
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const check = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (check.error || !check.data || data.userId === context.userId) return { error: "Sem permissão para excluir esta conta." };
    // Atomic permission and last-manager checks also revoke access before Auth deletion.
    const prepared = await context.supabase.rpc("prepare_member_removal", { target_id: data.userId });
    if (prepared.error) return { error: prepared.error.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Soft deletion retains UUID references: messages, likes and contributions do not cascade away.
    const result = await supabaseAdmin.auth.admin.deleteUser(data.userId, true);
    if (result.error) return { error: "O acesso foi bloqueado, mas a exclusão não terminou. Tente excluir novamente." };
    return { error: null };
  });