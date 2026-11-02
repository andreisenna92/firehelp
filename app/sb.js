// Cliente mínimo para o Supabase (REST, Auth e Storage) — substitui a
// biblioteca supabase-js (~50 kB) por algumas dezenas de linhas.
import { SUPABASE_URL as URL_, SUPABASE_KEY as KEY, BUCKET } from "./config.js";

const STORE = "fh-session";
let session = load();
const listeners = new Set();

function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; }
}
function save(next) {
  session = next;
  try { next ? localStorage.setItem(STORE, JSON.stringify(next)) : localStorage.removeItem(STORE); } catch { /* modo privado */ }
  listeners.forEach((fn) => fn(session));
}
function fromTokenResponse(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
    user: data.user,
  };
}

export class ApiError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}

let refreshing = null;
async function token() {
  if (!session) return null;
  if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  refreshing ??= (async () => {
    try {
      const data = await raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: session.refresh_token }, anon: true });
      save(fromTokenResponse(data));
    } catch { save(null); }
    finally { refreshing = null; }
  })();
  await refreshing;
  return session?.access_token ?? null;
}

async function raw(path, { method = "GET", body, headers = {}, anon = false, rawBody = false } = {}) {
  const h = { apikey: KEY, ...headers };
  if (!anon) { const t = await token(); if (t) h.Authorization = `Bearer ${t}`; }
  if (body !== undefined && !rawBody) h["Content-Type"] = "application/json";
  const res = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : rawBody ? body : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `Erro ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return { data, res };
}
async function call(path, opts) { return (await raw(path, opts)).data; }

/* ---------- consultas (PostgREST) ---------- */
// q("news", { select: "*", order: "created_at.desc", category: "eq.alertas" })
export async function q(table, params = {}, { count = false, single = false } = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.append(k, v);
  const headers = {};
  if (count) headers.Prefer = "count=exact";
  if (single) headers.Accept = "application/vnd.pgrst.object+json";
  try {
    const { data, res } = await raw(`/rest/v1/${table}?${qs}`, { headers });
    if (count) return { data, count: Number(res.headers.get("content-range")?.split("/")[1] ?? 0) };
    return data;
  } catch (e) {
    if (single && e.status === 406) return null; // nenhum registro
    throw e;
  }
}
export async function count(table, params = {}) {
  const qs = new URLSearchParams({ select: "id", limit: "1", ...params });
  const { res } = await raw(`/rest/v1/${table}?${qs}`, { headers: { Prefer: "count=exact" } });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}
export const insert = (table, row, select = "*") =>
  call(`/rest/v1/${table}?select=${encodeURIComponent(select)}`, { method: "POST", body: row, headers: { Prefer: "return=representation" } });
export const update = (table, filter, patch) =>
  call(`/rest/v1/${table}?${new URLSearchParams(filter)}`, { method: "PATCH", body: patch, headers: { Prefer: "return=representation" } });
export const remove = (table, filter) =>
  call(`/rest/v1/${table}?${new URLSearchParams(filter)}`, { method: "DELETE", headers: { Prefer: "return=representation" } });
export const rpc = (fn, args = {}) => call(`/rest/v1/rpc/${fn}`, { method: "POST", body: args });

/* ---------- arquivos (Storage) ---------- */
export async function upload(path, file) {
  await call(`/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST", body: file, rawBody: true,
    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false", "cache-control": "max-age=31536000" },
  });
  const signed = await call(`/storage/v1/object/sign/${BUCKET}/${path}`, { method: "POST", body: { expiresIn: 60 * 60 * 24 * 365 * 5 } });
  const rel = signed.signedURL || signed.signedUrl;
  return rel.startsWith("http") ? rel : `${URL_}/storage/v1${rel}`;
}

/* ---------- autenticação ---------- */
export const auth = {
  get session() { return session; },
  get user() { return session?.user ?? null; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async signIn(email, password) {
    const data = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password }, anon: true });
    save(fromTokenResponse(data));
  },
  setSession(tokens) { save(fromTokenResponse(tokens)); return this.refreshUser(); },
  async refreshUser() {
    if (!session) return null;
    try { const user = await call("/auth/v1/user"); save({ ...session, user }); return user; }
    catch { save(null); return null; }
  },
  recover: (email, redirectTo) =>
    call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: "POST", body: { email }, anon: true }),
  googleUrl: (redirectTo) => `${URL_}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
  // Verifica se o login com Google está configurado no banco antes de mandar a pessoa para lá.
  async googleReady(redirectTo) {
    try {
      const r = await fetch(this.googleUrl(redirectTo), { redirect: "manual", headers: { apikey: KEY } });
      return r.type === "opaqueredirect" || (r.status >= 300 && r.status < 400);
    } catch { return true; }
  },
  updatePassword: (password) => call("/auth/v1/user", { method: "PUT", body: { password } }),
  async signOut() {
    try { await call("/auth/v1/logout", { method: "POST" }); } catch { /* sessão já expirada */ }
    save(null);
  },
  // Links de e-mail (confirmação e recuperação) chegam com os tokens no #hash.
  async consumeUrlHash() {
    if (!location.hash.includes("access_token")) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    const type = p.get("type") || "oauth";
    history.replaceState(null, "", location.pathname + location.search);
    await this.setSession({ access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: Number(p.get("expires_in") || 3600) });
    return type;
  },
};
