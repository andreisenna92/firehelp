import { html, toast, $ } from "../ui.js";
import { rpc } from "../sb.js";
import { me, loadMe } from "../store.js";
import { go } from "../main.js";
import { validCpf } from "./entrar.js";

const maskCpf = (v) => v.replace(/\D/g, "").slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default async function completarCadastro({ el }) {
  if (!me.needsCpf) { go(next(), { replace: true }); return; }
  el.innerHTML = html`<section class="wrap pad" style="max-width:480px">
    <img src="/assets/mimo-wave.webp" alt="" width="110" height="165" style="width:110px;margin-bottom:8px">
    <h1 class="h1">Falta só um passo</h1>
    <p class="lead">Para avisar focos e participar da comunidade, confirme seu nome e CPF. O CPF serve só para evitar contas falsas: é guardado de forma protegida e nunca aparece para ninguém.</p>
    <form class="stack" id="cf" style="margin-top:22px" novalidate>
      <label class="field"><span>Nome completo</span><input name="name" autocomplete="name" maxlength="120" required value="${me.profile?.full_name || ""}"></label>
      <label class="field"><span>CPF</span><input name="cpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required></label>
      <div id="err" class="form-err" hidden></div>
      <button class="btn btn-ink btn-lg" type="submit">Concluir cadastro</button>
      <a class="btn btn-quiet" href="/">Agora não — só quero olhar</a>
    </form>
  </section>`.s;
  const f = $("#cf", el), err = $("#err", el);
  f.cpf.addEventListener("input", () => { f.cpf.value = maskCpf(f.cpf.value); });
  f.cpf.focus();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const show = (m) => { err.hidden = false; err.textContent = m; };
    const name = f.name.value.trim().replace(/\s+/g, " ");
    if (name.length < 3 || !name.includes(" ")) return show("Informe seu nome completo (nome e sobrenome).");
    if (!validCpf(f.cpf.value)) return show("Esse CPF não é válido. Confira os números.");
    const btn = f.querySelector("[type=submit]");
    btn.disabled = true; btn.textContent = "Salvando…";
    try {
      await rpc("complete_identity", { full_name: name, cpf: f.cpf.value.replace(/\D/g, "") });
      me.ready = false; await loadMe();
      toast("Cadastro concluído. Bem-vindo ao FireHelp!");
      go(next(), { replace: true });
    } catch (ex) {
      btn.disabled = false; btn.textContent = "Concluir cadastro";
      show(/já está cadastrado/i.test(ex.message) ? "Este CPF já está ligado a outra conta. Entre com aquela conta ou fale com a gestão." : /completo/i.test(ex.message) ? "Seu cadastro já estava completo." : "Não foi possível salvar agora. Tente de novo.");
    }
  });
}

function next() {
  const n = sessionStorage.getItem("fh-next");
  sessionStorage.removeItem("fh-next");
  return n && n.startsWith("/") && !n.startsWith("/auth") && !n.startsWith("/completar") ? n : "/";
}
