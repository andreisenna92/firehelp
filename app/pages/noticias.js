import { html, NEWS_CATS, skeleton, errorBox } from "../ui.js";
import { getNews } from "../data.js";
import { newsCard } from "./home.js";

export default async function noticias({ el, query }) {
  let cat = query.get("categoria") || "all";
  el.innerHTML = html`<section class="wrap pad">
    <div class="page-head"><div><h1 class="h1">Notícias e alertas</h1><p class="lead">Avisos da equipe FireHelp sobre risco de incêndio, prevenção e meio ambiente em Saquarema.</p></div></div>
    <div class="scroll-x" style="margin-bottom:22px"><div class="chips" id="cats">
      <button class="chip" data-v="all" aria-pressed="${cat === "all"}">Todas</button>
      ${NEWS_CATS.map(([v, l]) => html`<button class="chip" data-v="${v}" aria-pressed="${cat === v}">${l}</button>`)}
    </div></div>
    <div id="list">${skeleton(2, 240)}</div>
  </section>`.s;
  const list = el.querySelector("#list");

  async function load() {
    list.innerHTML = skeleton(2, 240).s;
    try {
      const rows = await getNews(cat === "all" ? {} : { category: `eq.${cat}` });
      list.innerHTML = rows.length
        ? html`<div class="news-grid">${rows.map((n, i) => newsCard(n, i === 0 && cat === "all"))}</div>`.s
        : html`<div class="empty"><p>Nenhuma notícia nesta categoria por enquanto.</p></div>`.s;
    } catch { list.innerHTML = errorBox().s; }
  }
  el.querySelector("#cats").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    cat = b.dataset.v;
    el.querySelectorAll("#cats .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    history.replaceState(null, "", cat === "all" ? "/noticias" : `/noticias?categoria=${cat}`);
    load();
  });
  load();
}
