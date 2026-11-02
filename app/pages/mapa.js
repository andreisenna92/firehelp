import { html, icon, STATUSES, FIRE_TYPES, skeleton, errorBox } from "../ui.js";
import { getReports } from "../data.js";
import { createMap, pinIcon, reportPopup } from "../map.js";
import { occRow } from "./home.js";
import { me, loadMe } from "../store.js";
import { update } from "../sb.js";
import { confirmDialog, toast } from "../ui.js";

export const bleed = true;

export default async function mapa({ el, query }) {
  let status = "open";
  let type = "all";
  let reports = [];
  let map, L, layer;
  const markers = new Map();
  let alive = true;

  el.innerHTML = html`
  <div class="map-page">
    <aside class="map-side">
      <div>
        <h1 class="h2">Mapa de ocorrências</h1>
        <p class="muted small" id="summary" style="margin:.3rem 0 0">Carregando avisos…</p>
      </div>
      <div class="stack" style="gap:8px">
        <div class="scroll-x"><div class="chips" id="f-status" role="group" aria-label="Filtrar por situação">
          <button class="chip" data-v="open" aria-pressed="true">Em andamento</button>
          <button class="chip" data-v="all" aria-pressed="false">Todas</button>
          <button class="chip" data-v="resolved" aria-pressed="false">Resolvidas</button>
        </div></div>
        <div class="scroll-x"><div class="chips" id="f-type" role="group" aria-label="Filtrar por tipo">
          <button class="chip" data-v="all" aria-pressed="true">Todos os tipos</button>
          ${FIRE_TYPES.map(([v, l]) => html`<button class="chip" data-v="${v}" aria-pressed="false">${l}</button>`)}
        </div></div>
      </div>
      <div class="legend" aria-label="Legenda">
        ${[["active", "fire"], ["pending", "warn"], ["verified", "lagoon"], ["resolved", "ok"]].map(([s, c]) => html`<span><i style="background:var(--${c})"></i>${STATUSES[s][0]}</span>`)}
      </div>
      <div id="list">${skeleton(4, 70)}</div>
    </aside>
    <div class="map-main">
      <div class="map" id="big-map" role="region" aria-label="Mapa"></div>
      <a class="btn btn-fire map-fab hide-sm" href="/reportar">${icon("flame")} Reportar foco aqui</a>
    </div>
  </div>`.s;

  const listEl = el.querySelector("#list");
  const visible = () => reports.filter((r) =>
    (status === "all" || (status === "open" ? ["pending", "verified", "active"].includes(r.status) : r.status === status)) &&
    (type === "all" || r.type === type));

  function draw(focusId) {
    const rows = visible();
    el.querySelector("#summary").textContent = rows.length === 1 ? "1 ocorrência neste filtro" : `${rows.length} ocorrências neste filtro`;
    listEl.innerHTML = rows.length
      ? html`<div class="occ-list">${rows.map(occRow)}</div>`.s
      : html`<div class="empty"><p>Nenhuma ocorrência com esses filtros. ${status === "open" ? "Boa notícia: nada em andamento agora." : ""}</p></div>`.s;
    listEl.querySelectorAll(".occ").forEach((a, i) => { a.dataset.id = rows[i].id; });
    if (!map) return;
    layer.clearLayers(); markers.clear();
    rows.forEach((r) => {
      const m = L.marker([r.latitude, r.longitude], { icon: pinIcon(L, r.status) }).bindPopup(reportPopup(r, { staff: me.isStaff }));
      m.on("click", () => select(r.id, false));
      m.addTo(layer); markers.set(r.id, m);
    });
    if (focusId && markers.has(focusId)) select(focusId, true);
  }

  function select(id, fly) {
    listEl.querySelectorAll(".occ").forEach((a) => a.classList.toggle("sel", a.dataset.id === id));
    const m = markers.get(id);
    if (!m) return;
    if (fly) { map.once("moveend", () => m.openPopup()); map.flyTo(m.getLatLng(), 15, { duration: .6 }); }
    else m.openPopup();
    listEl.querySelector(`.occ[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  listEl.addEventListener("click", (e) => {
    const a = e.target.closest(".occ");
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    history.replaceState(null, "", `/mapa?o=${a.dataset.id}`);
    select(a.dataset.id, true);
    if (window.innerWidth <= 860) el.querySelector("#big-map").scrollIntoView({ behavior: "smooth" });
  });
  for (const [id, set] of [["#f-status", (v) => (status = v)], ["#f-type", (v) => (type = v)]]) {
    el.querySelector(id).addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      set(b.dataset.v);
      e.currentTarget.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      draw();
    });
  }

  try {
    ({ L, map } = await createMap(el.querySelector("#big-map"), { zoom: 12 }));
    if (!alive) { map.remove(); return; }
    layer = L.layerGroup().addTo(map);
  } catch { el.querySelector("#big-map").innerHTML = html`<p style="padding:20px">Mapa indisponível agora.</p>`.s; }

  const onDel = async (e) => {
    const b = e.target.closest("[data-del-report]");
    if (!b) return;
    const r = reports.find((x) => x.id === b.dataset.delReport);
    if (!r || !(await confirmDialog(`Excluir o aviso ${r.protocol}? Ele sai do mapa e das listas.`, { ok: "Excluir aviso", danger: true }))) return;
    try {
      await update("fire_reports", { id: `eq.${r.id}` }, { published: false, deleted_at: new Date().toISOString() });
      reports = reports.filter((x) => x !== r); map.closePopup(); draw(); toast("Aviso excluído.");
    } catch { toast("Não foi possível excluir. Só administradores podem excluir avisos.", "err"); }
  };
  el.addEventListener("click", onDel, true);
  await (me.ready ? null : loadMe());
  try {
    reports = await getReports();
    if (!alive) return;
    const focus = query.get("o");
    if (focus && !visible().some((r) => r.id === focus)) { status = "all"; el.querySelectorAll("#f-status .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === "all"))); }
    draw(focus);
  } catch {
    if (alive) listEl.innerHTML = errorBox().s;
  }

  return () => { alive = false; el.removeEventListener("click", onDel, true); map?.remove(); };
}
