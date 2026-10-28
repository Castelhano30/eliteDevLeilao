import { describe, expect, it } from "vitest";
import { sniffImageType } from "./image-sniff";

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe("sniffImageType", () => {
  it("reconhece JPEG, PNG e WebP pelos bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), ...ascii("VP8 ")))).toBe("image/webp");
  });

  it("recusa GIF, SVG, HTML, WAV (RIFF que não é WebP), vazio e lixo", () => {
    expect(sniffImageType(Buffer.from("GIF89a....", "latin1"))).toBeNull();
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageType(Buffer.from("<!doctype html><html></html>"))).toBeNull();
    expect(sniffImageType(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });
});
