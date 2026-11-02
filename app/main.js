// Shell do aplicativo e roteador (sem framework).
import { auth } from "./sb.js";
import { me, loadMe, onMe, displayName } from "./store.js";
import { html, icon, avatar, $, $$, toast } from "./ui.js";
import { mountMimo } from "./mimo.js";

const routes = [
  ["/", "home", "Início"],
  ["/mapa", "mapa", "Mapa de ocorrências"],
  ["/reportar", "reportar", "Reportar foco de incêndio", { auth: true }],
  ["/noticias", "noticias", "Notícias e alertas"],
  ["/noticias/:slug", "noticia", "Notícia"],
  ["/comunidade", "comunidade", "Comunidade"],
  ["/comunidade/:id", "topico", "Tópico"],
  ["/como-funciona", "como-funciona", "Como funciona"],
  ["/auth", "entrar", "Entrar"],
  ["/reset-password", "nova-senha", "Nova senha"],
  ["/completar-cadastro", "completar-cadastro", "Completar cadastro", { auth: true }],
  ["/perfil", "perfil", "Meu perfil", { auth: true }],
  ["/mensagens", "mensagens", "Mensagens", { auth: true }],
  ["/membros", "membros", "Membros"],
  ["/admin", "admin", "Painel de gestão", { auth: true }],
];
const aliases = { "/entrar": "/auth", "/forum": "/comunidade", "/sobre": "/como-funciona" };

function match(path) {
  for (const [pattern, page, title, opts = {}] of routes) {
    const a = pattern.split("/"), b = path.split("/");
    if (a.length !== b.length) continue;
    const params = {};
    if (a.every((seg, i) => (seg.startsWith(":") ? (params[seg.slice(1)] = decodeURIComponent(b[i])) : seg === b[i]))) return { page, title, params, ...opts };
  }
  return null;
}

/* ---------------- shell ---------------- */
const NAV = [["/", "Início", "home"], ["/mapa", "Mapa", "map"], ["/noticias", "Notícias", "news"], ["/comunidade", "Comunidade", "chat"], ["/membros", "Membros", "users"], ["/como-funciona", "Como funciona", "info"]];

function shell() {
  document.body.innerHTML = html`
  <a class="skip" href="#main">Pular para o conteúdo</a>
  <header class="top">
    <div class="top-in">
      <a href="/" class="brand" aria-label="FireHelp Saquarema, início">
        <span class="brand-mimo" aria-hidden="true"><span class="bm-ring"></span><span class="bm-clip"><span class="bm-fig"><img src="/assets/mimo/heroi-corpo.webp" alt="" width="576" height="768"><img class="brand-hand" src="/assets/mimo/heroi-mao.webp" alt="" width="576" height="768"></span></span></span>
        <span class="brand-txt"><b>FireHelp</b><small>Saquarema</small></span>
      </a>
      <nav class="topnav" aria-label="Principal">${NAV.map(([href, label]) => html`<a href="${href}" data-nav>${label}</a>`)}</nav>
      <div class="top-actions">
        <a class="call193" href="tel:193" aria-label="Ligar para os Bombeiros, 193">${icon("phone")}<span>193</span></a>
        <a class="btn btn-fire btn-sm hide-sm" href="/reportar">${icon("flame")} Reportar foco</a>
        <div id="account"></div>
      </div>
    </div>
  </header>
  <main id="main" tabindex="-1"></main>
  <footer class="foot">
    <div class="foot-in">
      <div class="foot-emerg">
        <p class="foot-h">Emergência? Ligue primeiro.</p>
        <div class="phones">
          <a href="tel:193"><b>193</b> Bombeiros</a>
          <a href="tel:199"><b>199</b> Defesa Civil</a>
          <a href="tel:190"><b>190</b> Polícia Militar</a>
          <a href="tel:192"><b>192</b> SAMU</a>
        </div>
      </div>
      <div class="foot-about">
        <img src="/assets/mimo/rosto.webp" alt="" width="48" height="48" loading="lazy">
        <p>O FireHelp é uma rede comunitária de Saquarema para avisar, acompanhar e prevenir incêndios. Não substitui os serviços oficiais.</p>
      </div>
      <nav class="foot-links" aria-label="Rodapé">
        <a href="/como-funciona">Como funciona</a><a href="/mapa">Mapa</a><a href="/reportar">Reportar foco</a><a href="/comunidade">Comunidade</a><a href="/membros">Membros</a><a href="/noticias">Notícias</a>
      </nav>
    </div>
  </footer>
  <nav class="tabbar" aria-label="Navegação rápida">
    <a href="/" data-nav>${icon("home")}<span>Início</span></a>
    <a href="/mapa" data-nav>${icon("map")}<span>Mapa</span></a>
    <a href="/reportar" class="tab-fire" data-nav>${icon("flame")}<span>Reportar</span></a>
    <a href="/comunidade" data-nav>${icon("chat")}<span>Comunidade</span></a>
    <a href="/perfil" data-nav id="tab-me">${icon("user")}<span>Perfil</span></a>
  </nav>`.s;
  renderAccount();
}

function renderAccount() {
  const box = $("#account");
  if (!box) return;
  const tabMe = $("#tab-me span");
  if (tabMe) tabMe.textContent = me.user ? "Perfil" : "Entrar";
  $("#tab-me")?.setAttribute("href", me.user ? "/perfil" : "/auth");
  if (!me.user) { box.innerHTML = html`<a class="btn btn-line btn-sm" href="/auth">Entrar</a>`.s; return; }
  box.innerHTML = html`
    <details class="acct">
      <summary aria-label="Menu da conta">${avatar(me.profile?.avatar_url, displayName(), "sm")}</summary>
      <div class="acct-menu" role="menu">
        <p class="acct-name">${displayName()}<small>${me.isSuper ? "Proprietário" : me.isStaff ? "Administrador" : "Membro"}</small></p>
        <a href="/perfil">${icon("user")} Meu perfil</a>
        <a href="/mensagens">${icon("mail")} Mensagens</a>
        <a href="/membros">${icon("users")} Membros</a>
        ${me.isStaff ? html`<a href="/admin">${icon("settings")} Painel de gestão</a>` : ""}
        <button type="button" data-logout>${icon("logout")} Sair</button>
      </div>
    </details>`.s;
}

/* ---------------- navegação ---------------- */
let cleanup = null;
let navToken = 0;

export function go(to, { replace = false } = {}) {
  if (to === location.pathname + location.search) return render();
  history[replace ? "replaceState" : "pushState"](null, "", to);
  render();
}

async function render() {
  const token = ++navToken;
  let path = location.pathname.replace(/\/+$/, "") || "/";
  if (aliases[path]) { history.replaceState(null, "", aliases[path] + location.search); path = aliases[path]; }
  const route = match(path);
  const main = $("#main");
  $$("[data-nav]").forEach((a) => {
    const href = a.getAttribute("href");
    a.toggleAttribute("aria-current", href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  });
  $("details.acct")?.removeAttribute("open");
  if (typeof cleanup === "function") { try { cleanup(); } catch { /* ignora */ } }
  cleanup = null;

  if (!route) {
    document.title = "Página não encontrada · FireHelp Saquarema";
    main.innerHTML = html`<section class="wrap narrow pad"><h1 class="h1">Esta página não existe.</h1><p class="lead">O endereço pode ter mudado. Volte ao início ou abra o mapa de ocorrências.</p><p class="row"><a class="btn btn-ink" href="/">Ir para o início</a><a class="btn btn-line" href="/mapa">Abrir o mapa</a></p></section>`.s;
    return;
  }
  if (route.auth) {
    if (!me.ready) await loadMe();
    if (token !== navToken) return;
    if (!me.user) {
      sessionStorage.setItem("fh-next", path + location.search);
      history.replaceState(null, "", "/auth");
      return render();
    }
    if (me.needsCpf && route.page !== "completar-cadastro" && route.page !== "perfil") {
      sessionStorage.setItem("fh-next", path + location.search);
      history.replaceState(null, "", "/completar-cadastro");
      return render();
    }
  }
  document.title = `${route.title} · FireHelp Saquarema`;
  try {
    const mod = await import(`./pages/${route.page}.js`);
    if (token !== navToken) return;
    main.classList.toggle("bleed", Boolean(mod.bleed));
    cleanup = await mod.default({ el: main, params: route.params, query: new URLSearchParams(location.search) });
  } catch (e) {
    console.error(e);
    main.innerHTML = html`<section class="wrap narrow pad"><h1 class="h1">Não deu para abrir esta página.</h1><p class="lead">Verifique sua conexão e recarregue.</p><button class="btn btn-ink" data-reload>Recarregar</button></section>`.s;
  }
  if (!history.state?.keepScroll) window.scrollTo(0, 0);
  if (document.activeElement === document.body) main.focus({ preventScroll: true });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-reload]")) { render(); return; }
  if (e.target.closest("[data-logout]")) {
    auth.signOut().then(() => { toast("Você saiu da sua conta."); go("/"); });
    return;
  }
  const a = e.target.closest("a[href]");
  if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || /\.\w{2,4}$/.test(url.pathname)) return;
  e.preventDefault();
  go(url.pathname + url.search);
});
// fecha o menu da conta ao clicar fora
document.addEventListener("click", (e) => { const d = $("details.acct[open]"); if (d && !d.contains(e.target)) d.removeAttribute("open"); });
window.addEventListener("popstate", render);

/* ---------------- início ---------------- */
(async () => {
  shell();
  mountMimo();
  onMe(renderAccount);
  let linkType = null;
  try { linkType = await auth.consumeUrlHash(); } catch { toast("O link de acesso expirou. Peça um novo.", "err"); }
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  if (params.get("error_description") || params.get("error")) {
    const why = params.get("error_description") || params.get("error") || "";
    toast(/database error|saving new user/i.test(why)
      ? "Ainda não dá para criar conta nova pelo Google. Use \"Criar conta\" com e-mail e senha — quem já tem conta pode entrar com o Google normalmente."
      : "Não foi possível entrar com o Google. Tente de novo ou use e-mail e senha.", "err");
    console.warn(params.get("error_description") || params.get("error"));
    history.replaceState(null, "", "/auth");
  }
  if (linkType === "recovery") { sessionStorage.setItem("fh-recovery", "1"); history.replaceState(null, "", "/reset-password"); }
  else if (linkType === "signup") { toast("E-mail confirmado. Bem-vindo ao FireHelp!"); history.replaceState(null, "", "/"); }
  if (linkType !== null && linkType !== "recovery") {
    // Voltou do Google (ou da confirmação de e-mail): vai para onde estava, ou completa o CPF.
    await loadMe();
    const next = sessionStorage.getItem("fh-next"); sessionStorage.removeItem("fh-next");
    if (me.needsCpf) { if (next) sessionStorage.setItem("fh-next", next); history.replaceState(null, "", "/completar-cadastro"); }
    else if (next && next.startsWith("/") && !next.startsWith("/auth")) history.replaceState(null, "", next);
    else if (location.pathname === "/auth") history.replaceState(null, "", "/");
    if (!me.needsCpf) toast("Você entrou.");
  }
  loadMe();
  render();
})();

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
