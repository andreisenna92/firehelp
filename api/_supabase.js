// Ajudantes para as funções de servidor (rodam na Vercel, nunca no navegador).
export const URL_ = process.env.SUPABASE_URL || "https://c--81bb57ea-0a3d-4324-a8f4-33d6e0715eb8-prod.lovable.cloud";
export const PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Hl6BL1qmBzTRgyEEMu9O5g_yStldCSO";
export const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authHeaders = (key) => (key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key });

export async function sb(path, { key = SECRET, method = "GET", body, headers = {}, bearer } = {}) {
  const h = { ...authHeaders(key), ...headers };
  if (bearer) h.Authorization = `Bearer ${bearer}`;
  if (body !== undefined) h["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    console.error("supabase fetch", path, e.message, e.cause?.code || "");
    return { ok: false, status: 0, data: { message: e.message, code: e.cause?.code } };
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}
