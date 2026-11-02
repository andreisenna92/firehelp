// O Mimo analisa a foto do aviso: só aceita fogo ou fumaça e recusa conteúdo impróprio.
import { sb, send, readJson, PUBLIC_KEY } from "./_supabase.js";
import { ask, iaConfigured, parseJson } from "./_ia.js";

const SYSTEM = `Você é o Mimo, um mico-leão-dourado bombeiro, e trabalha como verificador RIGOROSO de imagens do FireHelp — a rede comunitária de Saquarema (RJ) para avisar incêndios.
Pessoas tentam enviar imagens que não são de incêndio (personagens de desenho/anime, políticos, celebridades, memes, selfies, prints). Sua função é BARRAR tudo que não for uma fotografia real de um incêndio acontecendo. Na dúvida, recuse.

Classifique a imagem:
- "tipo": "foto_real" (fotografia de câmera/celular de uma cena real) | "desenho" (desenho, anime, cartoon, ilustração, personagem, arte digital, render 3D, imagem gerada por IA) | "print" (captura de tela, foto de outra tela/TV/monitor, notícia, post) | "meme" (texto sobre imagem, montagem) | "outro".
- "fogo": chamas reais visíveis numa cena real.
- "fumaca": fumaça real de algo queimando (pode estar longe, à noite, ou a foto estar tremida). Brasas e área queimada ainda fumegando contam.
- NÃO são incêndio: neblina, nuvens, vapor, poeira, pôr do sol, luzes, velas, fogão, churrasqueira/fogueira controlada, lareira, fogos de artifício, efeitos especiais, fogo em desenho/filme/jogo, "aura" ou energia de personagem (ex.: Goku, Super Saiyajin), fotos de pessoas posando, políticos ou famosos.
- Se o foco principal for uma pessoa (rosto/retrato), "pessoa_em_destaque" = true.
- "improprio": nudez, conteúdo sexual, violência explícita/gore, símbolos de ódio, ofensas.

Responda APENAS com JSON:
{"tipo": "...", "fogo": boolean, "fumaca": boolean, "pessoa_em_destaque": boolean, "improprio": boolean, "confianca": número de 0 a 1 sobre haver incêndio real, "descricao": "o que aparece, até 12 palavras", "mimo": "frase curta e simpática do Mimo para a pessoa, pt-BR, até 25 palavras"}
Se recusar, a frase do Mimo explica o motivo com educação (ex.: "isso parece um desenho"), sem descrever conteúdo impróprio.`;

const RECUSA = {
  improprio: "Essa imagem não pode ser enviada aqui. Mande só fotos do fogo ou da fumaça, combinado?",
  nao_foto: "Isso não parece uma foto real — pode ser desenho, print ou montagem. Preciso de uma foto tirada no local do fogo.",
  pessoa: "Essa foto mostra uma pessoa, não um incêndio. Fotografe o fogo ou a fumaça, de um lugar seguro.",
  sem_fogo: "Não encontrei fogo nem fumaça nessa imagem, então não posso aceitar. Tente outra foto do foco.",
  duvida: "Não tive certeza de que há um incêndio nessa foto. Tente uma imagem mais nítida do fogo ou da fumaça.",
};

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return send(res, 401, { error: "Entre na sua conta para enviar fotos." });
  const who = await sb("/auth/v1/user", { key: PUBLIC_KEY, bearer: jwt });
  if (!who.ok) return send(res, 401, { error: "Sua sessão expirou. Entre de novo." });
  if (!iaConfigured()) return send(res, 200, { ok: false, unavailable: true, mimo: "Minha análise de fotos está desligada agora, então não consigo aceitar avisos. Em emergência, ligue 193!" });

  const { image, mime } = await readJson(req);
  if (!image || typeof image !== "string" || image.length > 4_000_000 || !/^image\/(jpeg|png|webp)$/.test(mime || "")) {
    return send(res, 400, { error: "Imagem inválida." });
  }
  try {
    const text = await ask({
      system: SYSTEM, json: true, maxTokens: 300,
      image: { mime, data: image },
      messages: [{ role: "user", text: "Analise esta imagem enviada como aviso de incêndio." }],
    });
    const r = parseJson(text) || {};
    if (r.blocked) return send(res, 200, { ok: false, improprio: true, mimo: "Essa imagem não pode ser enviada aqui. Mande só fotos do fogo ou da fumaça, combinado?" });
    const improprio = r.improprio === true;
    const confianca = typeof r.confianca === "number" ? r.confianca : 0;
    const real = r.tipo === "foto_real";
    const ok = !improprio && real && r.pessoa_em_destaque !== true && (r.fogo === true || r.fumaca === true) && confianca >= 0.6;
    const motivo = improprio ? "improprio" : !real ? "nao_foto" : r.pessoa_em_destaque ? "pessoa" : !(r.fogo || r.fumaca) ? "sem_fogo" : confianca < 0.6 ? "duvida" : null;
    return send(res, 200, {
      ok, improprio, motivo, tipo: r.tipo || null, fogo: !!r.fogo, fumaca: !!r.fumaca, confianca,
      descricao: String(r.descricao || "").slice(0, 120),
      mimo: String(ok ? (r.mimo || "Confirmei: tem fogo ou fumaça nessa foto. Obrigado por avisar!") : RECUSA[motivo] || RECUSA.sem_fogo).slice(0, 220),
    });
  } catch (e) {
    console.error("analisar-foto", e.message);
    return send(res, 200, { ok: false, unavailable: true, mimo: "Não consegui analisar agora. Tente de novo em instantes — em emergência, ligue 193!" });
  }
}
