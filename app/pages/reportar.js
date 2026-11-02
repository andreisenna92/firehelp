import { html, icon, toast, FIRE_TYPES, SEVERITIES, $, esc } from "../ui.js";
import { insert, upload, auth } from "../sb.js";
import { SAQUAREMA, SAQUAREMA_BOUNDS as B } from "../config.js";
import { createMap, pinIcon } from "../map.js";

const MAX_FILES = 5;
const MAX_VIDEO = 50 * 1024 * 1024;

export default async function reportar({ el }) {
  const s = { type: null, severity: null, coords: null, address: "", neighborhood: null, municipality: null, files: [], description: "", confirmed: false, sending: false };
  let map, L, marker, alive = true;

  el.innerHTML = html`
  <div class="report-head">
    <div class="wrap narrow">
      <h1 class="h1">Reportar um foco de incêndio</h1>
      <p class="lead" style="margin:0">Leva menos de um minuto. Seu aviso aparece no mapa para a comunidade e para a equipe do FireHelp.</p>
      <div class="danger-note">${icon("phone")}<span>Se há pessoas, casas ou animais em risco, <a href="tel:193">ligue 193</a> agora. Fique longe do fogo e da fumaça.</span></div>
    </div>
  </div>
  <form class="wrap narrow" id="rf" novalidate style="padding-bottom:30px">
    <section class="rstep" data-step="type">
      <span class="rstep-n">1</span><h2>O que está pegando fogo?</h2>
      <div class="rstep-body"><div class="type-grid" role="group" aria-label="Tipo de ocorrência">
        ${FIRE_TYPES.map(([v, l]) => html`<button type="button" class="opt" data-type="${v}" aria-pressed="false"><b>${l}</b></button>`)}
      </div></div>
    </section>
    <section class="rstep" data-step="severity">
      <span class="rstep-n">2</span><h2>Qual o tamanho?</h2>
      <div class="rstep-body"><div class="sev-grid" role="group" aria-label="Tamanho aparente">
        ${SEVERITIES.map(([v, l, d]) => html`<button type="button" class="opt sev-${v}" data-sev="${v}" aria-pressed="false"><b>${l}</b><small>${d}</small></button>`)}
      </div></div>
    </section>
    <section class="rstep" data-step="loc">
      <span class="rstep-n">3</span><h2>Onde é?</h2>
      <div class="rstep-body">
        <div class="row">
          <button type="button" class="btn btn-ink" id="gps">${icon("target")} Usar minha localização</button>
          <span class="small muted">ou busque um endereço / toque no mapa</span>
        </div>
        <div class="search"><span>${icon("search")}</span><input class="input" id="addr-q" type="search" placeholder="Rua, bairro ou ponto de referência em Saquarema" aria-label="Buscar endereço" enterkeyhint="search"></div>
        <div class="pick-map"><div class="map" id="pick-map"></div></div>
        <div id="loc-out" aria-live="polite"></div>
      </div>
    </section>
    <section class="rstep" data-step="media">
      <span class="rstep-n">4</span><h2>Fotos ou vídeo <span class="muted small">(recomendado)</span></h2>
      <div class="rstep-body">
        <label class="drop" id="drop">
          ${icon("camera")}
          <span><b>Tirar foto, gravar ou escolher arquivos</b><br><span class="small muted">Até ${MAX_FILES} arquivos. Vídeos de até 50 MB.</span></span>
          <input type="file" id="files" accept="image/*,video/*" multiple>
        </label>
        <div class="thumbs" id="thumbs"></div>
      </div>
    </section>
    <section class="rstep" data-step="desc">
      <span class="rstep-n">5</span><h2>O que você está vendo? <span class="muted small">(opcional)</span></h2>
      <div class="rstep-body">
        <textarea class="input" id="desc" rows="4" maxlength="2000" placeholder="Ex.: fumaça preta subindo da mata atrás da escola, vento forte em direção às casas."></textarea>
      </div>
    </section>
    <div class="stack" style="gap:14px;padding-top:6px">
      <label class="check"><input type="checkbox" id="ok"> <span>As informações são verdadeiras e eu estou em um lugar seguro. Data e hora são registradas automaticamente.</span></label>
      <div id="form-err" class="form-err" hidden></div>
      <div class="submit-bar"><button class="btn btn-fire btn-lg btn-block" id="send" type="submit">${icon("flame")} Enviar aviso</button></div>
    </div>
  </form>`.s;

  const form = $("#rf", el);
  const mark = (step, done) => $(`.rstep[data-step="${step}"]`, el).classList.toggle("done", done);

  /* tipo e tamanho */
  form.addEventListener("click", (e) => {
    const t = e.target.closest("[data-type]"), v = e.target.closest("[data-sev]");
    if (t) { s.type = t.dataset.type; $$p("[data-type]").forEach((b) => b.setAttribute("aria-pressed", String(b === t))); mark("type", true); }
    if (v) { s.severity = v.dataset.sev; $$p("[data-sev]").forEach((b) => b.setAttribute("aria-pressed", String(b === v))); mark("severity", true); }
  });
  const $$p = (sel) => [...form.querySelectorAll(sel)];

  /* localização */
  function setPoint(lat, lng, { fly = true, lookup = true } = {}) {
    s.coords = { lat, lng };
    if (map) {
      if (!marker) {
        marker = L.marker([lat, lng], { icon: pinIcon(L, "pick"), draggable: true }).addTo(map);
        marker.on("dragend", () => { const p = marker.getLatLng(); setPoint(p.lat, p.lng, { fly: false }); });
      } else marker.setLatLng([lat, lng]);
      if (fly) map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: .5 });
    }
    mark("loc", true);
    showLoc("Buscando o endereço…");
    if (lookup) reverse(lat, lng);
  }
  function showLoc(msg) {
    const inside = s.coords && s.coords.lat > B.south && s.coords.lat < B.north && s.coords.lng > B.west && s.coords.lng < B.east;
    $("#loc-out", el).innerHTML = html`<div class="loc-out ${inside ? "" : "warn"}">${icon("pin")}<span>${msg || s.address || "Ponto marcado"}<br><span class="tiny">${s.coords.lat.toFixed(5)}, ${s.coords.lng.toFixed(5)} · arraste o marcador para ajustar${inside ? "" : " · este ponto parece estar fora de Saquarema"}</span></span></div>`.s;
  }
  async function reverse(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR&zoom=18`);
      const d = await r.json();
      if (!alive || s.coords?.lat !== lat) return;
      const a = d.address || {};
      s.neighborhood = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || null;
      s.municipality = a.city || a.town || a.municipality || a.village || null;
      s.address = [a.road && (a.house_number ? `${a.road}, ${a.house_number}` : a.road), s.neighborhood, s.municipality].filter(Boolean).join(" · ") || d.display_name || "";
    } catch { s.address = ""; }
    if (alive) showLoc();
  }
  $("#gps", el).addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!navigator.geolocation) { toast("Seu navegador não permite localização. Busque o endereço ou toque no mapa.", "err"); return; }
    btn.disabled = true; btn.lastChild.textContent = " Localizando…";
    navigator.geolocation.getCurrentPosition(
      (p) => { btn.disabled = false; btn.lastChild.textContent = " Usar minha localização"; setPoint(p.coords.latitude, p.coords.longitude); },
      (err) => {
        btn.disabled = false; btn.lastChild.textContent = " Usar minha localização";
        toast(err.code === 1 ? "Permissão de localização negada. Busque o endereço ou toque no mapa." : "Não deu para achar sua posição. Busque o endereço ou toque no mapa.", "err");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
  const addr = $("#addr-q", el);
  addr.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const text = addr.value.trim();
    if (text.length < 3) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&countrycodes=br&viewbox=${B.west},${B.north},${B.east},${B.south}&bounded=1&q=${encodeURIComponent(text)}`;
      const [hit] = await (await fetch(url)).json();
      if (!hit) { toast("Endereço não encontrado em Saquarema. Tente um ponto de referência ou toque no mapa.", "err"); return; }
      setPoint(+hit.lat, +hit.lon);
    } catch { toast("Busca indisponível agora. Toque no mapa para marcar o ponto.", "err"); }
  });

  /* arquivos */
  const filesInput = $("#files", el), thumbs = $("#thumbs", el), drop = $("#drop", el);
  function addFiles(list) {
    for (const f of list) {
      if (s.files.length >= MAX_FILES) { toast(`Máximo de ${MAX_FILES} arquivos.`, "err"); break; }
      const video = f.type.startsWith("video/");
      if (!video && !f.type.startsWith("image/")) continue;
      if (video && f.size > MAX_VIDEO) { toast(`O vídeo "${f.name}" passa de 50 MB. Grave um trecho mais curto.`, "err"); continue; }
      s.files.push({ file: f, video, url: URL.createObjectURL(f) });
    }
    drawThumbs();
  }
  function drawThumbs() {
    thumbs.innerHTML = s.files.map((x, i) => html`<div class="thumb">${x.video ? html`<video src="${x.url}" muted playsinline preload="metadata"></video><span class="vid-tag">vídeo</span>` : html`<img src="${x.url}" alt="">`}<button type="button" data-rm="${i}" aria-label="Remover arquivo">${icon("x")}</button></div>`.s).join("");
    mark("media", s.files.length > 0);
  }
  filesInput.addEventListener("change", () => { addFiles(filesInput.files); filesInput.value = ""; });
  thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (!b) return;
    URL.revokeObjectURL(s.files[+b.dataset.rm].url);
    s.files.splice(+b.dataset.rm, 1); drawThumbs();
  });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  $("#desc", el).addEventListener("input", (e) => { s.description = e.target.value; mark("desc", e.target.value.trim().length > 0); });
  $("#ok", el).addEventListener("change", (e) => { s.confirmed = e.target.checked; });

  /* envio */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (s.sending) return;
    const err = $("#form-err", el);
    const missing = !s.type ? ["type", "Escolha o que está pegando fogo."] : !s.severity ? ["severity", "Escolha o tamanho aproximado."] : !s.coords ? ["loc", "Marque onde é: use sua localização, busque o endereço ou toque no mapa."] : !s.confirmed ? [null, "Confirme que as informações são verdadeiras."] : null;
    if (missing) {
      err.hidden = false; err.textContent = missing[1];
      if (missing[0]) $(`.rstep[data-step="${missing[0]}"]`, el).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    err.hidden = true;
    s.sending = true;
    const btn = $("#send", el);
    btn.disabled = true; btn.textContent = "Enviando aviso…";
    try {
      const [report] = await insert("fire_reports", {
        user_id: auth.user.id, type: s.type, severity: s.severity,
        description: s.description.trim() || null,
        latitude: s.coords.lat, longitude: s.coords.lng,
        address: s.address || null, neighborhood: s.neighborhood, municipality: s.municipality,
      }, "id,protocol");
      let failed = 0;
      for (let i = 0; i < s.files.length; i++) {
        btn.textContent = `Enviando arquivo ${i + 1} de ${s.files.length}…`;
        try {
          const item = s.files[i];
          const file = item.video ? item.file : await shrink(item.file);
          const ext = (file.name.split(".").pop() || (item.video ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "");
          const url = await upload(`${auth.user.id}/${report.id}/${crypto.randomUUID()}.${ext}`, file);
          await insert("fire_report_images", { fire_report_id: report.id, image_url: url }, "id");
        } catch { failed++; }
      }
      success(report.protocol, report.id, failed);
    } catch (ex) {
      console.error(ex);
      s.sending = false; btn.disabled = false; btn.innerHTML = html`${icon("flame")} Enviar aviso`.s;
      err.hidden = false;
      err.textContent = ex.status === 401 || ex.status === 403 ? "Sua sessão expirou. Entre de novo para enviar." : "Não foi possível enviar o aviso. Verifique a internet e tente de novo — seus dados continuam aqui.";
    }
  });

  function success(protocol, id, failed) {
    s.files.forEach((x) => URL.revokeObjectURL(x.url));
    map?.remove(); map = null;
    el.innerHTML = html`<section class="wrap narrow pad success">
      <img src="/assets/mimo-thumbs.webp" alt="" width="150" height="225">
      <h1 class="h1">Aviso enviado. Obrigado!</h1>
      <p class="lead" style="margin:0">Seu aviso já está no mapa. Guarde o protocolo para acompanhar.</p>
      <p class="protocol">${protocol}</p>
      ${failed ? html`<p class="form-err">${failed === 1 ? "Um arquivo" : `${failed} arquivos`} não foi enviado. O aviso foi registrado mesmo assim.</p>` : ""}
      <div class="row" style="justify-content:center">
        <a class="btn btn-ink" href="/mapa?o=${id}">${icon("map")} Ver no mapa</a>
        <button class="btn btn-line" id="share">${icon("share")} Avisar vizinhos</button>
        <a class="btn btn-quiet" href="/perfil">Meus avisos</a>
      </div>
      <p class="small muted">Se o fogo crescer ou ameaçar alguém, <a href="tel:193"><b>ligue 193</b></a>.</p>
    </section>`.s;
    window.scrollTo(0, 0);
    $("#share", el).addEventListener("click", async () => {
      const data = { title: "Foco de incêndio em Saquarema", text: `Aviso de foco de incêndio no FireHelp (protocolo ${protocol}).`, url: `${location.origin}/mapa?o=${id}` };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(`${data.text} ${data.url}`); toast("Link copiado. Cole no grupo do bairro."); }
      } catch { /* cancelado */ }
    });
  }

  /* mapa de escolha */
  try {
    ({ L, map } = await createMap($("#pick-map", el), { center: SAQUAREMA, zoom: 12, scrollZoom: false }));
    if (!alive) { map.remove(); return; }
    map.on("click", (e) => setPoint(e.latlng.lat, e.latlng.lng, { fly: false }));
  } catch { $("#pick-map", el).innerHTML = html`<p style="padding:16px">Mapa indisponível. Use sua localização ou o endereço.</p>`.s; }

  return () => { alive = false; map?.remove(); s.files.forEach((x) => URL.revokeObjectURL(x.url)); };
}

// Reduz fotos grandes (celulares geram 4–12 MB) para envio rápido com sinal fraco.
async function shrink(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp|heic|heif)/.test(file.type) && file.type) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
void esc;
