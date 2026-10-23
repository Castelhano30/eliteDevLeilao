import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./sanitize-next";

describe("sanitizeNext (AC-1.25)", () => {
  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/%5Cevil.com",
    "javascript:alert(1)",
    " /x",
    "",
    null,
    undefined,
    "carteira",
    "/a b",
    "/x\n",
    "/%2F%2Fevil.com",
    "/%E0%A4%A",
  ])("recusa %j", (value) => {
    expect(sanitizeNext(value)).toBeNull();
  });

  it.each(["/carteira", "/lotes/abc?x=1", "/", "/painel/criar-lote"])("aceita %s", (value) => {
    expect(sanitizeNext(value)).toBe(value);
  });
});
