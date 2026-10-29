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

it("na barra do celular o chip não leva o olho (ele vai para o menu) e o saldo segue mascarado no HTML inicial", () => {
  const client = new QueryClient();
  client.setQueryData(["wallet", "summary"], { availableCents: 12345600, totalCents: 12345600, committedCents: 0 });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><BalanceChip barra /></QueryClientProvider>);
  expect(html).toContain("••••••");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("123.456");
  expect(html).toContain("min-h-9");
  // A área de toque chega a 44px por pseudo-elemento: 36px do chip (34px dentro da borda) mais 5px de cada lado.
  expect(html).toContain("before:-inset-y-[5px]");
  // Em 320px o ícone sai para o saldo caber ao lado do logo e do menu.
  expect(html).toContain("max-[359px]:hidden");
  client.clear();
});
