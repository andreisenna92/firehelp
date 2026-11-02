import { html, icon, raw, toast, $ } from "../ui.js";

const GOOGLE_SVG = '<svg class="ic" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
import { auth } from "../sb.js";
import { go } from "../main.js";
import { loadMe } from "../store.js";

const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export function validCpf(value) {
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += +cpf[i] * (len + 1 - i);
    const d = (sum * 10) % 11;
    if (+cpf[len] !== (d === 10 ? 0 : d)) return false;
  }
  return true;
}
const maskCpf = (v) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default async function entrar({ el, query }) {
  if (auth.user) { go(next(), { replace: true }); return; }
  let mode = query.get("modo") === "cadastro" ? "signup" : "login";

  el.innerHTML = html`<div class="auth-wrap">
    <div class="auth-art">
      <h1 class="display" style="font-size:clamp(2.2rem,4vw,3.4rem)">Saquarema se protege junto.</h1>
      <p class="lead">Com uma conta você avisa focos de incêndio, acompanha seus protocolos, conversa com vizinhos e recebe respostas da equipe.</p>
      <img src="/assets/mimo-wave.webp" alt="" width="220" height="330">
    </div>
    <div class="auth-form"><form id="af" novalidate></form></div>
  </div>`.s;
  const form = $("#af", el);

  function draw(msg = "") {
    const signup = mode === "signup", recover = mode === "recover";
    form.innerHTML = html`
      ${recover ? "" : html`<div class="seg" role="group" aria-label="Escolha"><button type="button" data-mode="login" aria-pressed="${!signup}">Entrar</button><button type="button" data-mode="signup" aria-pressed="${signup}">Criar conta</button></div>`}
      <div><h2 class="h1" style="font-size:1.9rem">${signup ? "Criar sua conta" : recover ? "Recuperar senha" : "Bem-vindo de volta"}</h2>
      <p class="muted" style="margin:.4rem 0 0">${signup ? "Seu CPF serve só para evitar contas falsas. Ele fica protegido e nunca aparece para ninguém." : recover ? "Enviamos um link para você criar uma nova senha." : "Entre com seu e-mail e senha."}</p></div>
      ${signup ? html`
        <label class="field"><span>Nome completo</span><input name="name" autocomplete="name" maxlength="120" required></label>
        <label class="field"><span>CPF</span><input name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required></label>` : ""}
      <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label>
      ${recover ? "" : html`<label class="field"><span>Senha</span><input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="${signup ? 8 : 1}" maxlength="128" required>${signup ? html`<small>Pelo menos 8 caracteres.</small>` : ""}</label>`}
      <div id="msg" ${msg ? "" : "hidden"} class="${msg.startsWith("!") ? "form-err" : "form-msg"}" role="status">${msg.replace(/^!/, "")}</div>
      <button class="btn btn-ink btn-lg btn-block" type="submit">${signup ? "Criar conta" : recover ? "Enviar link" : "Entrar"}</button>
      ${recover ? "" : html`<div class="or"><span>ou</span></div>
      <button class="btn btn-line btn-lg btn-block" type="button" id="google">${raw(GOOGLE_SVG)} ${signup ? "Criar conta com Google" : "Entrar com Google"}</button>`}
      <div class="row" style="justify-content:center">
        ${recover ? html`<button type="button" class="link-btn" data-mode="login">${icon("back")} Voltar para entrar</button>` : signup ? "" : html`<button type="button" class="link-btn" data-mode="recover">Esqueci minha senha</button>`}
      </div>
      <p class="tiny" style="text-align:center">Quer só olhar? <a href="/mapa">Veja o mapa sem entrar</a>.</p>`.s;
    const cpf = form.cpf;
    cpf?.addEventListener("input", () => { cpf.value = maskCpf(cpf.value); });
    form.querySelector("input")?.focus();
  }

  form.addEventListener("click", async (e) => {
    const g = e.target.closest("#google");
    if (g) {
      g.disabled = true;
      const back = `${location.origin}/`;
      if (!(await auth.googleReady(back))) {
        g.disabled = false;
        draw("!O login com Google ainda está sendo configurado. Por enquanto, entre com e-mail e senha.");
        return;
      }
      if (!sessionStorage.getItem("fh-next")) sessionStorage.setItem("fh-next", "/");
      location.assign(auth.googleUrl(back));
      return;
    }
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    const email = form.email?.value;
    mode = b.dataset.mode; draw();
    if (email) form.email.value = email;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const fail = (m) => draw("!" + m) || keep();
    const vals = { name: form.name?.value, cpf: form.cpf?.value, email, password: form.password?.value };
    const keep = () => { for (const [k, v] of Object.entries(vals)) if (form[k] && v != null) form[k].value = v; };
    if (!validEmail(email)) return fail("Informe um e-mail válido.");
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Aguarde…";
    try {
      if (mode === "recover") {
        await auth.recover(email, `${location.origin}/reset-password`);
        draw("Se existir uma conta com esse e-mail, você vai receber o link em alguns minutos. Confira também a caixa de spam.");
        return;
      }
      if (mode === "signup") {
        const name = vals.name.trim().replace(/\s+/g, " ");
        if (name.length < 3 || !name.includes(" ")) return fail("Informe seu nome completo (nome e sobrenome).");
        if (!validCpf(vals.cpf)) return fail("Esse CPF não é válido. Confira os números.");
        if ((vals.password || "").length < 8) return fail("A senha precisa ter pelo menos 8 caracteres.");
        const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name, cpf: vals.cpf.replace(/\D/g, ""), email, password: vals.password }) });
        const data = await res.json().catch(() => ({ error: "Cadastro indisponível agora. Tente mais tarde." }));
        if (data.error) return fail(data.error);
        if (data.session) { await auth.setSession(data.session); await loadMe(); toast("Conta criada. Bem-vindo ao FireHelp!"); go(next(), { replace: true }); return; }
        mode = "login";
        draw("Conta criada! Enviamos um e-mail de confirmação. Abra o link e depois entre aqui.");
        form.email.value = email;
        return;
      }
      await auth.signIn(email, vals.password);
      await loadMe();
      toast("Você entrou.");
      go(next(), { replace: true });
    } catch (ex) {
      const m = String(ex.message || "");
      fail(/confirm/i.test(m) ? "Você ainda não confirmou seu e-mail. Abra o link que enviamos." : mode === "login" ? "E-mail ou senha incorretos." : "Não foi possível concluir. Tente de novo.");
    } finally {
      if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
    }
  });

  draw();
}

function next() {
  const n = sessionStorage.getItem("fh-next");
  sessionStorage.removeItem("fh-next");
  return n && n.startsWith("/") && !n.startsWith("/auth") ? n : "/";
}
