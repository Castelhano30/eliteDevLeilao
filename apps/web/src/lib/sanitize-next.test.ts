import { describe, expect, it } from "vitest";
import { destinationAfterLogin, sanitizeNext } from "./sanitize-next";

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

describe("destinationAfterLogin", () => {
  it("usa o next quando o papel pode abri-lo", () => {
    expect(destinationAfterLogin("BIDDER", "/carteira")).toBe("/carteira");
    expect(destinationAfterLogin("AUCTIONEER", "/painel/criar-lote")).toBe("/painel/criar-lote");
    expect(destinationAfterLogin("BIDDER", "/lotes/abc?x=1")).toBe("/lotes/abc?x=1");
  });

  it("cai na home do papel quando o next é inválido ou de outro papel", () => {
    expect(destinationAfterLogin("BIDDER", "https://evil.com")).toBe("/");
    expect(destinationAfterLogin("AUCTIONEER", "/carteira")).toBe("/painel");
    expect(destinationAfterLogin("BIDDER", "/painel")).toBe("/");
    expect(destinationAfterLogin("AUCTIONEER", null)).toBe("/painel");
  });
});
