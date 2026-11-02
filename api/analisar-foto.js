// O Mimo analisa a foto do aviso: só aceita fogo ou fumaça e recusa conteúdo impróprio.
import { sb, send, readJson, PUBLIC_KEY } from "./_supabase.js";
import { ask, iaConfigured, parseJson } from "./_ia.js";

const SYSTEM = `Você é o Mimo, um mico-leão-dourado bombeiro, mascote do FireHelp — a rede comunitária de Saquarema (RJ) para avisar incêndios.
Sua tarefa: verificar se a imagem enviada num aviso de incêndio mostra de fato fogo/chamas ou fumaça (incêndio florestal, queimada, casa, comércio, veículo, lixo etc.).
Regras:
- "fogo" = chamas visíveis. "fumaca" = fumaça visível de algo queimando (incluindo ao longe, à noite ou em foto tremida).
- Brasas, área recém-queimada ainda fumegando contam como fumaça.
- NÃO contam: neblina, nuvens, vapor de cozinha, pôr do sol, luzes, velas de aniversário, fogão aceso, churrasqueira controlada, lareira, desenhos, memes, prints de tela sem foto real, selfies sem fogo.
- "improprio" = nudez, conteúdo sexual, violência explícita/gore, ofensas ou qualquer coisa inadequada.
Responda APENAS com JSON: {"fogo": boolean, "fumaca": boolean, "improprio": boolean, "confianca": número de 0 a 1, "descricao": "o que aparece, em até 12 palavras", "mimo": "frase curta e simpática do Mimo para a pessoa, em português do Brasil, até 25 palavras"}.
Se for impróprio, a frase do Mimo deve ser educada e firme, sem descrever o conteúdo.`;

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return send(res, 401, { error: "Entre na sua conta para enviar fotos." });
  const who = await sb("/auth/v1/user", { key: PUBLIC_KEY, bearer: jwt });
  if (!who.ok) return send(res, 401, { error: "Sua sessão expirou. Entre de novo." });
  if (!iaConfigured()) return send(res, 200, { unavailable: true });

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
    const ok = !improprio && (r.fogo === true || r.fumaca === true);
    return send(res, 200, {
      ok, improprio, fogo: !!r.fogo, fumaca: !!r.fumaca,
      confianca: typeof r.confianca === "number" ? r.confianca : null,
      descricao: String(r.descricao || "").slice(0, 120),
      mimo: String(r.mimo || (ok ? "Confirmei: tem fogo ou fumaça nessa foto. Obrigado por avisar!" : "Não encontrei fogo nem fumaça nessa foto. Tente outra mais de perto, sem se arriscar.")).slice(0, 220),
    });
  } catch (e) {
    console.error("analisar-foto", e.message);
    return send(res, 200, { unavailable: true, error: "A análise está indisponível agora." });
  }
}
