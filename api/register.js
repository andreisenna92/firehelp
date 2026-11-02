// Cadastro com CPF protegido: o CPF vai para uma inscrição temporária (só o
// servidor acessa) e o banco grava apenas um resumo criptográfico dele.
import { createHash, randomUUID } from "node:crypto";
import { sb, send, readJson, PUBLIC_KEY, SECRET } from "./_supabase.js";

function validCpf(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += +cpf[i] * (len + 1 - i);
    const d = (sum * 10) % 11;
    if (+cpf[len] !== (d === 10 ? 0 : d)) return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  if (!SECRET) return send(res, 503, { error: "O cadastro de novas contas está temporariamente indisponível. Tente mais tarde." });

  const b = await readJson(req);
  const fullName = String(b.fullName || "").trim().replace(/\s+/g, " ");
  const cpf = String(b.cpf || "").replace(/\D/g, "");
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (fullName.length < 3 || fullName.length > 120 || !fullName.includes(" ")) return send(res, 400, { error: "Informe seu nome completo." });
  if (!validCpf(cpf)) return send(res, 400, { error: "Informe um CPF válido." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return send(res, 400, { error: "Informe um e-mail válido." });
  if (password.length < 8 || password.length > 128) return send(res, 400, { error: "A senha precisa ter pelo menos 8 caracteres." });

  const token = randomUUID() + randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await sb(`/rest/v1/account_enrollments?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, { method: "DELETE" });
  const enroll = await sb("/rest/v1/account_enrollments", { method: "POST", body: { token_hash: tokenHash, cpf, full_name: fullName, email }, headers: { Prefer: "return=minimal" } });
  if (!enroll.ok) return send(res, 400, { error: "Não foi possível cadastrar. Confira seus dados e tente de novo." });

  try {
    const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
    const signup = await sb(`/auth/v1/signup?redirect_to=${encodeURIComponent(origin + "/")}`, {
      key: PUBLIC_KEY, method: "POST",
      body: { email, password, data: { enrollment_token: token } },
    });
    if (!signup.ok) return send(res, 400, { error: "Não foi possível cadastrar. Esse CPF ou e-mail pode já ter conta — tente recuperar a senha." });
    const d = signup.data || {};
    const session = d.access_token ? { access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, user: d.user } : null;
    return send(res, 200, { error: null, session });
  } finally {
    await sb(`/rest/v1/account_enrollments?token_hash=eq.${tokenHash}`, { method: "DELETE" });
  }
}
