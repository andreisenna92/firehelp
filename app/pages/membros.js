import { html, icon, avatar, fmtDate, skeleton, errorBox, $ } from "../ui.js";
import { q } from "../sb.js";
import { me } from "../store.js";

const online = (ts) => ts && Date.now() - new Date(ts).getTime() < 15 * 60 * 1000;

export default async function membros({ el }) {
  el.innerHTML = html`<section class="wrap pad" style="max-width:900px">
    <div class="page-head"><div><h1 class="h1">Membros</h1><p class="lead">Moradores e voluntários que fazem parte da rede. Mande uma mensagem para combinar ações no seu bairro.</p></div></div>
    <div class="search" style="margin-bottom:18px">${icon("search")}<input class="input" id="qq" type="search" placeholder="Buscar por nome" aria-label="Buscar membro"></div>
    <div id="list">${skeleton(4, 76)}</div>
  </section>`.s;
  let rows = [];
  try {
    rows = await q("profiles", { select: "id,full_name,avatar_url,bio,created_at,last_seen_at", blocked: "eq.false", deleted_at: "is.null", order: "full_name.asc" });
  } catch { $("#list", el).innerHTML = errorBox().s; return; }
  const draw = (term = "") => {
    const t = term.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const list = rows.filter((m) => m.full_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t));
    $("#list", el).innerHTML = list.length ? html`<div class="grid2">${list.map((m) => html`<div class="card member">
      ${avatar(m.avatar_url, m.full_name, "md")}
      <div class="info"><b>${m.full_name}</b><span class="small ${online(m.last_seen_at) ? "online" : "muted"}">${online(m.last_seen_at) ? "Ativo agora" : `Membro desde ${fmtDate(m.created_at)}`}</span>${m.bio ? html`<p class="small" style="margin:4px 0 0">${m.bio}</p>` : ""}</div>
      ${m.id !== me.user?.id ? html`<a class="btn btn-line btn-sm" href="/mensagens?com=${m.id}" aria-label="Mandar mensagem para ${m.full_name}">${icon("mail")}</a>` : html`<span class="tag">você</span>`}
    </div>`)}</div>`.s : html`<p class="muted">Ninguém encontrado com esse nome.</p>`.s;
  };
  $("#qq", el).addEventListener("input", (e) => draw(e.target.value));
  draw();
}
