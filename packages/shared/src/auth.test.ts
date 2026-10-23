import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { AUTH_TEXT, homeFor, loginInputSchema, registerInputSchema } from "./auth";
import { fieldErrors } from "./validation";
import { DEPOSIT_AMOUNT_MESSAGE, depositInputSchema } from "./wallet";

const valid = { name: "Ana Souza", email: "ana@lanceauto.test", password: "lance1234", role: "BIDDER" };

function fieldsOf(schema: ZodType, input: unknown) {
  const result = schema.safeParse(input);
  return result.success ? null : fieldErrors(result.error);
}

describe("registerInputSchema", () => {
  it("normaliza e-mail e nome", () => {
    const parsed = registerInputSchema.parse({ ...valid, name: "  Ana  ", email: " ANA@Lanceauto.test " });
    expect(parsed.email).toBe("ana@lanceauto.test");
    expect(parsed.name).toBe("Ana");
  });

  it("AC-1.4: senha de 7 caracteres", () => {
    expect(fieldsOf(registerInputSchema, { ...valid, password: "1234567" })).toEqual({ password: AUTH_TEXT.passwordTooShort });
  });

  it("AC-1.5: papel ausente ou inválido", () => {
    expect(fieldsOf(registerInputSchema, { ...valid, role: undefined })).toEqual({ role: AUTH_TEXT.roleRequired });
    expect(fieldsOf(registerInputSchema, { ...valid, role: "ADMIN" })).toEqual({ role: AUTH_TEXT.roleRequired });
  });

  it("AC-1.6: nome vazio e e-mail inválido juntos", () => {
    expect(fieldsOf(registerInputSchema, { ...valid, name: "   ", email: "x" })).toEqual({
      name: AUTH_TEXT.nameRequired,
      email: AUTH_TEXT.emailInvalid,
    });
  });

  it("campos vazios ou ausentes pedem cada informação", () => {
    expect(fieldsOf(registerInputSchema, {})).toEqual({
      name: AUTH_TEXT.nameRequired,
      email: AUTH_TEXT.emailRequired,
      password: AUTH_TEXT.passwordRequiredRegister,
      role: AUTH_TEXT.roleRequired,
    });
    expect(fieldsOf(registerInputSchema, { ...valid, password: "" })).toEqual({ password: AUTH_TEXT.passwordRequiredRegister });
  });

  it("nome com mais de 120 caracteres", () => {
    expect(fieldsOf(registerInputSchema, { ...valid, name: "a".repeat(121) })).toEqual({ name: AUTH_TEXT.nameTooLong });
    expect(registerInputSchema.safeParse({ ...valid, name: "a".repeat(120) }).success).toBe(true);
  });

  it("AC-1.39: senha medida em bytes UTF-8", () => {
    expect(registerInputSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
    expect(fieldsOf(registerInputSchema, { ...valid, password: "a".repeat(73) })).toEqual({ password: AUTH_TEXT.passwordTooLong });
    // 37 × "é" (2 bytes) = 74 bytes, mas só 37 caracteres
    expect(fieldsOf(registerInputSchema, { ...valid, password: "é".repeat(37) })).toEqual({ password: AUTH_TEXT.passwordTooLong });
    expect(registerInputSchema.safeParse({ ...valid, password: "é".repeat(36) }).success).toBe(true);
  });
});

describe("loginInputSchema", () => {
  it("pede e-mail e senha", () => {
    expect(fieldsOf(loginInputSchema, {})).toEqual({ email: AUTH_TEXT.emailRequired, password: AUTH_TEXT.passwordRequiredLogin });
  });
  it("não impõe o mínimo de 8 no login", () => {
    expect(loginInputSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("depositInputSchema (AC-1.13)", () => {
  it("aceita de 1 a 1_000_000_000", () => {
    expect(depositInputSchema.safeParse({ amountCents: 1 }).success).toBe(true);
    expect(depositInputSchema.safeParse({ amountCents: 1_000_000_000 }).success).toBe(true);
  });
  it.each([1_000_000_001, 0, -100, 10.5, "100", undefined, null, Number.NaN])("recusa %s", (amountCents) => {
    expect(fieldsOf(depositInputSchema, { amountCents })).toEqual({ amountCents: DEPOSIT_AMOUNT_MESSAGE });
  });
});

describe("homeFor", () => {
  it("licitante vai à vitrine, leiloeiro ao painel", () => {
    expect(homeFor("BIDDER")).toBe("/");
    expect(homeFor("AUCTIONEER")).toBe("/painel");
  });
});
