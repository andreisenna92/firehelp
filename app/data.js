// Consultas compartilhadas entre páginas.
import { q, count } from "./sb.js";

export const REPORT_SELECT = "id,protocol,user_id,type,severity,description,latitude,longitude,address,neighborhood,municipality,status,is_demo,reported_at,resolved_at,fire_report_images(image_url)";

// Administradores e o autor também "enxergam" avisos excluídos no banco; aqui eles nunca aparecem.
export const getReports = (extra = {}) => q("fire_reports", { select: REPORT_SELECT, order: "reported_at.desc", published: "eq.true", deleted_at: "is.null", ...extra });
export const getNews = (extra = {}) => q("news", { select: "id,slug,title,summary,category,image_url,author_name,published,created_at", published: "eq.true", order: "created_at.desc", ...extra });

export async function getStats() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [active, todayN, resolved, people] = await Promise.all([
    count("fire_reports", { status: "eq.active", published: "eq.true", deleted_at: "is.null" }),
    count("fire_reports", { reported_at: `gte.${today.toISOString()}`, published: "eq.true", deleted_at: "is.null" }),
    count("fire_reports", { status: "eq.resolved", published: "eq.true", deleted_at: "is.null" }),
    count("profiles", { deleted_at: "is.null" }),
  ]);
  return { active, today: todayN, resolved, people };
}

// Busca nome e foto de vários autores numa única consulta.
const profileCache = new Map();
export async function profilesFor(ids) {
  const missing = [...new Set(ids.filter((id) => id && !profileCache.has(id)))];
  if (missing.length) {
    try {
      const rows = await q("profiles", { select: "id,full_name,avatar_url", id: `in.(${missing.join(",")})` });
      rows.forEach((p) => profileCache.set(p.id, p));
    } catch { /* sem foto: usa inicial */ }
    missing.forEach((id) => { if (!profileCache.has(id)) profileCache.set(id, null); });
  }
  return (id) => profileCache.get(id) || null;
}
export const forgetProfile = (id) => profileCache.delete(id);
