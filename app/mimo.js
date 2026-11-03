// Mimo: o assistente do FireHelp, sempre à mão no canto da tela.
import { html, icon, esc, $ } from "./ui.js";

export const POSES = {
  acenando: "/assets/mimo/acenando.webp", joinha: "/assets/mimo/joinha.webp", lupa: "/assets/mimo/lupa.webp",
  comemorando: "/assets/mimo/comemorando.webp", pensando: "/assets/mimo/pensando.webp", notebook: "/assets/mimo/notebook.webp",
  megafone: "/assets/mimo/megafone.webp", placa: "/assets/mimo/placa.webp", apontando: "/assets/mimo/apontando.webp",
  escudo: "/assets/mimo/escudo.webp", arvore: "/assets/mimo/arvore.webp", planeta: "/assets/mimo/planeta.webp",
  celular: "/assets/mimo/celular.webp", heroi: "/assets/mimo/heroi.webp", deitado: "/assets/mimo/deitado.webp",
  ideia: "/assets/mimo/ideia.webp", abraco: "/assets/mimo/abraco.webp",
};

const GREETS = {
  "/": "Oi! Eu sou o Mimo 🔥 Viu fumaça? Posso te ajudar a avisar. Ou me pergunte sobre prevenção!",
  "/mapa": "Aqui ficam os avisos da comunidade. Toque num marcador para ver detalhes, ou me pergunte o que cada cor significa.",
  "/reportar": "Vou te ajudar a avisar o foco. Mande uma foto ou vídeo e eu confiro se tem fogo ou fumaça.",
  "/noticias": "Fique de olho nos alertas! Quer dicas para proteger sua casa na seca?",
  "/comunidade": "Bora conversar com os vizinhos? Posso sugerir um assunto.",
  "/membros": "Essa é a nossa turma! Mande uma mensagem para combinar ações no seu bairro.",
};
const SUGGEST = ["Vi fumaça, e agora?", "Como reportar um foco?", "Dicas de prevenção", "O que significa cada situação?"];

// Respostas prontas quando a IA não está disponível.
const FAQ = [
  [/fuma|fogo|chama|queiman|incend|perig/i, "Se o fogo estiver perto de pessoas, casas ou animais, ligue 193 agora e se afaste. Depois, registre em Reportar foco: escolha o tipo, marque o local e mande uma foto de longe. Eu confiro a foto pra você."],
  [/report|avisar|registr|denunc/i, "Toque no botão vermelho Reportar: escolha o que está queimando, o tamanho, marque o local (GPS ou mapa) e mande foto ou vídeo. Eu analiso a imagem e você recebe um protocolo."],
  [/preven|dica|evitar|seca|proteg/i, "Não queime lixo ou folhas, mantenha o mato baixo perto de casa, bituca só no lixo, nada de balão e apague churrasco com água e terra. A restinga de Saquarema pega fogo rapidinho!"],
  [/situa|status|cor|recebido|verificado|resolvid/i, "Recebido = aviso novo; Verificado = a equipe confirmou; Fogo ativo = incêndio em andamento; Resolvido = apagado; Encerrado = sem confirmação."],
  [/telefone|n[uú]mero|ligar|193|199|emerg/i, "Bombeiros 193 · Defesa Civil 199 · SAMU 192 · Polícia Militar 190. Em emergência, ligue antes de qualquer coisa."],
  [/conta|login|entrar|cpf|senha|google/i, "Você pode entrar com e-mail e senha ou com o Google. O CPF serve só para evitar contas falsas e fica guardado de forma protegida."],
  [/whats|zap|grupo/i, "Temos um grupo no WhatsApp! Procure o botão verde \"Entre no nosso grupo do WhatsApp\" na página inicial ou no rodapé."],
  [/criador|quem fez|quem criou/i, "Quem criou o FireHelp está na página /criadores — lá tem foto, história e projetos de cada um."],
  [/mimo|quem [eé] voc/i, "Sou o Mimo, um mico-leão-dourado bombeiro! Meus parentes vivem na Mata Atlântica do Rio — por isso eu cuido tanto da mata de Saquarema."],
];
const fallback = (q) => (FAQ.find(([re]) => re.test(q)) || [, "Ainda estou aprendendo essa! Dá uma olhada em Como funciona, ou pergunte sobre como reportar, prevenção ou números de emergência."])[1];

let history = [];
let open = false;

export function mountMimo() {
  if ($("#mimo")) return;
  const box = document.createElement("div");
  box.id = "mimo";
  box.innerHTML = html`
    <div class="mimo-bubble" id="mimo-tip" hidden><span></span><button type="button" aria-label="Fechar dica">${icon("x")}</button></div>
    <button class="mimo-fab" id="mimo-fab" type="button" aria-label="Conversar com o Mimo" aria-expanded="false">
      <img src="/assets/mimo/rosto.webp" alt="" width="64" height="64">
    </button>
    <section class="mimo-panel" id="mimo-panel" role="dialog" aria-label="Conversa com o Mimo" hidden>
      <header class="mimo-head">
        <img src="/assets/mimo/rosto.webp" alt="" width="40" height="40">
        <div><b>Mimo</b><small>assistente do FireHelp</small></div>
        <button type="button" class="mimo-x" id="mimo-close" aria-label="Fechar">${icon("x")}</button>
      </header>
      <div class="mimo-log" id="mimo-log" aria-live="polite"></div>
      <div class="mimo-sugs" id="mimo-sugs"></div>
      <form class="mimo-form" id="mimo-form">
        <input id="mimo-in" maxlength="600" placeholder="Pergunte ao Mimo…" autocomplete="off" aria-label="Mensagem para o Mimo">
        <button class="btn btn-fire" type="submit" aria-label="Enviar">${icon("send")}</button>
      </form>
    </section>`.s;
  document.body.append(box);

  const panel = $("#mimo-panel"), fab = $("#mimo-fab"), log = $("#mimo-log"), input = $("#mimo-in");
  const toggle = (state = !open) => {
    open = state;
    panel.hidden = !open;
    fab.setAttribute("aria-expanded", String(open));
    box.classList.toggle("is-open", open);
    $("#mimo-tip").hidden = true;
    if (open) {
      if (!history.length) say("assistant", GREETS[location.pathname] || GREETS["/"]);
      drawSugs();
      setTimeout(() => input.focus(), 50);
    }
  };
  fab.addEventListener("click", () => toggle());
  $("#mimo-close").addEventListener("click", () => toggle(false));
  $("#mimo-tip button").addEventListener("click", () => { $("#mimo-tip").hidden = true; try { sessionStorage.setItem("fh-tip-off", "1"); } catch { /* */ } });
  $("#mimo-tip span").addEventListener("click", () => toggle(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) toggle(false); });
  document.addEventListener("click", (e) => { const t = e.target.closest("[data-mimo]"); if (t) { e.preventDefault(); toggle(true); if (t.dataset.mimo) send(t.dataset.mimo); } });

  function say(role, text) {
    history.push({ role, text });
    const el = document.createElement("div");
    el.className = `mimo-msg ${role === "user" ? "me" : ""}`;
    el.innerHTML = esc(text).replace(/\n/g, "<br>").replace(/(^|\s)(\/[a-z-]+)/g, '$1<a href="$2">$2</a>');
    log.append(el);
    log.scrollTop = log.scrollHeight;
  }
  function drawSugs() {
    $("#mimo-sugs").innerHTML = history.length > 2 ? "" : SUGGEST.map((s) => html`<button type="button" class="chip">${s}</button>`.s).join("");
  }
  $("#mimo-sugs").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) send(b.textContent); });
  $("#mimo-form").addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });

  async function send(text) {
    text = String(text || "").trim();
    if (!text) return;
    input.value = "";
    say("user", text);
    drawSugs();
    const typing = document.createElement("div");
    typing.className = "mimo-msg typing"; typing.innerHTML = "<i></i><i></i><i></i>";
    log.append(typing); log.scrollTop = log.scrollHeight;
    let reply;
    try {
      const r = await fetch("/api/mimo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, page: location.pathname }) });
      const d = await r.json();
      reply = d.reply || fallback(text);
    } catch { reply = fallback(text); }
    typing.remove();
    say("assistant", reply);
  }

  // Dica de boas-vindas (uma vez por visita)
  setTimeout(() => {
    let off = false; try { off = sessionStorage.getItem("fh-tip-off") === "1"; } catch { /* */ }
    if (open || off || location.pathname === "/") return; // na home o Mimo já fala no topo
    const tip = $("#mimo-tip");
    tip.querySelector("span").textContent = GREETS[location.pathname] || GREETS["/"];
    tip.hidden = false;
    try { sessionStorage.setItem("fh-tip-off", "1"); } catch { /* */ }
    setTimeout(() => { tip.hidden = true; }, 9000);
  }, 2500);
}
