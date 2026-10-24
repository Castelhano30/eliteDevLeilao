import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { TestAccounts } from "./test-accounts";

it("lista as três contas do seed e marca a que está no e-mail do formulário", () => {
  const html = renderToStaticMarkup(<TestAccounts email="ana@lanceauto.test" onPick={vi.fn()} />);
  expect(html).toContain("leiloeiro@lanceauto.test");
  expect(html).toContain("ana@lanceauto.test");
  expect(html).toContain("bruno@lanceauto.test");
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
});

it("não deixa a senha de teste no HTML", () => {
  const html = renderToStaticMarkup(<TestAccounts email="" onPick={vi.fn()} />);
  expect(html).not.toContain("lance1234");
});
