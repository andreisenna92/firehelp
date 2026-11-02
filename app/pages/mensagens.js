import { html, icon, avatar, ago, fmtDateTime, toast, errorBox, $ } from "../ui.js";
import { q, insert, update } from "../sb.js";
import { me } from "../store.js";
import { profilesFor } from "../data.js";
import { go } from "../main.js";

export default async function mensagens({ el, query }) {
  const uid = me.user.id;
  const withId = query.get("com");
  let msgs = [], who = () => null, timer, alive = true, lastCount = -1;

  el.innerHTML = html`<section class="wrap" style="padding:20px 0 0">
    <div class="chat ${withId ? "has-thread" : ""}">
      <aside class="chat-list" id="convos" aria-label="Conversas"><p class="small muted" style="padding:10px">Carregando…</p></aside>
      <div class="chat-thread" id="thread"></div>
    </div>
  </section>`.s;

  async function load() {
    try { msgs = await q("messages", { select: "*", order: "created_at.asc" }); }
    catch { if (alive && lastCount < 0) $("#convos", el).innerHTML = errorBox().s; return; }
    if (!alive) return;
    const others = [...new Set(msgs.map((m) => (m.sender_id === uid ? m.recipient_id : m.sender_id)).concat(withId || []))];
    who = await profilesFor(others);
    if (msgs.length === lastCount) return;
    lastCount = msgs.length;
    drawList(others); drawThread();
  }

  function drawList(others) {
    const conv = others.map((id) => {
      const mine = msgs.filter((m) => m.sender_id === id || m.recipient_id === id);
      return { id, last: mine.at(-1), unread: mine.filter((m) => m.recipient_id === uid && !m.read_at).length };
    }).sort((a, b) => (b.last?.created_at || "9").localeCompare(a.last?.created_at || "9"));
    $("#convos", el).innerHTML = html`
      <div class="row between" style="padding:8px 10px 10px"><h1 class="h3">Mensagens</h1><a class="link-btn" href="/membros">${icon("plus")} Nova</a></div>
      ${conv.length ? conv.map((c) => { const p = who(c.id); return html`<a class="chat-item" href="/mensagens?com=${c.id}" ${c.id === withId ? html`aria-current="true"` : ""}>
        ${avatar(p?.avatar_url, p?.full_name, "md")}
        <span class="info"><b>${p?.full_name || "Membro"}</b><span>${c.last ? `${c.last.sender_id === uid ? "Você: " : ""}${c.last.content}` : "Nova conversa"}</span></span>
        ${c.unread ? html`<span class="unread">${c.unread}</span>` : c.last ? html`<span class="tiny">${ago(c.last.created_at)}</span>` : ""}
      </a>`; }) : html`<div class="empty" style="margin:10px"><p>Nenhuma conversa ainda. Encontre alguém em Membros.</p><a class="btn btn-line btn-sm" href="/membros">Ver membros</a></div>`}`.s;
  }

  function drawThread() {
    const box = $("#thread", el);
    if (!withId) { box.innerHTML = html`<p class="muted" style="margin:auto;padding:30px">Escolha uma conversa.</p>`.s; return; }
    const p = who(withId);
    const thread = msgs.filter((m) => (m.sender_id === uid && m.recipient_id === withId) || (m.sender_id === withId && m.recipient_id === uid));
    const draft = $("#msg", el)?.value || "";
    box.innerHTML = html`
      <div class="chat-top"><a class="link-btn" href="/mensagens" aria-label="Voltar">${icon("back")}</a>${avatar(p?.avatar_url, p?.full_name, "sm")}<b>${p?.full_name || "Membro"}</b></div>
      <div class="chat-msgs" id="msgs">${thread.length ? thread.map((m) => html`<div class="bubble ${m.sender_id === uid ? "mine" : ""}">${m.content}<time>${fmtDateTime(m.created_at)}</time></div>`) : html`<p class="muted small" style="margin:auto">Diga olá para começar a conversa.</p>`}</div>
      <form class="chat-form" id="cf"><textarea class="input" id="msg" rows="1" maxlength="4000" placeholder="Escreva uma mensagem" aria-label="Mensagem"></textarea><button class="btn btn-ink" type="submit" aria-label="Enviar">${icon("send")}</button></form>`.s;
    $("#msg", el).value = draft;
    const list = $("#msgs", el); list.scrollTop = list.scrollHeight;
    const ta = $("#msg", el);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#cf", el).requestSubmit(); } });
    $("#cf", el).addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = ta.value.trim();
      if (!content) return;
      ta.value = "";
      try { await insert("messages", { sender_id: uid, recipient_id: withId, content }, "id"); lastCount = -1; await load(); }
      catch { ta.value = content; toast("Mensagem não enviada. Tente de novo.", "err"); }
    });
    const unread = thread.filter((m) => m.recipient_id === uid && !m.read_at).map((m) => m.id);
    if (unread.length) update("messages", { id: `in.(${unread.join(",")})` }, { read_at: new Date().toISOString() }).catch(() => {});
  }

  if (withId === uid) { go("/mensagens", { replace: true }); return; }
  await load();
  timer = setInterval(() => { if (!document.hidden) load(); }, 8000);
  return () => { alive = false; clearInterval(timer); };
}
