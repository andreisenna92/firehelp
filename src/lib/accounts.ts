import { z } from "zod";

export function normalizeCpf(value: string) {
  return value.replace(/[.\-\s]/g, "");
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const digit = (sum * 10) % 11;
    if (Number(cpf[length]) !== (digit === 10 ? 0 : digit)) return false;
  }
  return true;
}

export const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);
export const passwordSchema = z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(128);
export const registrationSchema = z.object({
  fullName: z.string().trim().min(3).max(120).refine((name) => name.split(/\s+/).length >= 2, "Informe seu nome completo."),
  cpf: z.string().max(20).refine(isValidCpf, "Informe um CPF válido.").transform(normalizeCpf),
  email: emailSchema,
  password: passwordSchema,
});

export function isManagerRole(roles: string[]) {
  return roles.includes("admin") || roles.includes("moderator");
}

export function canManagePost(userId: string | null, authorId: string | null, manager: boolean) {
  return Boolean(userId && (manager || userId === authorId));
}

export function canRemoveManager(actorId: string, targetId: string, targetIsManager: boolean, managerCount: number) {
  return actorId !== targetId && (!targetIsManager || managerCount > 1);
}