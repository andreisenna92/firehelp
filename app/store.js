// Estado da pessoa conectada: perfil, papéis e permissões.
import { auth, q, rpc, update } from "./sb.js";

export const me = { user: null, profile: null, roles: [], isStaff: false, isSuper: false, ready: false };
const subs = new Set();
export const onMe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach((fn) => fn(me));

let loadingFor = undefined;
export async function loadMe() {
  const user = auth.user;
  if (user?.id === loadingFor && me.ready) return me;
  loadingFor = user?.id ?? null;
  Object.assign(me, { user, profile: null, roles: [], isStaff: false, isSuper: false });
  if (!user) { me.ready = true; emit(); return me; }
  try {
    const [isSuper, profile, roles] = await Promise.all([
      rpc("claim_super_admin").catch(() => false),
      q("profiles", { select: "id,full_name,avatar_url,bio,created_at,blocked,deleted_at", id: `eq.${user.id}` }, { single: true }),
      q("user_roles", { select: "role", user_id: `eq.${user.id}` }),
    ]);
    if (profile?.blocked || profile?.deleted_at) {
      await auth.signOut();
      alert("Sua conta está suspensa. Fale com a gestão do FireHelp.");
      return loadMe();
    }
    const roleList = (roles || []).map((r) => r.role);
    Object.assign(me, {
      profile: profile ? { ...profile, email: user.email } : null,
      roles: roleList,
      isSuper: isSuper === true,
      isStaff: isSuper === true || roleList.includes("admin") || roleList.includes("moderator"),
    });
    update("profiles", { id: `eq.${user.id}` }, { last_seen_at: new Date().toISOString() }).catch(() => {});
  } catch { /* perfil indisponível: segue como membro sem detalhes */ }
  me.ready = true;
  emit();
  return me;
}
export const displayName = () => me.profile?.full_name || me.user?.email?.split("@")[0] || "Membro";

auth.onChange(() => { if ((auth.user?.id ?? null) !== loadingFor) loadMe(); });
