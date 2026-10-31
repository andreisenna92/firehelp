import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { registrationSchema, emailSchema } from "@/lib/accounts";
import { registerAccount } from "@/lib/accounts.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { SafetyNotice } from "@/components/SafetyNotice";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — FIREHELP" },
      {
        name: "description",
        content: "Acesse o FIREHELP para reportar incêndios e participar da comunidade de Saquarema.",
      },
      { property: "og:title", content: "Entrar no FIREHELP" },
      {
        property: "og:description",
        content: "Acesse com e-mail e senha e ajude a proteger Saquarema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, recovery } = useAuth();
  const register = useServerFn(registerAccount);
  const [mode, setMode] = useState<"login" | "signup" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: recovery ? "/reset-password" : "/", replace: true });
  }, [user, loading, recovery, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) { toast.error("Informe um e-mail válido."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = registrationSchema.safeParse({ fullName, cpf, email, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira seus dados."); return; }
        const result = await register({ data: parsed.data });
        if (result.error) { toast.error(result.error); return; }
        setCpf(""); setPassword("");
        if (result.session) {
          const session = await supabase.auth.setSession(result.session);
          if (session.error) { toast.error("Cadastro recebido. Entre novamente para continuar."); return; }
          await navigate({ to: "/", replace: true });
        } else setNotice("Cadastro recebido. Confira seu e-mail para confirmar a conta antes de entrar. Se já possui conta, recupere sua senha.");
      } else if (mode === "recovery") {
        const result = await supabase.auth.resetPasswordForEmail(parsedEmail.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) { toast.error("Não foi possível enviar o e-mail de recuperação. Tente novamente."); return; }
        setNotice("Se houver uma conta com esse e-mail, você receberá um link para definir sua senha.");
      } else {
        const result = await supabase.auth.signInWithPassword({ email: parsedEmail.data, password });
        if (result.error) { toast.error("Não foi possível entrar. Confira e-mail, senha e confirmação da conta."); return; }
        await navigate({ to: "/", replace: true });
      }
    } catch { toast.error("Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hero-institutional hidden flex-col justify-between p-12 lg:flex">
        <Logo />
        <div className="space-y-4">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">
            Informação que protege.
            <br />
            Comunidade que ajuda.
          </h1>
          <p className="max-w-md text-hero-foreground/75">
            Reporte focos de incêndio em segundos, acompanhe ocorrências no mapa e troque
            informações de prevenção com moradores de Saquarema.
          </p>
        </div>
        <p className="text-xs text-hero-foreground/60">
          Em emergências, acione os Bombeiros (193) ou a Defesa Civil (199).
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{mode === "signup" ? "Criar conta no FIREHELP" : mode === "recovery" ? "Recuperar senha" : "Entrar no FIREHELP"}</h2>
            <p className="text-sm text-muted-foreground">{mode === "signup" ? "Seu CPF permanece protegido e não aparece para outros membros." : mode === "recovery" ? "Informe o e-mail da sua conta." : "Acesse com seu e-mail e senha."}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && <>
              <div className="space-y-2"><Label htmlFor="full-name">Nome completo</Label><Input id="full-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required /></div>
              <div className="space-y-2"><Label htmlFor="cpf">CPF</Label><Input id="cpf" inputMode="numeric" autoComplete="off" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} required /></div>
            </>}
            <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required /></div>
            {mode !== "recovery" && <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={mode === "signup" ? 8 : 1} maxLength={128} required /></div>}
            {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
            <Button size="xl" className="w-full" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "recovery" ? "Enviar link" : "Entrar"}</Button>
          </form>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setNotice(""); }}>{mode === "signup" ? "Já tenho conta" : "Criar conta"}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setMode(mode === "recovery" ? "login" : "recovery"); setNotice(""); }}>{mode === "recovery" ? "Voltar para entrar" : "Esqueci minha senha"}</Button>
          </div>

          <SafetyNotice />

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/" className="underline underline-offset-4 hover:text-foreground">
              Explorar sem entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

