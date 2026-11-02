import { html, icon, lbl, NEWS_CATS, fmtDate, paragraphs, skeleton, errorBox, toast } from "../ui.js";
import { q } from "../sb.js";
import { getNews } from "../data.js";
import { newsCard } from "./home.js";
import { me, loadMe } from "../store.js";
import { remove } from "../sb.js";
import { confirmDialog } from "../ui.js";
import { go } from "../main.js";

export default async function noticia({ el, params }) {
  el.innerHTML = html`<article class="wrap narrow pad">${skeleton(1, 320)}</article>`.s;
  await (me.ready ? null : loadMe());
  let n;
  try { n = await q("news", { select: "*", slug: `eq.${params.slug}` }, { single: true }); }
  catch { el.innerHTML = html`<section class="wrap narrow pad">${errorBox()}</section>`.s; return; }
  if (!n) {
    el.innerHTML = html`<section class="wrap narrow pad"><a class="back" href="/noticias">${icon("back")} Notícias</a><h1 class="h1">Notícia não encontrada.</h1><p class="lead">Ela pode ter sido removida ou o endereço mudou.</p></section>`.s;
    return;
  }
  document.title = `${n.title} · FireHelp Saquarema`;
  el.innerHTML = html`<article class="wrap narrow pad">
    <a class="back" href="/noticias">${icon("back")} Notícias</a>
    <div class="row small muted" style="margin-bottom:12px"><span class="tag ${n.category === "alertas" ? "tag-gold" : ""}">${lbl(NEWS_CATS, n.category)}</span> ${fmtDate(n.created_at)}${n.author_name ? ` · por ${n.author_name}` : ""}</div>
    <h1 class="h1">${n.title}</h1>
    ${n.summary ? html`<p class="lead">${n.summary}</p>` : ""}
    ${n.image_url ? html`<div class="article-hero"><img src="${n.image_url}" alt=""></div>` : html`<div style="height:22px"></div>`}
    <div class="prose">${paragraphs(n.content)}</div>
    <div class="row" style="margin-top:24px"><button class="btn btn-line btn-sm" id="share">${icon("share")} Compartilhar</button><a class="btn btn-quiet btn-sm" href="/comunidade">Comentar na comunidade</a>${me.isStaff ? html`<a class="btn btn-line btn-sm" href="/admin?aba=noticias&editar=${n.id}">${icon("edit")} Editar</a><button class="btn btn-danger btn-sm" id="del-news">${icon("trash")} Excluir</button>` : ""}</div>
  </article>
  <section class="wrap section" id="more"></section>`.s;
  el.querySelector("#del-news")?.addEventListener("click", async () => {
    if (!(await confirmDialog(`Excluir "${n.title}"? Não dá para desfazer.`, { ok: "Excluir", danger: true }))) return;
    try { await remove("news", { id: `eq.${n.id}` }); toast("Notícia excluída."); go("/noticias"); }
    catch { toast("Não foi possível excluir.", "err"); }
  });
  el.querySelector("#share").addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: n.title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast("Link copiado."); }
    } catch { /* cancelado */ }
  });
  getNews({ limit: 4, id: `neq.${n.id}` }).then((rows) => {
    const more = rows.slice(0, 3);
    if (more.length) el.querySelector("#more").innerHTML = html`<div class="section-head"><h2 class="h2">Leia também</h2></div><div class="news-grid">${more.map((x) => newsCard(x))}</div>`.s;
  }).catch(() => {});
}
