import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
        content: "Acesse o FIREHELP com sua conta Google para reportar incêndios e participar do fórum.",
      },
      { property: "og:title", content: "Entrar no FIREHELP" },
      {
        property: "og:description",
        content: "Acesse com sua conta Google e ajude a proteger sua comunidade.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  async function handleGoogle() {
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error("Não foi possível entrar com o Google. Tente novamente.");
      setBusy(false);
    }
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
          <p className="max-w-md text-white/75">
            Reporte focos de incêndio em segundos, acompanhe ocorrências no mapa e troque
            informações de prevenção com pessoas da sua região.
          </p>
        </div>
        <p className="text-xs text-white/60">
          Em emergências, acione os Bombeiros (193) ou a Defesa Civil (199).
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Entrar no FIREHELP</h2>
            <p className="text-sm text-muted-foreground">
              Use sua conta Google. Seu perfil é criado automaticamente no primeiro acesso.
            </p>
          </div>

          <Button
            size="xl"
            variant="default"
            className="w-full"
            onClick={handleGoogle}
            disabled={busy}
          >
            <GoogleIcon />
            {busy ? "Conectando..." : "Entrar com Google"}
          </Button>

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C39.1 36.5 44 31 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}
