import { html, icon, FORUM_CATS, lbl, ago, avatar, skeleton, errorBox, toast, $ } from "../ui.js";
import { q, insert, upload } from "../sb.js";
import { go } from "../main.js";
import { me, displayName, loadMe } from "../store.js";
import { profilesFor } from "../data.js";

export default async function comunidade({ el, query }) {
  await (me.ready ? null : loadMe());
  let cat = query.get("categoria") || "all";
  el.innerHTML = html`<section class="wrap pad" style="max-width:880px">
    <div class="page-head">
      <div><h1 class="h1">Comunidade</h1><p class="lead">Converse com vizinhos sobre fumaça na região, prevenção, meio ambiente e segurança em Saquarema.</p></div>
      ${me.user ? (me.needsCpf ? html`<a class="btn btn-ink" href="/completar-cadastro">Completar cadastro para participar</a>` : html`<button class="btn btn-ink" id="new">${icon("plus")} Novo tópico</button>`) : html`<a class="btn btn-ink" href="/auth">Entrar para participar</a>`}
    </div>
    <form class="card stack" id="composer" hidden style="margin-bottom:22px">
      <h2 class="h3">Novo tópico</h2>
      <label class="field"><span>Título</span><input name="title" maxlength="200" required placeholder="Ex.: Fumaça forte perto da Lagoa de Jaconé"></label>
      <label class="field"><span>Mensagem</span><textarea name="content" rows="5" maxlength="20000" required placeholder="Conte o que está acontecendo ou o que você quer perguntar."></textarea></label>
      <div class="field"><span>Assunto</span><div class="chips" id="post-cat">${FORUM_CATS.map(([v, l], i) => html`<button type="button" class="chip" data-v="${v}" aria-pressed="${i === FORUM_CATS.length - 1}">${l}</button>`)}</div></div>
      <label class="field"><span>Foto (opcional)</span><input type="file" name="photo" accept="image/*"></label>
      <div class="row"><button class="btn btn-ink" type="submit">Publicar tópico</button><button class="btn btn-quiet" type="button" id="cancel">Cancelar</button></div>
    </form>
    <div class="scroll-x" style="margin-bottom:18px"><div class="chips" id="cats">
      <button class="chip" data-v="all" aria-pressed="${cat === "all"}">Todos</button>
      ${FORUM_CATS.map(([v, l]) => html`<button class="chip" data-v="${v}" aria-pressed="${cat === v}">${l}</button>`)}
    </div></div>
    <div id="list">${skeleton(4, 110)}</div>
  </section>`.s;

  const list = $("#list", el);
  async function load() {
    try {
      const params = { select: "id,title,content,category,author_name,user_id,is_demo,created_at,image_url,forum_comments(id,created_at)", order: "created_at.desc" };
      if (cat !== "all") params.category = `eq.${cat}`;
      const rows = await q("forum_posts", params);
      const who = await profilesFor(rows.map((r) => r.user_id));
      list.innerHTML = rows.length ? html`<div class="stack">${rows.map((p) => {
        const c = p.forum_comments || [];
        const last = c.map((x) => x.created_at).sort().at(-1);
        const prof = who(p.user_id);
        return html`<a class="card topic" href="/comunidade/${p.id}">
          <div class="byline">${avatar(prof?.avatar_url, p.author_name, "sm")}<span><b>${prof?.full_name || p.author_name || "Membro"}</b> · ${ago(p.created_at)}</span><span class="tag" style="margin-left:auto">${lbl(FORUM_CATS, p.category)}</span></div>
          <h3>${p.title}</h3>
          <p>${p.content}</p>
          <div class="topic-foot"><span>${icon("chat")} ${c.length === 1 ? "1 resposta" : `${c.length} respostas`}</span>${last ? html`<span>última ${ago(last)}</span>` : ""}${p.image_url ? html`<span>${icon("image")} foto</span>` : ""}</div>
        </a>`;
      })}</div>`.s : html`<div class="empty"><img src="/assets/mimo-wave.webp" alt=""><p>Nenhum tópico ${cat === "all" ? "ainda" : "neste assunto"}. Que tal começar a conversa?</p></div>`.s;
    } catch { list.innerHTML = errorBox().s; }
  }

  $("#cats", el).addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    cat = b.dataset.v;
    el.querySelectorAll("#cats .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    history.replaceState(null, "", cat === "all" ? "/comunidade" : `/comunidade?categoria=${cat}`);
    list.innerHTML = skeleton(3, 110).s;
    load();
  });

  const form = $("#composer", el);
  let postCat = "geral";
  $("#new", el)?.addEventListener("click", () => { form.hidden = false; form.title.focus(); });
  $("#cancel", el).addEventListener("click", () => { form.hidden = true; });
  $("#post-cat", el).addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    postCat = b.dataset.v;
    el.querySelectorAll("#post-cat .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = form.title.value.trim(), content = form.content.value.trim();
    if (!title || !content) { toast("Preencha título e mensagem.", "err"); return; }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true; btn.textContent = "Publicando…";
    try {
      let image_url = null;
      const photo = form.photo.files[0];
      if (photo) image_url = await upload(`${me.user.id}/posts/${crypto.randomUUID()}.${(photo.name.split(".").pop() || "jpg").toLowerCase()}`, photo);
      const [post] = await insert("forum_posts", { user_id: me.user.id, author_name: displayName(), title, content, category: postCat, image_url }, "id");
      toast("Tópico publicado.");
      go(`/comunidade/${post.id}`);
    } catch {
      toast("Não foi possível publicar. Tente de novo.", "err");
      btn.disabled = false; btn.textContent = "Publicar tópico";
    }
  });
  load();
}
