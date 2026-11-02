// IA usada pelo Mimo. Funciona com Google Gemini (GEMINI_API_KEY, tem plano gratuito)
// ou com Claude (ANTHROPIC_API_KEY). Configure uma das duas na Vercel.
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
// "gemini-flash-latest" acompanha sempre o modelo Flash mais novo; os outros são reserva.
const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(Boolean);
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

export const iaConfigured = () => Boolean(GEMINI_KEY || CLAUDE_KEY);

/**
 * Envia instruções + conversa (+ imagem opcional) e devolve o texto da resposta.
 * messages: [{ role: "user" | "assistant", text }]
 */
export async function ask({ system, messages, image, json = false, maxTokens = 600 }) {
  if (GEMINI_KEY) {
    const contents = messages.map((m, i) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        ...(image && i === messages.length - 1 ? [{ inline_data: { mime_type: image.mime, data: image.data } }] : []),
        { text: m.text },
      ],
    }));
    let d, lastErr;
    const tries = GEMINI_MODELS.flatMap((m) => [m, m]); // cada modelo tenta 2 vezes
    for (let i = 0; i < tries.length; i++) {
      const model = tries[i];
      if (i % 2 === 1) await new Promise((r) => setTimeout(r, 700));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature: json ? 0 : 0.6, ...(json ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      d = await res.json().catch(() => ({}));
      if (res.ok) { lastErr = null; break; }
      lastErr = new Error(d.error?.message || `Gemini ${res.status}`);
      const gone = res.status === 404 || /no longer available|not found|not supported/i.test(lastErr.message);
      const busy = res.status === 429 || res.status >= 500 || /high demand|overloaded|unavailable|try again/i.test(lastErr.message);
      if (gone && i % 2 === 0) i++; // modelo aposentado: pula direto para o próximo
      else if (!busy && !gone) break; // erro de verdade (chave, pedido): não adianta insistir
    }
    if (lastErr) throw lastErr;
    const cand = d.candidates?.[0];
    if (!cand?.content) return json ? '{"blocked":true}' : ""; // bloqueado pelo filtro de segurança
    return cand.content.parts.map((p) => p.text || "").join("");
  }
  if (CLAUDE_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: maxTokens, system,
        messages: messages.map((m, i) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: [
            ...(image && i === messages.length - 1 ? [{ type: "image", source: { type: "base64", media_type: image.mime, data: image.data } }] : []),
            { type: "text", text: m.text },
          ],
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error?.message || `Claude ${res.status}`);
    return (d.content || []).map((c) => c.text || "").join("");
  }
  throw new Error("IA não configurada");
}

export function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}
