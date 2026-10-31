import { describe, test } from "node:test";
import assert from "node:assert/strict";
const expect = (actual: unknown) => ({ toBe(expected: unknown) { assert.equal(actual, expected); } });
import { canManagePost, canRemoveManager, isManagerRole, isValidCpf, normalizeCpf, registrationSchema } from "../src/lib/accounts";

describe("Cadastro tradicional", () => {
  test("aceita CPF com dígitos verificadores válidos", () => expect(isValidCpf("529.982.247-25")).toBe(true));
  test("recusa CPF com dígito verificador incorreto", () => expect(isValidCpf("52998224724")).toBe(false));
  test("recusa CPF com todos os dígitos iguais", () => expect(isValidCpf("11111111111")).toBe(false));
  test("normaliza a identificação para impedir duplicidade por formatação", () => expect(normalizeCpf("529.982.247-25")).toBe("52998224725"));
  test("exige nome completo", () => expect(registrationSchema.safeParse({ fullName: "Ana", cpf: "52998224725", email: "ana@example.com", password: "Example123!" }).success).toBe(false));
  test("exige e-mail válido", () => expect(registrationSchema.safeParse({ fullName: "Ana Silva", cpf: "52998224725", email: "ana", password: "Example123!" }).success).toBe(false));
});
describe("Gerentes e membros", () => {
  test("preserva o acesso de gerentes antigos", () => expect(isManagerRole(["moderator"])).toBe(true));
  test("membro não administra publicação alheia", () => expect(canManagePost("member", "other", false)).toBe(false));
  test("membro administra publicação própria", () => expect(canManagePost("member", "member", false)).toBe(true));
  test("gerente modera publicação alheia", () => expect(canManagePost("manager", "other", true)).toBe(true));
  test("não permite excluir a si mesmo", () => expect(canRemoveManager("manager", "manager", true, 2)).toBe(false));
  test("não permite excluir o último gerente", () => expect(canRemoveManager("actor", "manager", true, 1)).toBe(false));
});