import { html, icon, raw, statusBadge, lbl, FIRE_TYPES, ago, NEWS_CATS, isVideo, fmtDate, skeleton } from "../ui.js";
import { getReports, getNews, getStats } from "../data.js";
import { createMap, pinIcon, reportPopup } from "../map.js";

export function occRow(r) {
  const media = r.fire_report_images?.find((m) => !isVideo(m.image_url))?.image_url;
  return html`<a class="occ" href="/mapa?o=${r.id}">
    <span class="occ-ic ${r.status === "active" ? "st-active" : ""}">${icon("flame")}</span>
    <span class="occ-main">
      <b>${lbl(FIRE_TYPES, r.type)} ${statusBadge(r.status)}</b>
      <span>${r.neighborhood || shortAddr(r.address) || "Local marcado no mapa"} · ${ago(r.reported_at)}</span>
    </span>
    ${media ? html`<img class="occ-thumb" src="${media}" alt="" loading="lazy">` : html`<span></span>`}
  </a>`;
}
export const shortAddr = (a) => (a ? a.split(",").slice(0, 2).join(",") : "");

export function newsCard(n, leadStory = false) {
  return html`<a class="news-card ${leadStory ? "lead-story" : ""}" href="/noticias/${n.slug}">
    <div class="ph">${n.image_url ? html`<img src="${n.image_url}" alt="" loading="lazy">` : ""}</div>
    <div class="stack" style="gap:8px">
      <div class="meta"><span class="tag ${n.category === "alertas" ? "tag-gold" : ""}">${lbl(NEWS_CATS, n.category)}</span>${fmtDate(n.created_at)}</div>
      <h3>${n.title}</h3>
      ${n.summary ? html`<p>${n.summary}</p>` : ""}
    </div>
  </a>`;
}

export default async function home({ el }) {
  el.innerHTML = html`
  <section class="hero">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <h1 class="display">Viu fumaça em Saquarema? Avise agora.</h1>
        <p class="lead">O FireHelp junta moradores para avisar focos de incêndio com foto, vídeo e localização, acompanhar cada ocorrência no mapa e prevenir o próximo fogo.</p>
        <div class="hero-cta">
          <a class="btn btn-fire btn-lg" href="/reportar">${icon("flame")} Reportar um foco</a>
          <a class="btn btn-line btn-lg" href="/mapa">${icon("map")} Ver o mapa</a>
        </div>
        <p class="hero-note">${icon("phone")} <span>Fogo perto de pessoas, casas ou animais? <a href="tel:193"><b>Ligue 193</b></a> primeiro e depois registre aqui para avisar os vizinhos.</span></p>
      </div>
      <div class="situation" aria-label="Situação atual em Saquarema">
        <div class="sit-head">
          <span class="sit-title"><span class="live-dot" id="live"></span> Agora em Saquarema</span>
          <div class="sit-nums" id="nums">
            <div class="hot"><b>–</b><small>focos ativos</small></div>
            <div><b>–</b><small>avisos hoje</small></div>
            <div><b>–</b><small>resolvidos</small></div>
          </div>
        </div>
        <div class="map" id="home-map" role="region" aria-label="Mapa das ocorrências"></div>
        <img class="sit-mimo" src="/assets/mimo-pointing.webp" alt="" width="120" height="180">
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2 class="h2" style="margin-bottom:14px">Como avisar um foco</h2>
      <div class="steps">
        <div class="step"><span class="step-n">1</span><h3 class="h3">Registre de longe</h3><p>Tire uma foto ou grave um vídeo curto sem se aproximar do fogo. Fumaça já é suficiente.</p></div>
        <div class="step"><span class="step-n">2</span><h3 class="h3">Marque o local</h3><p>Use sua localização ou toque no mapa. Diga o tipo e o tamanho do fogo.</p></div>
        <div class="step"><span class="step-n">3</span><h3 class="h3">Acompanhe</h3><p>Você recebe um protocolo e vê a ocorrência mudar de status até ser resolvida.</p></div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:8px">
    <div class="wrap">
      <div class="section-head"><h2 class="h2">Últimos avisos</h2><a href="/mapa">Abrir o mapa completo</a></div>
      <div id="recent">${skeleton(3, 70)}</div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head"><h2 class="h2">Notícias e alertas</h2><a href="/noticias">Ver todas</a></div>
      <div id="news">${skeleton(1, 220)}</div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="mimo-band">
        <img src="/assets/mimo-thumbs.webp" alt="Mimo, o mico-leão-dourado bombeiro" width="180" height="270" loading="lazy">
        <div>
          <h2 class="h2">O Mimo lembra: a maioria dos incêndios começa pequeno.</h2>
          <ul class="tips">
            <li>${icon("check")} Não queime lixo, folhas ou entulho — em Saquarema a vegetação de restinga pega fogo rápido.</li>
            <li>${icon("check")} Mantenha o terreno limpo e o mato baixo perto da casa, principalmente na estiagem.</li>
            <li>${icon("check")} Bituca de cigarro só no lixo, nunca na beira da estrada ou na areia.</li>
          </ul>
          <p style="margin:-8px 0 22px"><a class="btn btn-ink btn-sm" href="/como-funciona#prevencao">Mais dicas de prevenção</a></p>
        </div>
      </div>
    </div>
  </section>`.s;

  let mapRef = null;
  let alive = true;

  getStats().then((s) => {
    if (!alive) return;
    const nums = el.querySelectorAll("#nums b");
    [s.active, s.today, s.resolved].forEach((v, i) => { nums[i].textContent = v; });
    el.querySelector("#live").classList.toggle("hot", s.active > 0);
  }).catch(() => {});

  getReports({ limit: 60 }).then(async (reports) => {
    if (!alive) return;
    const recent = el.querySelector("#recent");
    recent.innerHTML = reports.length
      ? html`<div class="occ-list">${reports.slice(0, 5).map(occRow)}</div>`.s
      : html`<div class="empty"><img src="/assets/mimo-wave.webp" alt=""><p>Nenhum aviso registrado ainda. Se vir fumaça ou fogo, você pode ser a primeira pessoa a avisar.</p><a class="btn btn-fire" href="/reportar">Reportar um foco</a></div>`.s;
    try {
      const { L, map } = await createMap(el.querySelector("#home-map"), { zoom: 11, scrollZoom: false });
      if (!alive) { map.remove(); return; }
      mapRef = map;
      reports.filter((r) => r.status !== "false_report").forEach((r) => {
        L.marker([r.latitude, r.longitude], { icon: pinIcon(L, r.status) }).bindPopup(reportPopup(r)).addTo(map);
      });
    } catch { el.querySelector("#home-map").innerHTML = html`<p class="tiny" style="padding:16px;color:#fff">Mapa indisponível agora.</p>`.s; }
  }).catch(() => {
    if (alive) el.querySelector("#recent").innerHTML = html`<div class="empty"><p>Não foi possível carregar os avisos agora.</p><button class="btn btn-line" data-reload>Tentar de novo</button></div>`.s;
  });

  getNews({ limit: 4 }).then((news) => {
    if (!alive) return;
    el.querySelector("#news").innerHTML = news.length
      ? html`<div class="news-grid">${news.slice(0, 4).map((n, i) => newsCard(n, i === 0))}</div>`.s
      : html`<p class="muted">Ainda não há notícias publicadas.</p>`.s;
  }).catch(() => { if (alive) el.querySelector("#news").innerHTML = ""; });

  return () => { alive = false; mapRef?.remove(); };
}
