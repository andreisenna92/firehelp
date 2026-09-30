import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PRIMARY_MANAGER_EMAIL = "luisandreisenna@gmail.com";

export function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin_members"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url, blocked, created_at").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
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

  async function setManager(id: string, manager: boolean) {
    if (manager) {
      const { error } = await supabase.from("user_roles").upsert({ user_id: id, role: "admin" }, { onConflict: "user_id,role" });
      if (error) { toast.error("Não foi possível promover este membro."); return; }
      toast.success("Membro promovido a gestor.");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
      if (error) { toast.error("Não foi possível remover a gestão."); return; }
      toast.success("Permissão de gestor removida.");
    }
    void qc.invalidateQueries({ queryKey: ["admin_members"] });
  }

  const rows = (list.data ?? []).filter((m) =>
    `${m.full_name} ${m.email ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" />
      {rows.map((m) => {
        const primaryManager = m.email?.toLowerCase() === PRIMARY_MANAGER_EMAIL;
        const canManage = m.id !== user?.id && !primaryManager;
        return (
          <div key={m.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback>{m.full_name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{m.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email ?? "E-mail não informado"}</p>
                <p className="text-xs text-muted-foreground">
                  {primaryManager || m.gestor ? "Gestor" : "Membro"} · {m.blocked ? "Suspenso" : "Ativo"}
                </p>
              </div>
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setManager(m.id, !m.gestor)}>
                  {m.gestor ? "Remover gestor" : "Promover a gestor"}
                </Button>
                <Button size="sm" variant={m.blocked ? "outline" : "destructive"} onClick={() => setBlocked(m.id, !m.blocked)}>
                  {m.blocked ? "Reativar" : "Suspender"}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
