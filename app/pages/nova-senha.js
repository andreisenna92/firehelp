import { html, toast, $ } from "../ui.js";
import { auth } from "../sb.js";
import { go } from "../main.js";

export default async function novaSenha({ el }) {
  const allowed = auth.user && sessionStorage.getItem("fh-recovery") === "1";
  el.innerHTML = html`<section class="wrap pad" style="max-width:440px">
    <h1 class="h1">Criar nova senha</h1>
    ${allowed ? html`<form class="stack" id="pf" style="margin-top:20px">
      <label class="field"><span>Nova senha</span><input name="p1" type="password" autocomplete="new-password" minlength="8" maxlength="128" required><small>Pelo menos 8 caracteres.</small></label>
      <label class="field"><span>Repita a senha</span><input name="p2" type="password" autocomplete="new-password" required></label>
      <div id="err" class="form-err" hidden></div>
      <button class="btn btn-ink btn-lg" type="submit">Salvar nova senha</button>
    </form>` : html`<p class="lead">Para criar uma nova senha, abra o link que enviamos por e-mail. Se ele expirou, peça outro.</p><p><a class="btn btn-ink" href="/auth">Pedir novo link</a></p>`}
  </section>`.s;
  $("#pf", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, err = $("#err", el);
    const show = (m) => { err.hidden = false; err.textContent = m; };
    if (f.p1.value.length < 8) return show("A senha precisa ter pelo menos 8 caracteres.");
    if (f.p1.value !== f.p2.value) return show("As duas senhas estão diferentes.");
    try {
      await auth.updatePassword(f.p1.value);
      sessionStorage.removeItem("fh-recovery");
      toast("Senha atualizada. Você já está conectado.");
      go("/", { replace: true });
    } catch { show("Não foi possível trocar a senha. Peça um novo link e tente de novo."); }
  });
}
