import { html, icon, STATUSES, statusBadge } from "../ui.js";

const tips = (list) => html`<ul class="tip-list">${list.map((t) => html`<li>${icon("check")}<span>${t}</span></li>`)}</ul>`;

export default async function comoFunciona({ el }) {
  el.innerHTML = html`<section class="wrap pad" style="max-width:980px">
    <div class="row" style="gap:24px;align-items:flex-end;margin-bottom:10px">
      <div style="flex:1;min-width:260px">
        <h1 class="display" style="font-size:clamp(2.2rem,5vw,3.6rem)">Como o FireHelp funciona</h1>
        <p class="lead">Uma rede de moradores de Saquarema que se avisam quando aparece fumaça ou fogo, acompanham cada ocorrência no mapa e aprendem juntos a evitar o próximo incêndio.</p>
      </div>
      <img src="/assets/mimo-wave.webp" alt="Mimo, o mico-leão-dourado bombeiro, acenando" width="150" height="225" style="width:150px">
    </div>

    <div class="how-block">
      <h2 class="h2">Avisar um foco</h2>
      <div class="stack-l">
        <div class="steps">
          <div class="step"><span class="step-n">1</span><h3 class="h3">Proteja-se</h3><p>Afaste-se do fogo e da fumaça. Se houver risco a pessoas, casas ou animais, ligue 193.</p></div>
          <div class="step"><span class="step-n">2</span><h3 class="h3">Registre</h3><p>Em <a href="/reportar">Reportar</a>, escolha o tipo e o tamanho, marque o local e anexe foto ou vídeo.</p></div>
          <div class="step"><span class="step-n">3</span><h3 class="h3">Acompanhe</h3><p>Você recebe um protocolo. O aviso aparece no mapa e a situação é atualizada pela equipe.</p></div>
        </div>
        <p class="muted" style="margin:0">Para enviar avisos é preciso ter uma conta — isso evita alertas falsos. Para ver o mapa, as notícias e a comunidade não precisa entrar.</p>
      </div>
    </div>

    <div class="how-block">
      <h2 class="h2">O que cada situação quer dizer</h2>
      <div class="status-legend">${Object.entries(STATUSES).map(([k, [, desc]]) => html`<div>${statusBadge(k)}<span>${desc}</span></div>`)}</div>
    </div>

    <div class="how-block" id="prevencao">
      <h2 class="h2">Prevenção no dia a dia</h2>
      ${tips([
        "Não queime lixo, folhas, mato ou entulho. Além de proibido, é a causa mais comum de incêndio em terrenos e na vegetação.",
        "Mantenha terrenos e quintais limpos, com mato baixo, principalmente entre o inverno e o início da primavera, quando chove menos.",
        "Bitucas de cigarro vão no lixo, apagadas — nunca na beira da estrada, na restinga ou na areia.",
        "Não solte balões. Eles caem acesos em matas, telhados e fios.",
        "Em churrascos e fogueiras na praia ou no sítio, apague com água e terra antes de sair.",
        "Guarde gás, álcool e fósforos longe do alcance de crianças e de fontes de calor.",
      ])}
    </div>

    <div class="how-block">
      <h2 class="h2">Se o fogo estiver perto</h2>
      ${tips([
        "Ligue 193 (Bombeiros) ou 199 (Defesa Civil) e informe o endereço e um ponto de referência.",
        "Saia na direção contrária ao vento e à fumaça. Não tente atravessar a área queimando.",
        "Molhe um pano e cubra o nariz e a boca se precisar passar por fumaça.",
        "Não volte para buscar objetos. Siga a orientação dos bombeiros e da Defesa Civil.",
        "Não tente apagar incêndios grandes em mata sozinho — brigadistas têm equipamento e treino para isso.",
      ])}
    </div>

    <div class="how-block">
      <h2 class="h2">Comunidade e respeito</h2>
      <div class="stack">
        <p style="margin:0">Na <a href="/comunidade">Comunidade</a> você pode tirar dúvidas, combinar mutirões de limpeza, contar o que viu e compartilhar dicas. Qualquer pessoa pode denunciar um conteúdo falso, ofensivo ou perigoso; a equipe de gestão revisa cada denúncia.</p>
        <p style="margin:0">Não publique dados pessoais de terceiros nem acuse pessoas sem provas — avise as autoridades.</p>
      </div>
    </div>

    <div class="how-block">
      <h2 class="h2">Seus dados</h2>
      <div class="stack">
        <p style="margin:0">O CPF pedido no cadastro serve só para impedir contas duplicadas. Ele é guardado de forma protegida e nunca aparece no seu perfil nem para outros membros.</p>
        <p style="margin:0">A localização é usada apenas no momento do aviso, para marcar o ponto do fogo. O FireHelp não acompanha onde você está.</p>
      </div>
    </div>

    <div class="how-block">
      <h2 class="h2">Quem é o Mimo?</h2>
      <p style="margin:0">O Mimo é um mico-leão-dourado bombeiro, mascote do FireHelp. O mico-leão-dourado só existe na Mata Atlântica do estado do Rio de Janeiro — e os incêndios na mata são uma das ameaças à sua casa. Proteger a mata de Saquarema é proteger ele também.</p>
    </div>

    <div class="panel row between" style="margin-top:20px">
      <div><h2 class="h2">Viu fumaça agora?</h2><p class="muted" style="margin:.3rem 0 0">Avise em menos de um minuto.</p></div>
      <div class="row"><a class="btn btn-fire btn-lg" href="/reportar">${icon("flame")} Reportar foco</a><a class="btn btn-line btn-lg" href="tel:193">${icon("phone")} Ligar 193</a></div>
    </div>
  </section>`.s;
}
