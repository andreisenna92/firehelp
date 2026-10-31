import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminPostEditor } from "@/components/admin/AdminPostEditor";
import { useForumPosts, useNews, useReports } from "@/hooks/useFirehelp";
import {
  FIRE_STATUSES,
  FIRE_TYPES,
  NEWS_CATEGORIES,
  formatDateTime,
  label,
  slugify,
  statusBadgeClass,
  type FireStatus,
  type FireType,
  type NewsCategory,
} from "@/lib/firehelp";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel de moderação — FIREHELP" },
      {
        name: "description",
        content: "Área restrita para moderação de ocorrências, notícias, fórum e denúncias.",
      },
      { property: "og:title", content: "Painel de moderação — FIREHELP" },
      { property: "og:description", content: "Gestão de ocorrências, notícias e denúncias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isStaff, loading, user, profile } = useAuth();
  const queryClient = useQueryClient();
  const reports = useReports();
  const news = useNews();
  const posts = useForumPosts();

  const denuncias = useQuery({
    queryKey: ["content_reports"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState<NewsCategory>("prevencao");
  const [savingNews, setSavingNews] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [editNewsTitle, setEditNewsTitle] = useState("");
  const [editNewsSummary, setEditNewsSummary] = useState("");
  const [editNewsContent, setEditNewsContent] = useState("");
  const [editNewsImageUrl, setEditNewsImageUrl] = useState("");
  const [editNewsCategory, setEditNewsCategory] = useState<NewsCategory>("prevencao");
  const [savingEditNews, setSavingEditNews] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!isStaff) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva para gerentes da plataforma.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const all = reports.data ?? [];
  const pending = all.filter((r) => r.status === "pending");
  const active = all.filter((r) => r.status === "active");

  async function updateStatus(id: string, status: FireStatus) {
    const { error } = await supabase
      .from("fire_reports")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error("Não foi possível atualizar o status.");
    else {
      toast.success("Status atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["fire_reports"] });
      void queryClient.invalidateQueries({ queryKey: ["community_stats"] });
    }
  }

  async function createNews(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !content.trim()) { toast.error("Título e conteúdo são obrigatórios."); return; }
    setSavingNews(true);
    const { error } = await supabase.from("news").insert({
      title: title.trim(),
      slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`,
      summary: summary.trim() || null,
      content: content.trim(),
      image_url: imageUrl.trim() || null,
      category,
      author_id: user?.id ?? null,
      author_name: profile?.full_name ?? "Equipe FIREHELP",
      published: true,
    });
    setSavingNews(false);
    if (error) {
      toast.error("Não foi possível publicar a notícia.");
      return;
    }
    toast.success("Notícia publicada.");
    setTitle("");
    setSummary("");
    setContent("");
    setImageUrl("");
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }

  async function togglePublished(id: string, published: boolean) {
    await supabase.from("news").update({ published: !published }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }

  function startEditNews(item: { id: string; title: string; summary: string | null; content: string; image_url: string | null; category: string }) {
    setEditingNewsId(item.id);
    setEditNewsTitle(item.title);
    setEditNewsSummary(item.summary ?? "");
    setEditNewsContent(item.content);
    setEditNewsImageUrl(item.image_url ?? "");
    setEditNewsCategory(item.category as NewsCategory);
  }

  async function uploadNewsImage(file: File) {
    if (!user) return;
    const path = `${user.id}/news/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const upload = await supabase.storage.from("fire-images").upload(path, file, { upsert: false });
    if (upload.error) { toast.error("Falha ao enviar a foto."); return; }
    const { data, error } = await supabase.storage.from("fire-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (error || !data?.signedUrl) { toast.error("Não foi possível gerar o endereço da foto."); return; }
    setEditNewsImageUrl(data.signedUrl);
  }

  async function saveEditedNews(event: React.FormEvent) {
    event.preventDefault();
    if (!editingNewsId || !editNewsTitle.trim() || !editNewsContent.trim()) {
      toast.error("Título e conteúdo são obrigatórios.");
      return;
    }
    setSavingEditNews(true);
    const { error } = await supabase.from("news").update({
      title: editNewsTitle.trim(),
      summary: editNewsSummary.trim() || null,
      content: editNewsContent.trim(),
      image_url: editNewsImageUrl.trim() || null,
      category: editNewsCategory,
      updated_at: new Date().toISOString(),
    }).eq("id", editingNewsId);
    setSavingEditNews(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Notícia atualizada.");
    setEditingNewsId(null);
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }

  async function deleteNews(id: string) {
    await supabase.from("news").delete().eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }

  async function deletePost(id: string) {
    await supabase.from("forum_posts").delete().eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["forum_posts"] });
  }

  async function resolveReport(id: string) {
    await supabase.from("content_reports").update({ resolved: true }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["content_reports"] });
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Painel de moderação</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de ocorrências, notícias, fórum e denúncias da comunidade.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <AdminStat label="Pendentes" value={pending.length} />
          <AdminStat label="Ativos" value={active.length} />
          <AdminStat label="Notícias" value={(news.data ?? []).filter((n) => n.published).length} />
          <AdminStat label="Denúncias" value={(denuncias.data ?? []).filter((d) => !d.resolved).length} />
          <AdminStat label="Usuários" value={users.data ?? 0} />
        </div>

        <Tabs defaultValue="ocorrencias">
          <TabsList className="flex-wrap">
            <TabsTrigger value="ocorrencias">Ocorrências</TabsTrigger>
            <TabsTrigger value="noticias">Notícias</TabsTrigger>
            <TabsTrigger value="forum">Fórum</TabsTrigger>
            <TabsTrigger value="denuncias">Denúncias</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="ocorrencias" className="space-y-3 pt-4">
            {all.map((report) => (
              <div key={report.id} className="surface-card space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{label(FIRE_TYPES, report.type as FireType)}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.protocol} · {formatDateTime(report.reported_at)} ·{" "}
                      {report.address ?? "sem endereço"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(report.status as FireStatus)}`}
                  >
                    {label(FIRE_STATUSES, report.status as FireStatus)}
                  </span>
                </div>
                {report.description && <p className="text-sm">{report.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {FIRE_STATUSES.map((status) => (
                    <Button
                      key={status.value}
                      size="sm"
                      variant={report.status === status.value ? "default" : "outline"}
                      onClick={() => updateStatus(report.id, status.value)}
                    >
                      {status.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="noticias" className="space-y-4 pt-4">
            <form onSubmit={createNews} className="surface-card space-y-3 p-4">
              <h2 className="font-semibold">Nova notícia</h2>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Resumo"
              />
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL da imagem (opcional)"
              />
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Conteúdo completo"
                rows={5}
              />
              <div className="flex flex-wrap gap-2">
                {NEWS_CATEGORIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      category === item.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Button type="submit" disabled={savingNews}>
                {savingNews ? "Publicando..." : "Publicar notícia"}
              </Button>
            </form>

            <div className="space-y-2">
              {(news.data ?? []).map((item) => (
                <div
                  key={item.id}
                  className="surface-card flex flex-wrap items-center justify-between gap-2 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.published ? "Publicada" : "Rascunho"} · {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditNews(item as Parameters<typeof startEditNews>[0])}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePublished(item.id, item.published)}
                    >
                      {item.published ? "Despublicar" : "Publicar"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteNews(item.id)}>
                      Excluir
                    </Button>
                  </div>
                {editingNewsId === item.id && (
                  <form onSubmit={saveEditedNews} className="mt-3 w-full space-y-3 border-t pt-3">
                    <Input value={editNewsTitle} onChange={(e) => setEditNewsTitle(e.target.value)} placeholder="Título" />
                    <Input value={editNewsSummary} onChange={(e) => setEditNewsSummary(e.target.value)} placeholder="Resumo" />
                    <Textarea value={editNewsContent} onChange={(e) => setEditNewsContent(e.target.value)} placeholder="Conteúdo" rows={5} />
                    <div className="flex flex-wrap gap-2">
                      {NEWS_CATEGORIES.map((option) => (
                        <button key={option.value} type="button" onClick={() => setEditNewsCategory(option.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${editNewsCategory === option.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input type="file" accept="image/*" className="max-w-xs" onChange={(e) => e.target.files?.[0] && uploadNewsImage(e.target.files[0])} />
                      <Input value={editNewsImageUrl} onChange={(e) => setEditNewsImageUrl(e.target.value)} placeholder="URL da foto" className="min-w-[240px] flex-1" />
                    </div>
                    {editNewsImageUrl && <img src={editNewsImageUrl} alt="Prévia da notícia" className="h-40 w-full max-w-md rounded-lg object-cover" />}
                    <div className="flex gap-2">
                      <Button type="submit" disabled={savingEditNews}>{savingEditNews ? "Salvando..." : "Salvar alterações"}</Button>
                      <Button type="button" variant="ghost" onClick={() => setEditingNewsId(null)}>Cancelar</Button>
                    </div>
                  </form>
                )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="forum" className="space-y-2 pt-4">
            {(posts.data ?? []).map((post) => (
              <div
                key={post.id}
                className="surface-card flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.author_name ?? "Membro"} · {formatDateTime(post.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(post.id)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deletePost(post.id)}>
                    Remover
                  </Button>
                </div>
                {editing === post.id && (
                  <AdminPostEditor post={post} onDone={() => setEditing(null)} />
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="usuarios" className="pt-4">
            <AdminUsers />
          </TabsContent>

          <TabsContent value="denuncias" className="space-y-2 pt-4">
            {(denuncias.data ?? []).map((item) => (
              <div
                key={item.id}
                className="surface-card flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.reason} · <span className="text-muted-foreground">{item.target_type}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.created_at)} · {item.resolved ? "Resolvida" : "Aberta"}
                  </p>
                </div>
                {!item.resolved && (
                  <Button size="sm" variant="outline" onClick={() => resolveReport(item.id)}>
                    Marcar como resolvida
                  </Button>
                )}
              </div>
            ))}
            {(denuncias.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma denúncia registrada.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function AdminStat({ label: text, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{text}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
