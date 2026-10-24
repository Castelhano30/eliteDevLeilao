import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { BalanceChip } from "./balance-chip";

vi.mock("./auth-provider", () => ({ WALLET_SUMMARY_KEY: ["wallet", "summary"], fetchMe: vi.fn() }));

it("não entrega o saldo no HTML inicial, mesmo com cache preenchido", () => {
  const client = new QueryClient();
  client.setQueryData(["wallet", "summary"], { availableCents: 12345600, totalCents: 12345600, committedCents: 0 });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><BalanceChip /></QueryClientProvider>);
  expect(html).toContain("••••••");
  expect(html).toContain('aria-label="Saldo oculto, ir para a carteira"');
  expect(html).toContain('aria-label="Mostrar saldo"');
  expect(html).not.toContain("123.456");
  expect(html).not.toContain("123456");
  expect(html).toMatch(/<\/a><button/);
  client.clear();
});
