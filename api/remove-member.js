// Exclusão de conta pelo super admin: bloqueia o acesso no banco e remove o
// login (de forma "suave"), preservando posts, comentários e mensagens.
import { sb, send, readJson, PUBLIC_KEY, SECRET } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  if (!SECRET) return send(res, 503, { error: "Exclusão indisponível: falta configurar a chave de servidor na Vercel. Use \"Suspender\" por enquanto." });
  const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { userId } = await readJson(req);
  if (!jwt || !/^[0-9a-f-]{36}$/i.test(String(userId || ""))) return send(res, 400, { error: "Pedido inválido." });

  const asUser = (path, opts = {}) => sb(path, { key: PUBLIC_KEY, bearer: jwt, ...opts });
  const who = await asUser("/auth/v1/user");
  if (!who.ok || !who.data?.id || who.data.id === userId) return send(res, 403, { error: "Sem permissão para excluir esta conta." });
  const isSuper = await asUser("/rest/v1/rpc/is_super_admin", { method: "POST", body: { _user_id: who.data.id } });
  if (!isSuper.ok || isSuper.data !== true) return send(res, 403, { error: "Só o super admin pode excluir contas." });

  const prepared = await asUser("/rest/v1/rpc/prepare_member_removal", { method: "POST", body: { target_id: userId } });
  if (!prepared.ok) return send(res, 400, { error: prepared.data?.message || "Não foi possível excluir." });

  const del = await sb(`/auth/v1/admin/users/${userId}`, { method: "DELETE", body: { should_soft_delete: true } });
  if (!del.ok) return send(res, 500, { error: "O acesso foi bloqueado, mas a exclusão não terminou. Tente de novo." });
  return send(res, 200, { error: null });
}
