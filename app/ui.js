// Utilidades de interface: template seguro, ícones, avisos, formatos e rótulos.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
const part = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join("") : v === false || v == null ? "" : esc(v));
/** Template HTML que escapa tudo, exceto o que já for html``/raw(). */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Safe(out);
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- ícones (traço 2px, 24×24) ---------- */
const P = {
  flame: '<path d="M12 3c1 3.5 5 5.6 5 10a5 5 0 0 1-10 0c0-2 .8-3.4 2-4.5.2 1.6 1 2.6 2 3 0-3 0-5.5 1-8.5Z"/>',
  map: '<path d="m9 4-6 2.5v13L9 17l6 2.5 6-2.5V4l-6 2.5L9 4Z"/><path d="M9 4v13M15 6.5v13"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/>',
  news: '<path d="M5 5h11v14H6a1 1 0 0 1-1-1V5Z"/><path d="M16 9h3v9a1 1 0 0 1-1 1h-2M8 9h5M8 12.5h5M8 16h3"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M15.5 6.3a3 3 0 0 1 0 5.4M17.5 14.6c1.6.5 2.7 2 3 4.4"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4Z"/>',
  pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  target: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  video: '<rect x="3.5" y="6.5" width="12" height="11" rx="1.5"/><path d="m15.5 10.5 5-3v9l-5-3"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  heart: '<path d="M12 19.5s-7.5-4.3-7.5-9.6A4 4 0 0 1 12 7.6a4 4 0 0 1 7.5 2.3c0 5.3-7.5 9.6-7.5 9.6Z"/>',
  reply: '<path d="M9.5 8 5 12l4.5 4M5 12h9a5 5 0 0 1 5 5v1"/>',
  flag: '<path d="M6 21V4M6 4.5h11l-2 4 2 4H6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M14.5 6 8.5 12l6 6"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6l7-2.5Z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
  share: '<circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
  logout: '<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
  edit: '<path d="M5 19h3.5L19 8.5 15.5 5 5 15.5V19Z"/>',
  trash: '<path d="M5 7h14M10 4h4M7 7l1 13h8l1-13"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="m5 18 5-5 3.5 3.5L16 14l4 4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  send: '<path d="M4 12 20 4l-5 16-3-6.5L4 12Z"/>',
  zap: '<path d="M5.5 18.5 4 21l2.7-1.3A8.5 8.5 0 1 0 3.5 12c0 1.6.4 3.1 1.2 4.4"/><path d="M9 8.6c.2-.5.6-.6 1-.6l.6.1.8 1.8c.1.3 0 .5-.2.7l-.5.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.5c.2-.2.4-.3.7-.2l1.8.8.1.6c0 .4-.1.8-.6 1-.7.4-1.7.5-3-.1a8.6 8.6 0 0 1-4.2-4.2c-.6-1.3-.5-2.3-.1-3Z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
export const icon = (name, cls = "") =>
  raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`);

/* ---------- avisos rápidos ---------- */
export function toast(message, kind = "ok") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, kind === "err" ? 5200 : 3200);
}

/* ---------- diálogos ---------- */
export function confirmDialog(message, { ok = "Confirmar", danger = false } = {}) {
  return dialog(html`<p class="dlg-msg">${message}</p>`, { ok, danger }).then((r) => r !== null);
}
export function choiceDialog(title, options, { ok = "Enviar", withDetails = false } = {}) {
  const body = html`<h2 class="dlg-title">${title}</h2>
    <div class="choice-list">${options.map((o, i) => html`<label class="radio-row"><input type="radio" name="dlg-choice" value="${o}" ${i === 0 ? raw("checked") : ""}> ${o}</label>`)}</div>
    ${withDetails ? html`<label class="field"><span>Detalhes (opcional)</span><textarea name="dlg-details" rows="3" maxlength="1000"></textarea></label>` : ""}`;
  return dialog(body, { ok, read: (d) => ({ choice: $('input[name="dlg-choice"]:checked', d)?.value, details: $('textarea[name="dlg-details"]', d)?.value?.trim() || null }) });
}
function dialog(body, { ok, danger = false, read = () => true }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "dlg";
    d.innerHTML = html`<form method="dialog">${body}<div class="dlg-actions"><button class="btn btn-quiet" value="cancel" type="submit">Cancelar</button><button class="btn ${danger ? "btn-danger" : "btn-ink"}" value="ok" type="submit">${ok}</button></div></form>`.s;
    document.body.append(d);
    d.addEventListener("close", () => { resolve(d.returnValue === "ok" ? read(d) : null); d.remove(); });
    d.showModal();
  });
}

/* ---------- formatos ---------- */
export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export function ago(v) {
  if (!v) return "";
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 60) return "agora há pouco";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) { const d = Math.floor(s / 86400); return d === 1 ? "ontem" : `há ${d} dias`; }
  return fmtDate(v);
}
export const initial = (name) => (name || "?").trim().charAt(0).toUpperCase();
export function avatar(url, name, size = "md") {
  return url
    ? html`<img class="av av-${size}" src="${url}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : html`<span class="av av-${size} av-empty" aria-hidden="true">${initial(name)}</span>`;
}
export function slugify(v) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}
export const isVideo = (url) => /\.(mp4|webm|mov|m4v|3gp)(\?|$)/i.test(url || "");
export const paragraphs = (text) => (text || "").split(/\n{2,}/).map((p) => html`<p>${p}</p>`);

/* ---------- rótulos ---------- */
export const FIRE_TYPES = [
  ["florestal", "Mata / vegetação"], ["queimada", "Queimada / lixo"], ["residencial", "Casa"],
  ["comercial", "Comércio"], ["veicular", "Veículo"], ["outro", "Outro"],
];
export const SEVERITIES = [
  ["pequeno", "Pequeno", "Fumaça ou foco que cabe num quintal"],
  ["medio", "Médio", "Fogo visível se espalhando"],
  ["grande", "Grande", "Chamas altas, área extensa"],
  ["emergencia", "Emergência", "Risco a pessoas, casas ou animais"],
];
export const STATUSES = {
  pending: ["Recebido", "Aguardando verificação da equipe"],
  verified: ["Verificado", "A equipe confirmou a ocorrência"],
  active: ["Fogo ativo", "Incêndio em andamento"],
  resolved: ["Resolvido", "Fogo apagado ou controlado"],
  false_report: ["Encerrado", "Sem confirmação ou alerta falso"],
};
export const NEWS_CATS = [["alertas", "Alertas"], ["prevencao", "Prevenção"], ["incendios", "Incêndios"], ["meio_ambiente", "Meio ambiente"], ["seguranca", "Segurança"], ["comunidade", "Comunidade"]];
export const FORUM_CATS = [["incendios", "Incêndios"], ["prevencao", "Prevenção"], ["meio_ambiente", "Meio ambiente"], ["alertas", "Alertas"], ["seguranca", "Segurança"], ["comunidade", "Comunidade"], ["geral", "Conversa geral"]];
export const REPORT_REASONS = ["Informação falsa", "Conteúdo ofensivo", "Spam", "Conteúdo perigoso", "Outro"];
export const lbl = (list, v) => (list.find((x) => x[0] === v) || [, v || "—"])[1];
export const statusBadge = (s) => html`<span class="badge st-${s}">${(STATUSES[s] || ["—"])[0]}</span>`;
export const sevLabel = (v) => lbl(SEVERITIES, v);

/* ---------- estados de carregamento ---------- */
export const skeleton = (n = 3, h = 88) => html`<div class="stack">${Array.from({ length: n }, () => html`<div class="skel" style="height:${h}px"></div>`)}</div>`;
export const errorBox = (msg = "Não foi possível carregar agora. Verifique sua conexão e tente de novo.") =>
  html`<div class="empty"><p>${msg}</p><button class="btn btn-line" data-reload>Tentar de novo</button></div>`;
