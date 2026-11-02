import { html, icon, avatar, fmtDate, skeleton, errorBox, toast, confirmDialog, $ } from "../ui.js";
import { q, rpc, update, auth } from "../sb.js";
import { me, loadMe } from "../store.js";

const online = (ts) => ts && Date.now() - new Date(ts).getTime() < 15 * 60 * 1000;
const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const LEVEL = { super_admin: ["Proprietário", "tag-owner"], admin: ["Administrador", "tag-admin"] };

export default async function membros({ el }) {
  await (me.ready ? null : loadMe());
  el.innerHTML = html`<section class="wrap pad" style="max-width:1000px">
    <div class="page-head">
      <div><h1 class="h1">Membros</h1><p class="lead">Quem faz parte da rede FireHelp em Saquarema. Mande uma mensagem para combinar ações no seu bairro.</p></div>
      <img class="page-mimo" src="/assets/mimo/abraco.webp" alt="" width="120" height="140">
    </div>
    <div class="row between" style="margin-bottom:18px;gap:14px">
      <div class="search" style="flex:1;min-width:220px">${icon("search")}<input class="input" id="qq" type="search" placeholder="Buscar por nome" aria-label="Buscar membro"></div>
      <span class="tag tag-gold" id="total">…</span>
    </div>
    <div id="list">${skeleton(4, 90)}</div>
  </section>`.s;

  let rows = [], levels = new Map();
  async function load() {
    try {
      rows = await q("profiles", { select: "id,full_name,avatar_url,bio,created_at,last_seen_at", blocked: "eq.false", deleted_at: "is.null", order: "full_name.asc" });
      if (me.isStaff) {
        const adm = await rpc("list_admin_members").catch(() => []);
        levels = new Map(adm.map((m) => [m.id, m]));
      }
    } catch { $("#list", el).innerHTML = errorBox().s; return false; }
    $("#total", el).textContent = rows.length === 1 ? "1 membro" : `${rows.length} membros`;
    return true;
  }

  function card(m) {
    const info = levels.get(m.id);
    const lv = LEVEL[info?.access_level];
    const self = m.id === me.user?.id;
    const canAct = me.isStaff && info && !self && info.access_level !== "super_admin";
    return html`<article class="card member-card" data-id="${m.id}">
      <div class="member">
        <span class="av-ring ${online(m.last_seen_at) ? "on" : ""}">${avatar(m.avatar_url, m.full_name, "md")}</span>
        <div class="info">
          <b>${m.full_name}</b>
          <span class="small ${online(m.last_seen_at) ? "online" : "muted"}">${online(m.last_seen_at) ? "Ativo agora" : `Desde ${fmtDate(m.created_at)}`}</span>
        </div>
        ${lv ? html`<span class="tag ${lv[1]}">${lv[0]}</span>` : self ? html`<span class="tag">você</span>` : ""}
      </div>
      ${m.bio ? html`<p class="small" style="margin:10px 0 0">${m.bio}</p>` : ""}
      ${me.isStaff && info?.email ? html`<p class="tiny" style="margin:6px 0 0">${info.email}</p>` : ""}
      <div class="row" style="margin-top:12px">
        ${self ? html`<a class="btn btn-quiet btn-sm" href="/perfil">Meu perfil</a>` : html`<a class="btn btn-line btn-sm" href="${me.user ? `/mensagens?com=${m.id}` : "/auth"}">${icon("mail")} Mensagem</a>`}
        ${canAct && me.isSuper ? html`<button class="btn btn-quiet btn-sm" data-role="${info.access_level === "admin" ? "down" : "up"}">${info.access_level === "admin" ? "Tirar de administrador" : "Promover a administrador"}</button>` : ""}
        ${canAct ? html`<button class="btn btn-quiet btn-sm" data-block>Suspender</button>` : ""}
        ${canAct && me.isSuper ? html`<button class="btn btn-danger btn-sm" data-remove aria-label="Excluir ${m.full_name}">${icon("trash")} Excluir</button>` : ""}
      </div>
    </article>`;
  }

  function draw() {
    const t = norm($("#qq", el).value);
    const list = rows.filter((m) => norm(m.full_name).includes(t));
    $("#list", el).innerHTML = list.length ? html`<div class="member-grid">${list.map(card)}</div>`.s : html`<p class="muted">Ninguém encontrado com esse nome.</p>`.s;
  }

  $("#qq", el).addEventListener("input", draw);
  $("#list", el).addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    const c = e.target.closest("[data-id]");
    if (!b || !c) return;
    const m = rows.find((x) => x.id === c.dataset.id);
    try {
      if (b.dataset.role) {
        const up = b.dataset.role === "up";
        if (!(await confirmDialog(up ? `Promover ${m.full_name} a administrador? Ele poderá moderar avisos, notícias e a comunidade.` : `Tirar ${m.full_name} da administração?`))) return;
        await rpc("set_member_manager", { target_id: m.id, make_manager: up });
        toast(up ? `${m.full_name} agora é administrador.` : "Acesso de administrador removido.");
      } else if (b.hasAttribute("data-block")) {
        if (!(await confirmDialog(`Suspender ${m.full_name}? A pessoa não conseguirá mais entrar até ser reativada no Painel de gestão.`, { ok: "Suspender", danger: true }))) return;
        await update("profiles", { id: `eq.${m.id}` }, { blocked: true });
        toast("Membro suspenso.");
      } else if (b.hasAttribute("data-remove")) {
        if (!(await confirmDialog(`Excluir a conta de ${m.full_name}? Publicações e mensagens ficam preservadas. Não dá para desfazer.`, { ok: "Excluir conta", danger: true }))) return;
        const res = await fetch("/api/remove-member", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` }, body: JSON.stringify({ userId: m.id }) });
        const d = await res.json().catch(() => ({ error: "Falha ao excluir." }));
        if (d.error) {
          // Sem a chave de servidor, ao menos bloqueia o acesso pelo banco.
          await rpc("prepare_member_removal", { target_id: m.id });
          toast("Acesso removido. A conta fica bloqueada (exclusão completa precisa da chave de servidor).");
        } else toast("Conta excluída. Contribuições preservadas.");
      } else return;
      if (await load()) draw();
    } catch (ex) { toast(ex.message || "Não foi possível concluir.", "err"); }
  });

  if (await load()) draw();
}
