import { html, icon, raw, statusBadge, lbl, FIRE_TYPES, ago, NEWS_CATS, isVideo, fmtDate, skeleton, sevLabel } from "../ui.js";
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
export function reportCard(r) {
  const media = r.fire_report_images?.[0]?.image_url;
  return html`<a class="rcard ${r.status === "active" ? "is-hot" : ""}" href="/mapa?o=${r.id}">
    <div class="rcard-cover">
      ${media ? (isVideo(media) ? html`<video src="${media}#t=0.5" muted playsinline preload="metadata"></video><span class="rcard-play">${icon("video")}</span>` : html`<img src="${media}" alt="Foto enviada do incêndio" loading="lazy">`)
        : html`<div class="rcard-empty">${icon("flame")}<span>sem foto</span></div>`}
      <span class="rcard-badge">${statusBadge(r.status)}</span>
    </div>
    <div class="rcard-body">
      <b>${lbl(FIRE_TYPES, r.type)}</b>
      <span>${icon("pin")} ${r.neighborhood || shortAddr(r.address) || "Local marcado no mapa"}</span>
      <small>${ago(r.reported_at)} · nível ${sevLabel(r.severity).toLowerCase()}</small>
    </div>
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
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <h1 class="display">Viu fumaça em Saquarema? Avise agora.</h1>
        <p class="lead">O FireHelp junta moradores para avisar focos de incêndio com foto, vídeo e localização, acompanhar cada ocorrência no mapa e prevenir o próximo fogo.</p>
        <div class="hero-cta">
          <a class="btn btn-fire btn-lg glow" href="/reportar">${icon("flame")} Reportar um foco</a>
          <a class="btn btn-ghost btn-lg" href="/mapa">${icon("map")} Ver o mapa</a>
        </div>
        <p class="hero-note">${icon("phone")} <span>Fogo perto de pessoas, casas ou animais? <a href="tel:193"><b>Ligue 193</b></a> primeiro e depois registre aqui.</span></p>
      </div>
      <div class="hero-mimo">
        <button class="mimo-say" type="button" data-mimo="" id="mimo-say"><span id="mimo-say-txt">Oi! Eu sou o Mimo. Posso te ajudar a avisar um foco ou tirar dúvidas sobre prevenção.</span> <b>Fale comigo</b></button>
        <button class="mimo-live" type="button" id="mimo-live" aria-label="Conversar com o Mimo">
          <span class="ml-glow" aria-hidden="true"></span>
          <span class="ml-shadow" aria-hidden="true"></span>
          <span class="ml-rig" aria-hidden="true"><span class="ml-breath">
            <img class="ml-cauda" src="/assets/mimo/heroi-cauda.webp" alt="" width="576" height="768">
            <img class="ml-corpo" src="/assets/mimo/heroi-corpo.webp" alt="" width="576" height="768">
            <span class="ml-head"><span class="ml-nod"><img src="/assets/mimo/heroi-cabeca.webp" alt="" width="576" height="768"><i class="ml-lid l"></i><i class="ml-lid r"></i></span></span>
            <img class="ml-mao" src="/assets/mimo/heroi-mao.webp" alt="" width="576" height="768">
          </span></span>
        </button>
      </div>
    </div>
  </section>

  <section class="wrap situation-wrap">
    <div class="situation" aria-label="Situação atual em Saquarema">
      <div class="sit-head">
        <span class="sit-title"><span class="live-dot" id="live"></span> Agora em Saquarema</span>
        <div class="sit-nums" id="nums">
          <div class="hot"><b>–</b><small>focos ativos</small></div>
          <div><b>–</b><small>avisos hoje</small></div>
          <div><b>–</b><small>resolvidos</small></div>
          <div><b>–</b><small>membros</small></div>
        </div>
      </div>
      <div class="map" id="home-map" role="region" aria-label="Mapa das ocorrências"></div>
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
      <div id="recent">${skeleton(1, 260)}</div>
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
        <img src="/assets/mimo/placa.webp" alt="Mimo, o mico-leão-dourado bombeiro" width="180" height="270" loading="lazy">
        <div>
          <h2 class="h2">O Mimo lembra: a maioria dos incêndios começa pequeno.</h2>
          <ul class="tips">
            <li>${icon("check")} Não queime lixo, folhas ou entulho — em Saquarema a vegetação de restinga pega fogo rápido.</li>
            <li>${icon("check")} Mantenha o terreno limpo e o mato baixo perto da casa, principalmente na estiagem.</li>
            <li>${icon("check")} Bituca de cigarro só no lixo, nunca na beira da estrada ou na areia.</li>
          </ul>
          <a class="btn btn-ink btn-sm" href="/como-funciona#prevencao">Mais dicas de prevenção</a>
        </div>
      </div>
    </div>
  </section>`.s;

  let mapRef = null;
  let alive = true;

  getStats().then((s) => {
    if (!alive) return;
    const nums = el.querySelectorAll("#nums b");
    [s.active, s.today, s.resolved, s.people].forEach((v, i) => { nums[i].textContent = v; });
    el.querySelector("#live").classList.toggle("hot", s.active > 0);
  }).catch(() => {});

  getReports({ limit: 60 }).then(async (reports) => {
    if (!alive) return;
    const recent = el.querySelector("#recent");
    recent.innerHTML = reports.length
      ? html`<div class="report-grid">${reports.slice(0, 6).map(reportCard)}</div>`.s
      : html`<div class="empty"><img src="/assets/mimo/deitado.webp" alt=""><p>Nenhum aviso registrado ainda. Se vir fumaça ou fogo, você pode ser a primeira pessoa a avisar.</p><a class="btn btn-fire" href="/reportar">Reportar um foco</a></div>`.s;
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

  const stopMimo = animateMimo(el);
  return () => { alive = false; stopMimo(); mapRef?.remove(); };
}

// Mimo do topo: respira, balança, acena, olha para o cursor e pisca.
const FALAS = [
  "Oi! Eu sou o Mimo. Posso te ajudar a avisar um foco ou tirar dúvidas sobre prevenção.",
  "Viu fumaça? Tire uma foto de longe e me mostre — eu confiro pra você!",
  "A restinga de Saquarema pega fogo rapidinho na seca. Nada de queimar lixo, combinado?",
  "Fogo perto de casas ou pessoas? Ligue 193 primeiro, depois avise aqui.",
  "Sou um mico-leão-dourado. Minha família mora na Mata Atlântica do Rio!",
  "Bituca de cigarro só no lixo, tá? Na beira da estrada vira incêndio.",
];
function animateMimo(root) {
  const live = root.querySelector("#mimo-live");
  const say = root.querySelector("#mimo-say-txt");
  if (!live) return () => {};
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, i = 0, alive = true;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const onMove = (e) => {
    const r = live.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width * 0.62)) / (innerWidth * 0.5)));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.3)) / (innerHeight * 0.6)));
  };
  const loop = () => {
    cx += (tx - cx) * 0.04; cy += (ty - cy) * 0.04; // segue o cursor devagar, sem tremer
    live.style.setProperty("--lx", cx.toFixed(3));
    live.style.setProperty("--ly", cy.toFixed(3));
    raf = requestAnimationFrame(loop);
  };

  const blink = () => { live.classList.add("blink"); later(() => live.classList.remove("blink"), 130); };
  const nextBlink = () => later(() => { blink(); if (Math.random() < 0.25) later(blink, 300); nextBlink(); }, rnd(2800, 6000));
  nextBlink();

  const party = () => {
    live.classList.remove("party"); void live.offsetWidth; live.classList.add("party");
    later(() => live.classList.remove("party"), 1350);
  };
  const nextParty = () => later(() => { if (!document.hidden) party(); nextParty(); }, rnd(14000, 22000));
  nextParty();

  const talk = setInterval(() => {
    if (document.hidden || !say) return;
    i = (i + 1) % FALAS.length;
    say.parentElement.classList.add("swap");
    later(() => { say.textContent = FALAS[i]; say.parentElement.classList.remove("swap"); }, 300);
  }, 9000);

  live.addEventListener("click", () => { party(); blink(); later(() => root.querySelector("#mimo-say")?.click(), 650); });
  live.addEventListener("pointerenter", () => live.classList.add("happy"));
  live.addEventListener("pointerleave", () => live.classList.remove("happy"));
  addEventListener("pointermove", onMove, { passive: true });
  raf = requestAnimationFrame(loop);

  return () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); clearInterval(talk); removeEventListener("pointermove", onMove); };
}
