import { describe, expect, it } from "vitest";
import { ERROR_CODES, ERROR_HTTP_STATUS, errorEnvelopeSchema } from "./errors";

describe("errors", () => {
  it("tem status HTTP para todos os códigos", () => {
    for (const code of ERROR_CODES) expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
  });

  it("valida o envelope de erro", () => {
    const ok = errorEnvelopeSchema.safeParse({
      error: { code: "VALIDATION", message: "x", details: { fields: { email: "x" } } },
    });
    expect(ok.success).toBe(true);
    expect(errorEnvelopeSchema.safeParse({ error: { code: "NOPE", message: "x" } }).success).toBe(false);
  });
});
