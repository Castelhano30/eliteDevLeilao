import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Cronometro } from "./cronometro";

describe("Cronometro", () => {
  it.each(["CLOSING", "SOLD", "UNSOLD"] as const)("%s expõe Tempo restante 00:00", (status) => {
    const html = renderToStaticMarkup(
      <Cronometro status={status} startsAt="2026-10-23T10:00:00.000Z" endsAt="2026-10-23T11:00:00.000Z" size="sala" />,
    );
    expect(html).toContain('role="timer" aria-label="Tempo restante 00:00"');
  });
});
