import { describe, expect, it } from "vitest";
import { deriveSessionStatus } from "./session";

describe("deriveSessionStatus", () => {
  const base = { hydrated: true, hasToken: true, hasUser: false, failed: false };

  it("antes de hidratar é loading, qualquer que seja o resto", () => {
    expect(deriveSessionStatus({ ...base, hydrated: false, hasToken: false })).toBe("loading");
    expect(deriveSessionStatus({ ...base, hydrated: false, hasUser: true })).toBe("loading");
  });

  it("sem token é visitante", () => {
    expect(deriveSessionStatus({ ...base, hasToken: false })).toBe("anon");
  });

  it("com token e usuário carregado é auth, mesmo que uma atualização tenha falhado", () => {
    expect(deriveSessionStatus({ ...base, hasUser: true })).toBe("auth");
    expect(deriveSessionStatus({ ...base, hasUser: true, failed: true })).toBe("auth");
  });

  it("com token, sem usuário e ainda tentando é loading", () => {
    expect(deriveSessionStatus(base)).toBe("loading");
  });

  it("com token, sem usuário e sem mais tentativas é error, não loading para sempre", () => {
    expect(deriveSessionStatus({ ...base, failed: true })).toBe("error");
  });
});
