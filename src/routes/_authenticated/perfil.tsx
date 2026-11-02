import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, MessageSquare, Sparkles, ThumbsUp, Camera } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyReports } from "@/hooks/useFirehelp";
import {
  FIRE_STATUSES,
  FIRE_TYPES,
  formatDate,
  formatDateTime,
  label,
  statusBadgeClass,
  type FireStatus,
  type FireType,
} from "@/lib/firehelp";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — FIREHELP" },
      {
        name: "description",
        content: "Acompanhe suas ocorrências reportadas, tópicos criados e contribuições no FIREHELP.",
      },
      { property: "og:title", content: "Meu perfil — FIREHELP" },
      {
        property: "og:description",
        content: "Suas ocorrências, tópicos e contribuições na comunidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, isStaff, refreshProfile } = useAuth();
  const photoInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error("Escolha uma foto JPG, PNG ou WebP de até 5 MB."); return; }
    setUploading(true);
    try {
      const path = `${user.id}/avatars/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const upload = await supabase.storage.from("fire-images").upload(path, file);
      if (upload.error) { toast.error("Não foi possível enviar a foto."); return; }
      const signed = await supabase.storage.from("fire-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed.error || !signed.data?.signedUrl) { toast.error("Não foi possível salvar a foto."); return; }
      const update = await supabase.from("profiles").update({ avatar_url: signed.data.signedUrl }).eq("id", user.id);
      if (update.error) { toast.error("Não foi possível atualizar seu perfil."); return; }
      await refreshProfile();
      toast.success("Foto de perfil atualizada.");
    } finally { setUploading(false); }
  }
  const reports = useMyReports(user?.id ?? null);

  const stats = useQuery({
    queryKey: ["profile_stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { posts: 0, comments: 0 };
      const [posts, comments] = await Promise.all([
        supabase
          .from("forum_posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("forum_comments")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);
      return { posts: posts.count ?? 0, comments: comments.count ?? 0 };
    },
  });

  const reportCount = reports.data?.length ?? 0;
  const contributions = reportCount + (stats.data?.posts ?? 0) + (stats.data?.comments ?? 0);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <div className="surface-card flex flex-wrap items-center gap-4 p-5">
          <Avatar className="size-16 border border-border">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.full_name} />
            <AvatarFallback>{(profile?.full_name ?? "U").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Foto de perfil" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAvatar(file); e.target.value = ""; }} />
          <Button size="icon" variant="ghost" title="Alterar foto de perfil" aria-label="Alterar foto de perfil" disabled={uploading} onClick={() => photoInput.current?.click()}><Camera className="size-4" /></Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{profile?.full_name ?? "Meu perfil"}</h1>
            <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
            <p className="text-xs text-muted-foreground">
              Na comunidade desde {formatDate(profile?.created_at)} ·{" "}
              {isStaff ? "Gerente" : "Membro"}
            </p>
          </div>
          <Button asChild variant="default">
            <Link to="/reportar">
              <Flame className="size-4" /> Reportar
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat icon={<Flame className="size-4 text-alert" />} label="Incêndios reportados" value={reportCount} />
          <MiniStat icon={<MessageSquare className="size-4 text-primary" />} label="Tópicos criados" value={stats.data?.posts ?? 0} />
          <MiniStat icon={<ThumbsUp className="size-4 text-ember" />} label="Comentários" value={stats.data?.comments ?? 0} />
          <MiniStat icon={<Sparkles className="size-4 text-success" />} label="Contribuições" value={contributions} />
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Minhas ocorrências</h2>
          {reports.isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : reportCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não registrou ocorrências.
            </p>
          ) : (
            <div className="space-y-3">
              {(reports.data ?? []).map((report) => (
                <div key={report.id} className="surface-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{label(FIRE_TYPES, report.type as FireType)}</p>
                      <p className="text-xs text-muted-foreground">
                        Protocolo {report.protocol} · {formatDateTime(report.reported_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(report.status as FireStatus)}`}
                    >
                      {label(FIRE_STATUSES, report.status as FireStatus)}
                    </span>
                  </div>
                  {report.description && <p className="mt-2 text-sm">{report.description}</p>}
                  {report.fire_report_images?.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {report.fire_report_images.map((image) => (
                        <img
                          key={image.image_url}
                          src={image.image_url}
                          alt="Foto da ocorrência"
                          className="h-20 w-28 shrink-0 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function MiniStat({
  icon,
  label: text,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span className="truncate">{text}</span>
      </div>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
