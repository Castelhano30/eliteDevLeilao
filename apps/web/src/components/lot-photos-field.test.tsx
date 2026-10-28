import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LotPhotosField, type LotPhotosFieldProps } from "./lot-photos-field";

const photo = (id: string) => ({ id, name: `${id}.jpg`, blob: new Blob(["x"]), previewUrl: `blob:http://localhost/${id}` });
const render = (props: Partial<LotPhotosFieldProps> = {}) =>
  renderToStaticMarkup(
    <LotPhotosField id="cl-fotos" photos={[]} busy={false} messages={[]} onAdd={() => undefined} onMakeCover={() => undefined} onRemove={() => undefined} {...props} />,
  );

describe("LotPhotosField", () => {
  it("vazio: botão Escolher fotos, contagem 0 de 5 e seletor só com JPEG/PNG/WebP, múltiplo e sem capture", () => {
    const html = render();
    expect(html).toContain("Escolher fotos");
    expect(html).toContain('id="cl-fotos"');
    expect(html).toContain(">0 de 5<");
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).toContain("multiple");
    expect(html).not.toContain("capture");
    expect(html).not.toContain("<ul");
  });

  it("com fotos: a primeira leva CAPA e não tem Tornar capa; as outras têm as duas ações", () => {
    const html = render({ photos: [photo("a"), photo("b"), photo("c")] });
    expect(html.match(/CAPA/g)).toHaveLength(1);
    expect(html.match(/>Tornar capa</g)).toHaveLength(2);
    expect(html).not.toContain("Tornar capa (foto 1)");
    expect(html.match(/>Remover</g)).toHaveLength(3);
    expect(html).toContain('alt="Foto 1 de 3"');
    expect(html).toContain("Escolher mais fotos");
    expect(html).toContain('src="blob:http://localhost/a"');
  });

  it("5 fotos: o botão de escolher fica desabilitado", () => {
    const html = render({ photos: ["a", "b", "c", "d", "e"].map(photo) });
    expect(html).toMatch(/<button[^>]*disabled[^>]*id="cl-fotos"|<button[^>]*id="cl-fotos"[^>]*disabled/);
  });

  it("avisos e erro aparecem; Sem foto deixa tudo inerte", () => {
    const html = render({ messages: ["Só cabem 5 fotos. As demais ficaram de fora."], error: "Escolha ao menos uma foto.", disabled: true, photos: [photo("a"), photo("b")] });
    expect(html).toContain("Só cabem 5 fotos. As demais ficaram de fora.");
    expect(html).toContain("Escolha ao menos uma foto.");
    expect(html).toContain("opacity-50");
    expect(html.match(/disabled/g)!.length).toBeGreaterThanOrEqual(4);
  });
});
