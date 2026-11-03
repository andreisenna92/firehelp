import { html, icon, toast, confirmDialog, slugify, skeleton, errorBox, $ } from "../ui.js";
import { insert, update, remove, upload, auth } from "../sb.js";
import { me, loadMe } from "../store.js";
import { getCreators } from "../data.js";

const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : u ? `https://${u}` : "");
const initials = (n) => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export default async function criadores({ el }) {
  await (me.ready ? null : loadMe());
  let rows = [], editing = null;

  el.innerHTML = html`<section class="wrap pad">
    <div class="creators-head">
      <div>
        <h1 class="h1">Conheça nossos criadores</h1>
        <p class="lead">As pessoas que tiraram o FireHelp do papel para proteger Saquarema do fogo — e os projetos que elas tocam.</p>
      </div>
      <img src="/assets/mimo/abraco.webp" alt="" width="150" class="page-mimo" style="width:150px">
    </div>
    ${me.isStaff ? html`<div class="row" style="margin:6px 0 22px"><button class="btn btn-ink" id="add">${icon("plus")} Adicionar criador</button><span class="small muted">Só a gestão vê este botão.</span></div>` : ""}
    <div id="form-box"></div>
    <div id="list">${skeleton(3, 260)}</div>
  </section>`.s;

  function card(c) {
    return html`<article class="creator" data-id="${c.id}">
      <div class="creator-photo">${c.foto ? html`<img src="${c.foto}" alt="Foto de ${c.nome}" loading="lazy">` : html`<span>${initials(c.nome)}</span>`}</div>
      <div class="creator-body">
        <h2 class="h3">${c.nome}</h2>
        ${c.funcao ? html`<p class="creator-role">${c.funcao}</p>` : ""}
        ${c.bio ? html`<p class="creator-bio">${c.bio}</p>` : ""}
        ${c.projetos.length ? html`<div class="creator-projects"><b>Projetos</b><ul>${c.projetos.map((p) => html`<li>${p.link ? html`<a href="${safeUrl(p.link)}" target="_blank" rel="noopener">${p.nome}</a>` : html`<span>${p.nome}</span>`}${p.descricao ? html` — <span class="muted">${p.descricao}</span>` : ""}</li>`)}</ul></div>` : ""}
        ${c.instagram || c.linkedin || c.site ? html`<div class="creator-links">
          ${c.instagram ? html`<a href="${safeUrl(c.instagram.startsWith("@") ? `instagram.com/${c.instagram.slice(1)}` : c.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ""}
          ${c.linkedin ? html`<a href="${safeUrl(c.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ""}
          ${c.site ? html`<a href="${safeUrl(c.site)}" target="_blank" rel="noopener">${icon("globe")} Site</a>` : ""}
        </div>` : ""}
        ${me.isStaff ? html`<div class="row" style="margin-top:12px"><button class="btn btn-quiet btn-sm" data-edit>${icon("edit")} Editar</button><button class="btn btn-danger btn-sm" data-del>${icon("trash")} Remover</button></div>` : ""}
      </div>
    </article>`;
  }

  function draw() {
    $("#list", el).innerHTML = rows.length
      ? html`<div class="creators-grid">${rows.map(card)}</div>`.s
      : html`<div class="empty"><img src="/assets/mimo/pensando.webp" alt=""><p>${me.isStaff ? "Ainda não há criadores cadastrados. Clique em “Adicionar criador” para começar." : "Em breve você vai conhecer quem criou o FireHelp."}</p></div>`.s;
  }

  async function load() {
    try { rows = await getCreators(); draw(); }
    catch { $("#list", el).innerHTML = errorBox().s; }
  }

  function projRow(p = {}) {
    return html`<div class="proj-row"><input class="input" name="pnome" placeholder="Nome do projeto" maxlength="80" value="${p.nome || ""}"><input class="input" name="pdesc" placeholder="O que é (opcional)" maxlength="160" value="${p.descricao || ""}"><input class="input" name="plink" placeholder="Link (opcional)" maxlength="300" value="${p.link || ""}"><button type="button" class="btn btn-quiet btn-sm" data-rmproj aria-label="Remover projeto">${icon("x")}</button></div>`;
  }

  function openForm(c = null) {
    editing = c;
    const box = $("#form-box", el);
    box.innerHTML = html`<form class="card stack" id="cf" style="margin-bottom:24px">
      <h2 class="h3">${c ? `Editar ${c.nome}` : "Novo criador"}</h2>
      <div class="creator-form-top">
        <label class="creator-photo creator-photo-edit" title="Trocar foto">
          ${c?.foto ? html`<img src="${c.foto}" alt="" id="prev">` : html`<span id="prev-empty">${icon("camera")}</span>`}
          <input type="file" name="foto" accept="image/jpeg,image/png,image/webp" hidden>
        </label>
        <div class="stack" style="flex:1;min-width:240px">
          <label class="field"><span>Nome</span><input name="nome" maxlength="80" required value="${c?.nome || ""}"></label>
          <label class="field"><span>Função no projeto</span><input name="funcao" maxlength="120" placeholder="Ex.: Idealizador e gestor do FireHelp" value="${c?.funcao || ""}"></label>
        </div>
      </div>
      <label class="field"><span>Descrição</span><textarea name="bio" rows="4" maxlength="1200" placeholder="Quem é, o que faz, por que criou o FireHelp…">${c?.bio || ""}</textarea></label>
      <div class="field"><span>Projetos</span><div id="projs" class="stack" style="gap:8px">${(c?.projetos?.length ? c.projetos : [{}]).map(projRow)}</div>
        <button type="button" class="btn btn-quiet btn-sm" id="addproj" style="justify-self:start">${icon("plus")} Adicionar projeto</button></div>
      <div class="grid2" style="gap:12px">
        <label class="field"><span>Instagram</span><input name="instagram" maxlength="200" placeholder="@usuario ou link" value="${c?.instagram || ""}"></label>
        <label class="field"><span>LinkedIn</span><input name="linkedin" maxlength="300" placeholder="link do perfil" value="${c?.linkedin || ""}"></label>
        <label class="field"><span>Site</span><input name="site" maxlength="300" placeholder="link" value="${c?.site || ""}"></label>
        <label class="field"><span>Ordem na página</span><input name="ordem" type="number" min="0" max="99" value="${c?.ordem ?? rows.length + 1}"><small>Números menores aparecem primeiro.</small></label>
      </div>
      <div class="row"><button class="btn btn-ink" type="submit">${c ? "Salvar alterações" : "Adicionar criador"}</button><button class="btn btn-quiet" type="button" id="cancel">Cancelar</button></div>
    </form>`.s;
    const f = $("#cf", box);
    f.foto.addEventListener("change", () => {
      const file = f.foto.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      f.querySelector(".creator-photo-edit").innerHTML = html`<img src="${url}" alt="">`.s;
      f.querySelector(".creator-photo-edit").append(f.foto);
    });
    $("#addproj", box).addEventListener("click", () => $("#projs", box).insertAdjacentHTML("beforeend", projRow().s));
    $("#projs", box).addEventListener("click", (e) => { if (e.target.closest("[data-rmproj]")) e.target.closest(".proj-row").remove(); });
    $("#cancel", box).addEventListener("click", () => { box.innerHTML = ""; editing = null; });
    f.addEventListener("submit", save);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    f.nome.focus();
  }

  async function save(e) {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("[type=submit]");
    const nome = f.nome.value.trim();
    if (!nome) { toast("Informe o nome.", "err"); return; }
    btn.disabled = true; btn.textContent = "Salvando…";
    try {
      let foto = editing?.foto || null;
      const file = f.foto.files[0];
      if (file) {
        if (file.size > 6 * 1024 * 1024) throw new Error("A foto passa de 6 MB.");
        foto = await upload(`${auth.user.id}/criadores/${crypto.randomUUID()}.${(file.type.split("/")[1] || "jpg")}`, file);
      }
      const projetos = [...f.querySelectorAll(".proj-row")].map((r) => ({ nome: r.querySelector('[name="pnome"]').value.trim(), descricao: r.querySelector('[name="pdesc"]').value.trim(), link: r.querySelector('[name="plink"]').value.trim() })).filter((p) => p.nome);
      const content = JSON.stringify({ bio: f.bio.value.trim(), projetos, instagram: f.instagram.value.trim(), linkedin: f.linkedin.value.trim(), site: f.site.value.trim(), ordem: Number(f.ordem.value) || 0 });
      const data = { title: nome, summary: f.funcao.value.trim() || null, content, image_url: foto };
      if (editing) await update("news", { id: `eq.${editing.id}` }, { ...data, updated_at: new Date().toISOString() });
      else await insert("news", { ...data, slug: `criador-${slugify(nome)}-${Date.now().toString(36).slice(-4)}`, category: "comunidade", published: true, author_id: auth.user.id, author_name: me.profile?.full_name || "Gestão FireHelp" }, "id");
      toast(editing ? "Criador atualizado." : "Criador adicionado.");
      $("#form-box", el).innerHTML = ""; editing = null;
      load();
    } catch (ex) {
      toast(ex.message?.startsWith("A foto") ? ex.message : "Não foi possível salvar. Só a gestão pode editar esta página.", "err");
      btn.disabled = false; btn.textContent = "Tentar de novo";
    }
  }

  el.addEventListener("click", async (e) => {
    if (e.target.closest("#add")) { openForm(); return; }
    const card = e.target.closest(".creator[data-id]");
    if (!card) return;
    const c = rows.find((x) => x.id === card.dataset.id);
    if (e.target.closest("[data-edit]")) openForm(c);
    if (e.target.closest("[data-del]")) {
      if (!(await confirmDialog(`Remover ${c.nome} da página de criadores?`, { ok: "Remover", danger: true }))) return;
      try { await remove("news", { id: `eq.${c.id}` }); toast("Criador removido."); load(); }
      catch { toast("Não foi possível remover.", "err"); }
    }
  });

  load();
}
