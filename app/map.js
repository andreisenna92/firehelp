// Mapa (Leaflet servido pelo próprio site, carregado só quando uma página precisa).
import { SAQUAREMA } from "./config.js";
import { html, esc, fmtDateTime, lbl, FIRE_TYPES, sevLabel, statusBadge, isVideo } from "./ui.js";

let loading = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "/vendor/leaflet/leaflet.css";
    document.head.append(css);
    const s = document.createElement("script");
    s.src = "/vendor/leaflet/leaflet.js";
    s.onload = () => resolve(window.L);
    s.onerror = () => { loading = null; reject(new Error("mapa indisponível")); };
    document.head.append(s);
  });
  return loading;
}

export async function createMap(el, { center = SAQUAREMA, zoom = 12, scrollZoom = true } = {}) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: true, scrollWheelZoom: scrollZoom, attributionControl: true }).setView([center.lat, center.lng], zoom);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.attributionControl.setPosition("bottomleft");
  map.attributionControl.setPrefix(false);
  // Corrige tamanho quando o container muda (abas, layout responsivo).
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);
  map.on("unload", () => ro.disconnect());
  return { L, map };
}

export function pinIcon(L, status) {
  return L.divIcon({ className: "", html: `<div class="pin pin-${esc(status)}"></div>`, iconSize: [28, 28], iconAnchor: [4, 28], popupAnchor: [10, -26] });
}

export function reportPopup(r) {
  const media = r.fire_report_images?.[0]?.image_url;
  return html`<div class="pop">
    <h4>${lbl(FIRE_TYPES, r.type)}</h4>
    <p>${statusBadge(r.status)} <span class="tiny">Nível ${sevLabel(r.severity).toLowerCase()}</span></p>
    <p class="tiny">${fmtDateTime(r.reported_at)}</p>
    ${r.description ? html`<p>${r.description}</p>` : ""}
    <p class="tiny">${r.neighborhood || r.address || `${(+r.latitude).toFixed(4)}, ${(+r.longitude).toFixed(4)}`}</p>
    ${media ? (isVideo(media) ? html`<video src="${media}" controls preload="none"></video>` : html`<img src="${media}" alt="Foto enviada pela comunidade" loading="lazy">`) : ""}
  </div>`.s;
}
