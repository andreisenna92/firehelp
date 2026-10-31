import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { passwordSchema } from "@/lib/accounts";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Definir nova senha — FIREHELP Saquarema" },
    { name: "description", content: "Recupere com segurança o acesso à sua conta FIREHELP." },
    { property: "og:title", content: "Definir nova senha — FIREHELP" },
    { property: "og:description", content: "Recuperação segura da sua conta FIREHELP Saquarema." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { user, recovery } = useAuth();
  const navigate = useNavigate();
  const [fromRecoveryLink, setFromRecoveryLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setFromRecoveryLink(hash.get("type") === "recovery");
  }, []);
  const allowed = Boolean(user && (recovery || fromRecoveryLink));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!allowed) return;
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira a senha."); return; }
    if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const result = await supabase.auth.updateUser({ password: parsed.data });
      if (result.error) { toast.error("Não foi possível alterar a senha. Solicite um novo link ou tente outra senha."); return; }
      toast.success("Senha atualizada.");
      await navigate({ to: "/perfil", replace: true });
    } catch { toast.error("Não foi possível alterar a senha."); }
    finally { setBusy(false); }
  }
  return <div className="flex min-h-screen items-center justify-center px-6 py-16">
    <div className="w-full max-w-sm space-y-6">
      <Logo />
      <h1 className="text-2xl font-bold">Definir nova senha</h1>
      {allowed ? <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando..." : "Salvar senha"}</Button>
      </form> : <p role="status" className="text-sm text-muted-foreground">Abra o link recebido por e-mail. Se ele expirou, solicite uma nova recuperação de senha.</p>}
      <Button asChild variant="outline" className="w-full"><Link to="/auth">Voltar para entrar</Link></Button>
    </div>
  </div>;
}