import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOADING_TEXT } from "@/components/ui/feedback-state";
import { LOT_CARD_SHELL } from "./lot-card-shell";
import { LotCardSkeleton, LotCardSkeletons } from "./lot-card-skeleton";

const one = renderToStaticMarkup(<LotCardSkeleton />);
const group = renderToStaticMarkup(<LotCardSkeletons />);
const count = (html: string, token: string) => html.split(token).length - 1;

describe("LotCardSkeleton", () => {
  it("usa o mesmo casco do cartão e é decorativo: sem link, sem texto e escondido do leitor de tela", () => {
    expect(one).toContain(`class="${LOT_CARD_SHELL}"`);
    expect(one).toContain('aria-hidden="true"');
    expect(one).not.toContain("<a ");
    expect(one).not.toMatch(/>[^<]+</);
    expect(one).not.toContain("role=");
  });

  it("foto de 200px, a etiqueta de 64x60 por cima dela e o cronômetro de 96x52 em rounded-xl", () => {
    expect(one).toContain("h-50 shrink-0");
    expect(one).toContain("absolute left-3 top-5 h-15 w-16 rounded-md bg-borda");
    expect(one).toContain("h-13 w-24 shrink-0 rounded-xl bg-suave");
  });

  it("três barras no corpo (70%, 45% e 55%), o fio e o preço de 28px a 40%", () => {
    expect(one).toContain("h-5 w-[70%] rounded-md bg-suave");
    expect(one).toContain("h-5 w-[45%] rounded-md bg-suave");
    expect(one).toContain("h-3.5 w-[55%] rounded-md bg-suave");
    expect(one).toContain("mt-auto flex items-end justify-between gap-4 border-t border-borda pt-4");
    expect(one).toContain("h-7 w-[40%] rounded-md bg-suave");
  });

  it("pulso lento de 1,6s em todos os blocos (reduced-motion desliga no CSS global, sem perder o desenho)", () => {
    const blocks = count(one, "bg-suave") + count(one, "bg-borda");
    expect(count(one, "animate-[la-pulsa_1.6s_ease-in-out_infinite]")).toBe(blocks);
    expect(one).not.toContain("la-pulsa_1.2s");
  });
});

describe("LotCardSkeletons", () => {
  it("um só status ocupado, com o texto de carregamento do FeedbackState em sr-only", () => {
    expect(group).toMatch(/^<div role="status" aria-busy="true">/);
    expect(group).toContain(`<span class="sr-only">${LOADING_TEXT}</span>`);
    expect(LOADING_TEXT).toBe("Carregando…");
    expect(count(group, 'role="status"')).toBe(1);
  });

  it("três esqueletos na grade, e nenhum texto visível além do sr-only", () => {
    expect(count(group, `class="${LOT_CARD_SHELL}"`)).toBe(3);
    expect(group).toContain("repeat(auto-fill, minmax(min(100%, 330px), 1fr))");
    expect(group.replace(/<span class="sr-only">[^<]*<\/span>/, "")).not.toMatch(/>[^<]+</);
  });

  it("aceita outra quantidade", () => {
    expect(count(renderToStaticMarkup(<LotCardSkeletons count={2} />), `class="${LOT_CARD_SHELL}"`)).toBe(2);
  });
});
