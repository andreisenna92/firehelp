import { html, icon, avatar, ago, fmtDateTime, lbl, FIRE_TYPES, NEWS_CATS, STATUSES, statusBadge, sevLabel, isVideo, slugify, skeleton, errorBox, toast, confirmDialog, $ } from "../ui.js";
import { q, insert, update, remove, rpc, upload, auth } from "../sb.js";
import { me, loadMe, displayName } from "../store.js";
import { getReports } from "../data.js";

const TABS = [["ocorrencias", "Ocorrências"], ["noticias", "Notícias"], ["comunidade", "Comunidade"], ["denuncias", "Denúncias"], ["membros", "Membros"]];

export default async function admin({ el, query }) {
  await (me.ready ? null : loadMe());
  if (!me.isStaff) {
    el.innerHTML = html`<section class="wrap narrow pad"><h1 class="h1">Área da gestão</h1><p class="lead">Esta página é só para a equipe que modera o FireHelp.</p><a class="btn btn-ink" href="/">Voltar ao início</a></section>`.s;
    return;
  }
  let tab = TABS.some(([t]) => t === query.get("aba")) ? query.get("aba") : "ocorrencias";
  el.innerHTML = html`<section class="wrap pad">
    <div class="page-head"><div><h1 class="h1">Painel de gestão</h1><p class="lead">Verifique avisos, publique alertas e modere a comunidade.</p></div></div>
    <div class="tabs" role="tablist" id="tabs">${TABS.map(([t, l]) => html`<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${l}<span class="count-pill" data-count="${t}" hidden></span></button>`)}</div>
    <div id="pane"></div>
  </section>`.s;
  const pane = $("#pane", el);

  $("#tabs", el).addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.dataset.tab;
    el.querySelectorAll("#tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    history.replaceState(null, "", `/admin?aba=${tab}`);
    show();
  });
  const badge = (t, n) => { const s = el.querySelector(`[data-count="${t}"]`); if (s) { s.hidden = !n; s.textContent = n; } };
  getReports({ status: "eq.pending" }).then((r) => badge("ocorrencias", r.length)).catch(() => {});
  q("content_reports", { select: "id", resolved: "eq.false" }).then((r) => badge("denuncias", r.length)).catch(() => {});

  async function show() {
    pane.innerHTML = skeleton(3, 120).s;
    try { await PANES[tab](pane, { badge, refresh: show }); }
    catch (e) { console.error(e); pane.innerHTML = errorBox().s; }
  }
  show();
}

const PANES = {
  /* ---------------- ocorrências ---------------- */
  async ocorrencias(pane, { badge, refresh }) {
    let filter = "pending";
    const all = await getReports();
    const draw = () => {
      const rows = all.filter((r) => filter === "all" || r.status === filter);
      pane.innerHTML = html`
        <div class="scroll-x" style="margin-bottom:16px"><div class="chips" id="sf">
          ${[["pending", "Para verificar"], ["active", "Fogo ativo"], ["verified", "Verificados"], ["resolved", "Resolvidos"], ["false_report", "Encerrados"], ["all", "Todos"]].map(([v, l]) => html`<button class="chip" data-v="${v}" aria-pressed="${v === filter}">${l} (${v === "all" ? all.length : all.filter((r) => r.status === v).length})</button>`)}
        </div></div>
        ${rows.length ? html`<div class="stack">${rows.map((r) => html`<div class="card admin-item" data-id="${r.id}">
          <div class="row between"><b class="h3">${lbl(FIRE_TYPES, r.type)} · ${sevLabel(r.severity)}</b>${statusBadge(r.status)}</div>
          <p class="small muted" style="margin:0">${r.protocol} · ${fmtDateTime(r.reported_at)} · ${r.address || `${(+r.latitude).toFixed(5)}, ${(+r.longitude).toFixed(5)}`}</p>
          ${r.description ? html`<p style="margin:0">${r.description}</p>` : ""}
          ${r.fire_report_images?.length ? html`<div class="media-row">${r.fire_report_images.map((m) => isVideo(m.image_url) ? html`<video src="${m.image_url}" controls preload="none"></video>` : html`<a href="${m.image_url}" target="_blank" rel="noopener"><img src="${m.image_url}" alt="" loading="lazy"></a>`)}</div>` : ""}
          <div class="status-row" role="group" aria-label="Mudar situação">${Object.entries(STATUSES).map(([v, [l]]) => html`<button class="chip" data-status="${v}" aria-pressed="${r.status === v}">${l}</button>`)}</div>
          <div class="row"><a class="link-btn" href="/mapa?o=${r.id}">${icon("map")} Ver no mapa</a><a class="link-btn" href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">${icon("pin")} Abrir no Google Maps</a><button class="link-btn danger" data-hide>${icon("trash")} Excluir aviso</button></div>
        </div>`)}</div>` : html`<div class="empty"><p>Nada aqui. ${filter === "pending" ? "Todos os avisos foram verificados." : ""}</p></div>`}`.s;
    };
    pane.onclick = async (e) => {
      const chip = e.target.closest("#sf .chip");
      if (chip) { filter = chip.dataset.v; draw(); return; }
      const card = e.target.closest("[data-id]");
      if (!card) return;
      const r = all.find((x) => x.id === card.dataset.id);
      const st = e.target.closest("[data-status]");
      if (st && st.dataset.status !== r.status) {
        try {
          await update("fire_reports", { id: `eq.${r.id}` }, { status: st.dataset.status });
          r.status = st.dataset.status;
          toast(`Situação alterada para "${STATUSES[r.status][0]}".`);
          badge("ocorrencias", all.filter((x) => x.status === "pending").length);
          draw();
        } catch { toast("Não foi possível alterar a situação.", "err"); }
      }
      if (e.target.closest("[data-hide]")) {
        if (!(await confirmDialog(`Excluir o aviso ${r.protocol}? Ele sai do mapa e das listas. O histórico fica guardado no banco.`, { ok: "Excluir aviso", danger: true }))) return;
        try { await update("fire_reports", { id: `eq.${r.id}` }, { published: false, deleted_at: new Date().toISOString() }); toast("Aviso excluído."); refresh(); }
        catch { toast("Não foi possível remover.", "err"); }
      }
    };
    draw();
  },

  /* ---------------- notícias ---------------- */
  async noticias(pane, { refresh }) {
    const rows = await q("news", { select: "*", slug: "not.like.criador-*", order: "created_at.desc" });
    let editing = rows.find((n) => n.id === new URLSearchParams(location.search).get("editar")) || null;
    const form = (n = {}) => html`<form class="card stack" id="nf">
      <h2 class="h3">${n.id ? "Editar notícia" : "Nova notícia ou alerta"}</h2>
      <label class="field"><span>Título</span><input name="title" maxlength="200" required value="${n.title || ""}"></label>
      <label class="field"><span>Resumo <small>(aparece na lista)</small></span><input name="summary" maxlength="300" value="${n.summary || ""}"></label>
      <label class="field"><span>Texto completo <small>(deixe uma linha em branco entre parágrafos)</small></span><textarea name="content" rows="8" required>${n.content || ""}</textarea></label>
      <label class="field"><span>Categoria</span><select name="category">${NEWS_CATS.map(([v, l]) => html`<option value="${v}" ${v === (n.category || "prevencao") ? "selected" : ""}>${l}</option>`)}</select></label>
      <div class="field"><span>Imagem</span><div class="row"><input type="file" name="file" accept="image/*"><input name="image_url" class="input" style="flex:1;min-width:220px" placeholder="ou cole o endereço de uma imagem" value="${n.image_url || ""}"></div></div>
      <label class="check"><input type="checkbox" name="published" ${n.published === false ? "" : "checked"}> <span>Publicar agora (desmarque para salvar como rascunho)</span></label>
      <div class="row"><button class="btn btn-ink" type="submit">${n.id ? "Salvar alterações" : "Publicar"}</button>${n.id ? html`<button class="btn btn-quiet" type="button" data-cancel>Cancelar</button>` : ""}</div>
    </form>`;
    const draw = () => {
      pane.innerHTML = html`<div class="stack-l">
        ${form(editing || {})}
        <div class="stack">${rows.map((n) => html`<div class="card row between" data-id="${n.id}">
          <div style="min-width:0;flex:1"><b>${n.title}</b><p class="tiny" style="margin:2px 0 0">${n.published ? "Publicada" : "Rascunho"} · ${lbl(NEWS_CATS, n.category)} · ${ago(n.created_at)}</p></div>
          <div class="row"><button class="btn btn-quiet btn-sm" data-edit>${icon("edit")} Editar</button><button class="btn btn-quiet btn-sm" data-pub>${n.published ? "Despublicar" : "Publicar"}</button><button class="btn btn-danger btn-sm" data-del>Excluir</button></div>
        </div>`)}</div></div>`.s;
      $("#nf", pane).addEventListener("submit", save);
    };
    async function save(e) {
      e.preventDefault();
      const f = e.target, btn = f.querySelector("[type=submit]");
      const title = f.title.value.trim(), content = f.content.value.trim();
      if (!title || !content) { toast("Título e texto são obrigatórios.", "err"); return; }
      btn.disabled = true; btn.textContent = "Salvando…";
      try {
        let image_url = f.image_url.value.trim() || null;
        if (f.file.files[0]) image_url = await upload(`${auth.user.id}/news/${crypto.randomUUID()}.${f.file.files[0].name.split(".").pop().toLowerCase()}`, f.file.files[0]);
        const data = { title, summary: f.summary.value.trim() || null, content, category: f.category.value, image_url, published: f.published.checked };
        if (editing) await update("news", { id: `eq.${editing.id}` }, { ...data, updated_at: new Date().toISOString() });
        else await insert("news", { ...data, slug: `${slugify(title)}-${Date.now().toString(36).slice(-4)}`, author_id: auth.user.id, author_name: displayName() }, "id");
        toast(editing ? "Notícia atualizada." : data.published ? "Notícia publicada." : "Rascunho salvo.");
        refresh();
      } catch { toast("Não foi possível salvar a notícia.", "err"); btn.disabled = false; btn.textContent = "Tentar de novo"; }
    }
    pane.onclick = async (e) => {
      if (e.target.closest("[data-cancel]")) { editing = null; draw(); return; }
      const card = e.target.closest("[data-id]");
      if (!card) return;
      const n = rows.find((x) => x.id === card.dataset.id);
      if (e.target.closest("[data-edit]")) { editing = n; draw(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      if (e.target.closest("[data-pub]")) {
        try { await update("news", { id: `eq.${n.id}` }, { published: !n.published }); n.published = !n.published; toast(n.published ? "Notícia publicada." : "Notícia despublicada."); draw(); }
        catch { toast("Não foi possível alterar.", "err"); }
      }
      if (e.target.closest("[data-del]")) {
        if (!(await confirmDialog(`Excluir "${n.title}"? Não dá para desfazer.`, { ok: "Excluir", danger: true }))) return;
        try { await remove("news", { id: `eq.${n.id}` }); toast("Notícia excluída."); refresh(); }
        catch { toast("Não foi possível excluir.", "err"); }
      }
    };
    draw();
  },

  /* ---------------- comunidade ---------------- */
  async comunidade(pane, { refresh }) {
    const rows = await q("forum_posts", { select: "id,title,author_name,created_at,forum_comments(id)", order: "created_at.desc" });
    pane.innerHTML = rows.length ? html`<div class="stack">${rows.map((p) => html`<div class="card row between" data-id="${p.id}">
      <div style="min-width:0;flex:1"><a href="/comunidade/${p.id}"><b>${p.title}</b></a><p class="tiny" style="margin:2px 0 0">${p.author_name || "Membro"} · ${ago(p.created_at)} · ${p.forum_comments?.length || 0} respostas</p></div>
      <button class="btn btn-danger btn-sm" data-del>Remover</button>
    </div>`)}</div>`.s : html`<div class="empty"><p>Nenhum tópico ainda.</p></div>`.s;
    pane.onclick = async (e) => {
      const card = e.target.closest("[data-id]");
      if (!card || !e.target.closest("[data-del]")) return;
      if (!(await confirmDialog("Remover este tópico e todas as respostas?", { ok: "Remover", danger: true }))) return;
      try { await remove("forum_posts", { id: `eq.${card.dataset.id}` }); toast("Tópico removido."); refresh(); }
      catch { toast("Não foi possível remover.", "err"); }
    };
  },

  /* ---------------- denúncias ---------------- */
  async denuncias(pane, { badge, refresh }) {
    const rows = await q("content_reports", { select: "*", order: "resolved.asc,created_at.desc" });
    const comments = rows.filter((r) => r.target_type === "forum_comment").map((r) => r.target_id);
    const map = new Map();
    if (comments.length) (await q("forum_comments", { select: "id,post_id,content", id: `in.(${comments.join(",")})` }).catch(() => [])).forEach((c) => map.set(c.id, c));
    const link = (r) => r.target_type === "forum_post" ? `/comunidade/${r.target_id}` : map.get(r.target_id) ? `/comunidade/${map.get(r.target_id).post_id}#c-${r.target_id}` : null;
    pane.innerHTML = rows.length ? html`<div class="stack">${rows.map((r) => html`<div class="card stack" style="gap:6px;${r.resolved ? "opacity:.6" : ""}" data-id="${r.id}">
      <div class="row between"><b>${r.reason}</b><span class="tag">${r.resolved ? "Resolvida" : "Aberta"}</span></div>
      <p class="tiny" style="margin:0">${r.target_type === "forum_post" ? "Tópico" : "Resposta"} · ${fmtDateTime(r.created_at)}</p>
      ${r.details ? html`<p style="margin:0">${r.details}</p>` : ""}
      ${map.get(r.target_id) ? html`<p class="small muted" style="margin:0;border-left:3px solid var(--line);padding-left:10px">${map.get(r.target_id).content}</p>` : ""}
      <div class="row">${link(r) ? html`<a class="link-btn" href="${link(r)}">Ver conteúdo</a>` : html`<span class="tiny">Conteúdo já removido</span>`}${r.resolved ? "" : html`<button class="btn btn-line btn-sm" data-ok>${icon("check")} Marcar como resolvida</button>`}</div>
    </div>`)}</div>`.s : html`<div class="empty"><p>Nenhuma denúncia. A comunidade está tranquila.</p></div>`.s;
    pane.onclick = async (e) => {
      const card = e.target.closest("[data-id]");
      if (!card || !e.target.closest("[data-ok]")) return;
      try { await update("content_reports", { id: `eq.${card.dataset.id}` }, { resolved: true }); toast("Denúncia resolvida."); badge("denuncias", rows.filter((r) => !r.resolved).length - 1); refresh(); }
      catch { toast("Não foi possível atualizar.", "err"); }
    };
  },

  /* ---------------- membros ---------------- */
  async membros(pane, { refresh }) {
    const rows = await rpc("list_admin_members");
    const level = { super_admin: "Proprietário", admin: "Administrador", member: "Membro" };
    pane.innerHTML = html`<div class="search" style="margin-bottom:14px">${icon("search")}<input class="input" id="mq" type="search" placeholder="Buscar por nome ou e-mail"></div><div id="ml"></div>
      ${me.isSuper ? "" : html`<p class="tiny">Só o proprietário pode promover, rebaixar ou excluir contas. Administradores podem suspender e reativar.</p>`}`.s;
    const draw = (t = "") => {
      const list = rows.filter((m) => `${m.full_name} ${m.email}`.toLowerCase().includes(t.toLowerCase()));
      $("#ml", pane).innerHTML = html`<div class="stack">${list.map((m) => html`<div class="card member" data-id="${m.id}">
        ${avatar(m.avatar_url, m.full_name, "md")}
        <div class="info"><b>${m.full_name}</b><span class="tiny">${m.email} · ${level[m.access_level] || "Membro"}${m.blocked ? " · suspenso" : ""}</span></div>
        ${m.id !== me.user.id && m.access_level !== "super_admin" ? html`<div class="row">
          ${me.isSuper ? html`<button class="btn btn-quiet btn-sm" data-role="${m.access_level === "admin" ? "down" : "up"}">${m.access_level === "admin" ? "Tirar de administrador" : "Promover a administrador"}</button>` : ""}
          <button class="btn ${m.blocked ? "btn-line" : "btn-quiet"} btn-sm" data-block="${!m.blocked}">${m.blocked ? "Reativar" : "Suspender"}</button>
          ${me.isSuper ? html`<button class="btn btn-danger btn-sm" data-remove aria-label="Excluir conta de ${m.full_name}">${icon("trash")}</button>` : ""}
        </div>` : ""}
      </div>`)}</div>`.s;
    };
    $("#mq", pane).addEventListener("input", (e) => draw(e.target.value));
    pane.onclick = async (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;
      const m = rows.find((x) => x.id === card.dataset.id);
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.dataset.role) {
          const up = b.dataset.role === "up";
          if (!(await confirmDialog(up ? `Dar acesso de gestão para ${m.full_name}?` : `Tirar ${m.full_name} da gestão?`))) return;
          await rpc("set_member_manager", { target_id: m.id, make_manager: up });
          toast(up ? "Agora faz parte da gestão." : "Acesso de gestão removido.");
        } else if (b.dataset.block) {
          const block = b.dataset.block === "true";
          if (block && !(await confirmDialog(`Suspender ${m.full_name}? A pessoa não consegue mais entrar até ser reativada.`, { ok: "Suspender", danger: true }))) return;
          await update("profiles", { id: `eq.${m.id}` }, { blocked: block });
          toast(block ? "Conta suspensa." : "Conta reativada.");
        } else if (b.hasAttribute("data-remove")) {
          if (!(await confirmDialog(`Excluir a conta de ${m.full_name}? Publicações e mensagens são preservadas. Não dá para desfazer.`, { ok: "Excluir conta", danger: true }))) return;
          const res = await fetch("/api/remove-member", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` }, body: JSON.stringify({ userId: m.id }) });
          const d = await res.json().catch(() => ({ error: "Falha ao excluir." }));
          if (d.error) throw new Error(d.error);
          toast("Conta excluída. Contribuições preservadas.");
        } else return;
        refresh();
      } catch (ex) { toast(ex.message || "Não foi possível concluir.", "err"); }
    };
    draw();
  },
};
