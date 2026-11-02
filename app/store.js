// Estado da pessoa conectada: perfil, papéis e permissões.
import { auth, q, rpc, update } from "./sb.js";

export const me = { user: null, profile: null, roles: [], isStaff: false, isSuper: false, needsCpf: false, ready: false };
const subs = new Set();
export const onMe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach((fn) => fn(me));

let loadingFor = undefined;
let pending = null;
// Carrega (ou reaproveita a carga em andamento) dos dados da pessoa conectada.
export function loadMe() {
  const id = auth.user?.id ?? null;
  if (pending && id === loadingFor) return pending;
  if (!pending && id === loadingFor && me.ready) return Promise.resolve(me);
  pending = fetchMe().finally(() => { pending = null; });
  return pending;
}
async function fetchMe() {
  const user = auth.user;
  loadingFor = user?.id ?? null;
  me.ready = false;
  Object.assign(me, { user, profile: null, roles: [], isStaff: false, isSuper: false, needsCpf: false });
  if (!user) { me.ready = true; emit(); return me; }
  try {
    const [isSuper, profile, roles, needsCpf] = await Promise.all([
      rpc("claim_super_admin").catch(() => false),
      q("profiles", { select: "id,full_name,avatar_url,bio,created_at,blocked,deleted_at", id: `eq.${user.id}` }, { single: true }),
      q("user_roles", { select: "role", user_id: `eq.${user.id}` }),
      rpc("needs_identity", { _user_id: user.id }).catch(() => false), // sem a função no banco: não bloqueia
    ]);
    if (loadingFor !== user.id) return me; // outra pessoa entrou enquanto carregava
    if (profile?.blocked || profile?.deleted_at) {
      await auth.signOut();
      alert("Sua conta está suspensa. Fale com a gestão do FireHelp.");
      return fetchMe();
    }
    const roleList = (roles || []).map((r) => r.role);
    Object.assign(me, {
      profile: profile ? { ...profile, email: user.email } : null,
      roles: roleList,
      isSuper: isSuper === true,
      isStaff: isSuper === true || roleList.includes("admin") || roleList.includes("moderator"),
    });
    me.needsCpf = needsCpf === true && !me.isStaff;
    update("profiles", { id: `eq.${user.id}` }, { last_seen_at: new Date().toISOString() }).catch(() => {});
  } catch { /* perfil indisponível: segue como membro sem detalhes */ }
  me.ready = true;
  emit();
  return me;
}
export const displayName = () => me.profile?.full_name || me.user?.email?.split("@")[0] || "Membro";

auth.onChange(() => { if ((auth.user?.id ?? null) !== loadingFor) loadMe(); });
