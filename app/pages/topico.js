import { html, icon, FORUM_CATS, REPORT_REASONS, lbl, ago, fmtDateTime, avatar, paragraphs, skeleton, errorBox, toast, confirmDialog, choiceDialog, $ } from "../ui.js";
import { q, insert, update, remove, upload } from "../sb.js";
import { go } from "../main.js";
import { me, displayName, loadMe } from "../store.js";
import { profilesFor } from "../data.js";

export default async function topico({ el, params }) {
  await (me.ready ? null : loadMe());
  const id = params.id;
  let post, comments = [], likes = [], replyTo = null, who = () => null;
  el.innerHTML = html`<section class="wrap narrow pad">${skeleton(1, 200)}</section>`.s;

  async function load() {
    try {
      [post, comments] = await Promise.all([
        q("forum_posts", { select: "*", id: `eq.${id}` }, { single: true }),
        q("forum_comments", { select: "id,parent_id,user_id,author_name,content,created_at", post_id: `eq.${id}`, order: "created_at.asc" }),
      ]);
      likes = comments.length ? await q("forum_likes", { select: "id,comment_id,user_id", comment_id: `in.(${comments.map((c) => c.id).join(",")})` }).catch(() => []) : [];
    } catch { el.innerHTML = html`<section class="wrap narrow pad">${errorBox()}</section>`.s; return; }
    if (!post) { el.innerHTML = html`<section class="wrap narrow pad"><a class="back" href="/comunidade">${icon("back")} Comunidade</a><h1 class="h1">Tópico não encontrado.</h1><p class="lead">Ele pode ter sido removido.</p></section>`.s; return; }
    who = await profilesFor([post.user_id, ...comments.map((c) => c.user_id)]);
    document.title = `${post.title} · Comunidade FireHelp`;
    draw();
  }

  const canManage = (uid) => Boolean(me.user && (me.isStaff || me.user.id === uid));
  function commentHTML(c, rootId) {
    const prof = who(c.user_id);
    const n = likes.filter((l) => l.comment_id === c.id).length;
    const mine = likes.some((l) => l.comment_id === c.id && l.user_id === me.user?.id);
    return html`<div class="comment" id="c-${c.id}">
      ${avatar(prof?.avatar_url, c.author_name, "sm")}
      <div class="body">
        <div class="small"><b>${prof?.full_name || c.author_name || "Membro"}</b> <span class="muted" title="${fmtDateTime(c.created_at)}">· ${ago(c.created_at)}</span></div>
        <p>${c.content}</p>
        <div class="acts">
          <button class="link-btn ${mine ? "on" : ""}" data-like="${c.id}" aria-pressed="${mine}" aria-label="Curtir">${icon("heart")} ${n || ""}</button>
          <button class="link-btn" data-reply="${rootId}" data-name="${prof?.full_name || c.author_name || "Membro"}">${icon("reply")} Responder</button>
          <button class="link-btn" data-report="forum_comment:${c.id}">${icon("flag")} Denunciar</button>
          ${canManage(c.user_id) ? html`<button class="link-btn" data-delc="${c.id}">${icon("trash")} Apagar</button>` : ""}
        </div>
      </div>
    </div>`;
  }

  function draw() {
    const roots = comments.filter((c) => !c.parent_id);
    const kids = (pid) => comments.filter((c) => c.parent_id === pid);
    const prof = who(post.user_id);
    el.innerHTML = html`<section class="wrap narrow pad">
      <a class="back" href="/comunidade">${icon("back")} Comunidade</a>
      <article class="stack" style="gap:14px" id="post">
        <div class="byline">${avatar(prof?.avatar_url, post.author_name, "md")}<span><b>${prof?.full_name || post.author_name || "Membro"}</b><br>${fmtDateTime(post.created_at)}${post.updated_at && post.updated_at !== post.created_at ? " · editado" : ""}</span><span class="tag" style="margin-left:auto">${lbl(FORUM_CATS, post.category)}</span></div>
        <h1 class="h1">${post.title}</h1>
        <div class="prose">${paragraphs(post.content)}</div>
        ${post.image_url ? html`<img src="${post.image_url}" alt="Foto do tópico" style="border-radius:var(--r-m);max-height:480px;object-fit:contain;background:var(--sand)">` : ""}
        <div class="row">
          <button class="link-btn" data-report="forum_post:${post.id}">${icon("flag")} Denunciar tópico</button>
          ${canManage(post.user_id) ? html`<button class="link-btn" id="edit">${icon("edit")} Editar</button><button class="link-btn" id="del">${icon("trash")} Excluir</button>` : ""}
        </div>
      </article>
      <form class="card stack" id="edit-form" hidden style="margin-top:14px">
        <label class="field"><span>Título</span><input name="title" maxlength="200" value="${post.title}"></label>
        <label class="field"><span>Mensagem</span><textarea name="content" rows="6" maxlength="20000">${post.content}</textarea></label>
        <label class="field"><span>Trocar foto</span><input type="file" name="photo" accept="image/*"></label>
        ${post.image_url ? html`<label class="check"><input type="checkbox" name="nophoto"> <span>Remover a foto atual</span></label>` : ""}
        <div class="row"><button class="btn btn-ink" type="submit">Salvar alterações</button><button class="btn btn-quiet" type="button" id="edit-cancel">Cancelar</button></div>
      </form>
      <hr style="border:0;border-top:2px solid var(--ink);margin:30px 0 20px">
      <h2 class="h2" style="margin-bottom:16px">${comments.length === 1 ? "1 resposta" : `${comments.length} respostas`}</h2>
      ${me.user ? html`<form class="composer" id="cform">
        <div class="replying" id="replying" hidden><span></span><button type="button" class="link-btn" id="cancel-reply">Cancelar</button></div>
        <textarea class="input" name="msg" rows="3" maxlength="5000" placeholder="Escreva sua resposta" required></textarea>
        <div><button class="btn btn-ink" type="submit">${icon("send")} Responder</button></div>
      </form>` : html`<a class="btn btn-line" href="/auth">Entrar para responder</a>`}
      <div class="stack-l" style="margin-top:26px">
        ${roots.length ? roots.map((c) => html`<div>${commentHTML(c, c.id)}${kids(c.id).length ? html`<div class="replies">${kids(c.id).map((k) => commentHTML(k, c.id))}</div>` : ""}</div>`) : html`<p class="muted">Ninguém respondeu ainda. Seja a primeira pessoa.</p>`}
      </div>
    </section>`.s;
    bind();
  }

  function bind() {
    const root = el.firstElementChild;
    root.addEventListener("click", async (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.like) return like(t.dataset.like);
      if (t.dataset.reply) {
        if (!me.user) { go("/auth"); return; }
        replyTo = t.dataset.reply;
        const box = $("#replying", el); box.hidden = false; box.firstElementChild.textContent = `Respondendo a ${t.dataset.name}`;
        $("#cform textarea", el).focus();
        return;
      }
      if (t.id === "cancel-reply") { replyTo = null; $("#replying", el).hidden = true; return; }
      if (t.dataset.report) return report(...t.dataset.report.split(":"));
      if (t.dataset.delc) {
        if (!(await confirmDialog("Apagar este comentário?", { ok: "Apagar", danger: true }))) return;
        try { await remove("forum_comments", { id: `eq.${t.dataset.delc}` }); toast("Comentário apagado."); load(); }
        catch { toast("Não foi possível apagar.", "err"); }
        return;
      }
      if (t.id === "edit") { $("#edit-form", el).hidden = false; $("#edit-form", el).title.focus(); return; }
      if (t.id === "edit-cancel") { $("#edit-form", el).hidden = true; return; }
      if (t.id === "del") {
        if (!(await confirmDialog("Excluir este tópico e todas as respostas?", { ok: "Excluir tópico", danger: true }))) return;
        try {
          const rows = await remove("forum_posts", { id: `eq.${id}` });
          if (!rows?.length) throw new Error();
          toast("Tópico excluído.");
          go("/comunidade");
        } catch { toast("Não foi possível excluir.", "err"); }
      }
    });
    $("#cform", el)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ta = e.target.msg, content = ta.value.trim();
      if (!content) return;
      const btn = e.target.querySelector("[type=submit]"); btn.disabled = true;
      try {
        await insert("forum_comments", { post_id: id, parent_id: replyTo, user_id: me.user.id, author_name: displayName(), content }, "id");
        replyTo = null;
        await load();
        toast("Resposta publicada.");
      } catch { toast("Não foi possível responder. Tente de novo.", "err"); btn.disabled = false; }
    });
    $("#edit-form", el)?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, title = f.title.value.trim(), content = f.content.value.trim();
      if (!title || !content) { toast("Título e mensagem são obrigatórios.", "err"); return; }
      const btn = f.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Salvando…";
      try {
        let image_url = f.nophoto?.checked ? null : post.image_url;
        const photo = f.photo.files[0];
        if (photo) image_url = await upload(`${me.user.id}/posts/${crypto.randomUUID()}.${(photo.name.split(".").pop() || "jpg").toLowerCase()}`, photo);
        const rows = await update("forum_posts", { id: `eq.${id}` }, { title, content, image_url, updated_at: new Date().toISOString() });
        if (!rows?.length) throw new Error();
        toast("Tópico atualizado.");
        load();
      } catch { toast("Não foi possível salvar.", "err"); btn.disabled = false; btn.textContent = "Salvar alterações"; }
    });
  }

  async function like(commentId) {
    if (!me.user) { toast("Entre para curtir respostas.", "err"); return; }
    const mine = likes.find((l) => l.comment_id === commentId && l.user_id === me.user.id);
    try {
      if (mine) { await remove("forum_likes", { id: `eq.${mine.id}` }); likes = likes.filter((l) => l !== mine); }
      else { const [row] = await insert("forum_likes", { comment_id: commentId, user_id: me.user.id }, "id,comment_id,user_id"); likes.push(row); }
      const y = scrollY; draw(); scrollTo(0, y);
    } catch { toast("Não foi possível curtir agora.", "err"); }
  }

  async function report(type, targetId) {
    if (!me.user) { toast("Entre para denunciar conteúdo.", "err"); return; }
    const r = await choiceDialog("Por que denunciar?", REPORT_REASONS, { ok: "Enviar denúncia", withDetails: true });
    if (!r) return;
    try { await insert("content_reports", { reporter_id: me.user.id, target_type: type, target_id: targetId, reason: r.choice, details: r.details }, "id"); toast("Denúncia enviada para a moderação. Obrigado."); }
    catch { toast("Não foi possível enviar a denúncia.", "err"); }
  }

  await load();
}
