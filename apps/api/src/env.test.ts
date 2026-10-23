import { describe, expect, it } from "vitest";
import { EnvError, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  DIRECT_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "j".repeat(32),
  AUDIT_HMAC_KEY: "a".repeat(32),
  WEB_ORIGIN: "http://localhost:3000",
  FIPE_BASE_URL: "https://fipe.example.com/api/v2",
  WIKI_USER_AGENT: "LanceAuto/0.1",
  WIKIPEDIA_BASE_URL: "https://pt.wikipedia.org",
};

describe("parseEnv", () => {
  it("aceita um ambiente completo e aplica os padrões", () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(30);
    expect(env.RATE_LIMIT_DISABLED).toBe(false);
  });

  it("AC-0.3: lista a variável faltante (JWT_SECRET)", () => {
    const { JWT_SECRET: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrowError(EnvError);
    expect(() => parseEnv(rest)).toThrowError(/JWT_SECRET: ausente/);
  });

  it("AC-0.4: recusa AUDIT_HMAC_KEY com menos de 32 caracteres", () => {
    expect(() => parseEnv({ ...valid, AUDIT_HMAC_KEY: "curta" })).toThrowError(/AUDIT_HMAC_KEY/);
  });

  it("recusa DIRECT_URL ausente", () => {
    const { DIRECT_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrowError(/DIRECT_URL: ausente/);
  });

  it("lê RATE_LIMIT_DISABLED=1 como verdadeiro", () => {
    expect(parseEnv({ ...valid, RATE_LIMIT_DISABLED: "1" }).RATE_LIMIT_DISABLED).toBe(true);
  });
});
