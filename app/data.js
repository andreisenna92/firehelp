// Consultas compartilhadas entre páginas.
import { q, count } from "./sb.js";

export const REPORT_SELECT = "id,protocol,user_id,type,severity,description,latitude,longitude,address,neighborhood,municipality,status,is_demo,reported_at,resolved_at,fire_report_images(image_url)";

// Administradores e o autor também "enxergam" avisos excluídos no banco; aqui eles nunca aparecem.
export const getReports = (extra = {}) => q("fire_reports", { select: REPORT_SELECT, order: "reported_at.desc", published: "eq.true", deleted_at: "is.null", ...extra });
export const getNews = (extra = {}) => q("news", { select: "id,slug,title,summary,category,image_url,author_name,published,created_at", published: "eq.true", slug: "not.like.criador-*", order: "created_at.desc", ...extra });

// "Conheça nossos criadores": cada criador é guardado como uma publicação especial (slug "criador-...")
// para funcionar sem mudar o banco. O conteúdo é um JSON com bio, projetos e links.
export async function getCreators() {
  const rows = await q("news", { select: "id,slug,title,summary,content,image_url,created_at", slug: "like.criador-*", order: "created_at.asc" });
  return rows.map((r) => {
    let d = {};
    try { d = JSON.parse(r.content || "{}"); } catch { d = { bio: r.content || "" }; }
    return { id: r.id, slug: r.slug, nome: r.title, funcao: r.summary || "", foto: r.image_url, bio: d.bio || "", projetos: Array.isArray(d.projetos) ? d.projetos : [], instagram: d.instagram || "", linkedin: d.linkedin || "", site: d.site || "", ordem: Number(d.ordem) || 0, created_at: r.created_at };
  }).sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
}

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
