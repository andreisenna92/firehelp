import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { removeMember } from "@/lib/accounts.functions";

export function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const remove = useServerFn(removeMember);
  const list = useQuery({
    queryKey: ["admin_members"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, blocked, created_at").is("deleted_at", null).order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      const staff = new Set(
        (r.data ?? []).filter((x) => x.role === "admin" || x.role === "moderator").map((x) => x.user_id),
      );
      return (p.data ?? []).map((m) => ({ ...m, gestor: staff.has(m.id) }));
    },
  });

  async function setBlocked(id: string, blocked: boolean) {
    const { error } = await supabase.from("profiles").update({ blocked }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(blocked ? "Membro suspenso." : "Membro reativado.");
    void qc.invalidateQueries({ queryKey: ["admin_members"] });
  }

  async function setManager(id: string, isManager: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("set_member_manager", { target_id: id, make_manager: !isManager });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(isManager ? "Função de gerente removida." : "Membro promovido a gerente.");
    void qc.invalidateQueries({ queryKey: ["admin_members"] });
  }

  async function deleteMember(id: string) {
    if (!window.confirm("Excluir o acesso deste membro? Publicações, comentários e mensagens serão preservados. Esta ação não pode ser desfeita.")) return;
    setBusy(id);
    try {
      const result = await remove({ data: { userId: id } });
      if (result.error) toast.error(result.error);
      else toast.success("Membro excluído. Contribuições preservadas.");
      void qc.invalidateQueries({ queryKey: ["admin_members"] });
      void qc.invalidateQueries({ queryKey: ["members"] });
    } catch { toast.error("Não foi possível excluir o membro."); }
    finally { setBusy(null); }
  }

  const rows = (list.data ?? []).filter((m) => m.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar membro" />
      {list.error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os membros.</p>}
      {rows.map((m) => (
        <div key={m.id} className="surface-card flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src={m.avatar_url ?? undefined} />
              <AvatarFallback>{m.full_name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{m.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {m.gestor ? "Gerente" : "Membro"} · {m.blocked ? "Suspenso" : "Ativo"}
              </p>
            </div>
          </div>
          {m.id !== user?.id && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => setManager(m.id, m.gestor)}>
                {m.gestor ? "Remover gerente" : "Promover a gerente"}
              </Button>
              <Button size="sm" variant={m.blocked ? "outline" : "destructive"} onClick={() => setBlocked(m.id, !m.blocked)}>
                {m.blocked ? "Reativar" : "Suspender"}
              </Button>
              <Button size="icon" variant="ghost" disabled={busy === m.id} aria-label={`Excluir membro ${m.full_name}`} title="Excluir membro" onClick={() => deleteMember(m.id)}><Trash2 className="size-4" /></Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
