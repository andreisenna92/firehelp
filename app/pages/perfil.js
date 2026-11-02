import { html, icon, avatar, fmtDate, ago, lbl, FIRE_TYPES, statusBadge, sevLabel, isVideo, skeleton, toast, $ } from "../ui.js";
import { q, count, update, upload } from "../sb.js";
import { me, loadMe, displayName } from "../store.js";
import { getReports, forgetProfile } from "../data.js";

export default async function perfil({ el }) {
  await (me.ready ? null : loadMe());
  const uid = me.user.id;
  el.innerHTML = html`<section class="wrap pad" style="max-width:900px">
    <div class="card profile-card">
      <div class="av-edit">${avatar(me.profile?.avatar_url, displayName(), "lg")}<button type="button" id="pick" aria-label="Trocar foto de perfil" title="Trocar foto">${icon("camera")}</button><input type="file" id="photo" accept="image/jpeg,image/png,image/webp" hidden></div>
      <div style="flex:1;min-width:200px">
        <h1 class="h2">${displayName()}</h1>
        <p class="muted small" style="margin:.2rem 0">${me.user.email}</p>
        <p class="tiny" style="margin:0">${me.isSuper ? "Proprietário" : me.isStaff ? "Administrador" : "Membro"} desde ${fmtDate(me.profile?.created_at)}</p>
      </div>
      <a class="btn btn-fire" href="/reportar">${icon("flame")} Reportar foco</a>
    </div>
    <form class="card stack" id="bio-form" style="margin-top:14px">
      <label class="field"><span>Sobre você <small>(aparece para os membros)</small></span><textarea name="bio" rows="2" maxlength="300" placeholder="Ex.: moro em Itaúna e sou brigadista voluntário.">${me.profile?.bio || ""}</textarea></label>
      <div><button class="btn btn-line btn-sm" type="submit">Salvar</button></div>
    </form>
    <div class="stats" id="stats" style="margin-top:18px">
      <div><b>–</b><small>avisos de incêndio</small></div><div><b>–</b><small>tópicos</small></div><div><b>–</b><small>respostas</small></div><div><b>–</b><small>resolvidos</small></div>
    </div>
    <h2 class="h2" style="margin:30px 0 14px">Meus avisos</h2>
    <div id="mine">${skeleton(2, 110)}</div>
  </section>`.s;

  $("#pick", el).addEventListener("click", () => $("#photo", el).click());
  $("#photo", el).addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) { toast("Escolha uma foto JPG, PNG ou WebP de até 5 MB.", "err"); return; }
    try {
      toast("Enviando foto…");
      const url = await upload(`${uid}/avatars/${crypto.randomUUID()}.${f.type.split("/")[1]}`, f);
      await update("profiles", { id: `eq.${uid}` }, { avatar_url: url });
      forgetProfile(uid);
      me.ready = false; await loadMe();
      toast("Foto atualizada.");
      perfil({ el });
    } catch { toast("Não foi possível trocar a foto.", "err"); }
  });
  $("#bio-form", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await update("profiles", { id: `eq.${uid}` }, { bio: e.target.bio.value.trim() || null }); toast("Perfil salvo."); }
    catch { toast("Não foi possível salvar.", "err"); }
  });

  const [reports, posts, comments] = await Promise.all([
    getReports({ user_id: `eq.${uid}` }).catch(() => []),
    count("forum_posts", { user_id: `eq.${uid}` }).catch(() => 0),
    count("forum_comments", { user_id: `eq.${uid}` }).catch(() => 0),
  ]);
  const nums = el.querySelectorAll("#stats b");
  [reports.length, posts, comments, reports.filter((r) => r.status === "resolved").length].forEach((v, i) => { nums[i].textContent = v; });
  $("#mine", el).innerHTML = reports.length ? html`<div class="stack">${reports.map((r) => html`<div class="card stack" style="gap:8px">
    <div class="row between"><b class="h3">${lbl(FIRE_TYPES, r.type)}</b>${statusBadge(r.status)}</div>
    <p class="small muted" style="margin:0">Protocolo <b>${r.protocol}</b> · ${ago(r.reported_at)} · nível ${sevLabel(r.severity).toLowerCase()}</p>
    ${r.description ? html`<p style="margin:0">${r.description}</p>` : ""}
    ${r.fire_report_images?.length ? html`<div class="media-row">${r.fire_report_images.map((m) => isVideo(m.image_url) ? html`<video src="${m.image_url}" controls preload="none"></video>` : html`<img src="${m.image_url}" alt="" loading="lazy">`)}</div>` : ""}
    <div><a class="link-btn" href="/mapa?o=${r.id}">${icon("map")} Ver no mapa</a></div>
  </div>`)}</div>`.s : html`<div class="empty"><p>Você ainda não enviou avisos. Quando vir fumaça ou fogo, registre aqui — leva menos de um minuto.</p><a class="btn btn-fire" href="/reportar">Reportar um foco</a></div>`.s;
}
