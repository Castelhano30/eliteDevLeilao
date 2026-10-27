import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { GlobalError, GlobalNotFound } from "./global-states";

it("404 global: título, frase do pátio e volta à vitrine", () => {
  const html = renderToStaticMarkup(<GlobalNotFound />);
  expect(html).toContain("Página não encontrada");
  expect(html).toContain("Essa página não existe, ou já foi para a gaveta.");
  expect(html).toMatch(/<a [^>]*href="\/"[^>]*>Voltar à vitrine<\/a>/);
  expect(html).toContain('role="status"');
});

it("erro global: alerta com 'Tentar novamente' e volta à vitrine", () => {
  const html = renderToStaticMarkup(<GlobalError onRetry={() => undefined} />);
  expect(html).toContain("Algo travou no pátio.");
  expect(html).toContain('role="alert"');
  expect(html).toContain("Tentar novamente");
  expect(html).toContain("Voltar à vitrine");
});
