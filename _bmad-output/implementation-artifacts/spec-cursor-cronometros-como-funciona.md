---
title: 'Cursor de mãozinha, diagnóstico dos cronômetros e página Como Funciona'
type: 'feature'
created: '2026-10-29'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '7265595f0da50fbec9ec166a7864a24219529966'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (1) Elementos clicáveis não mostram a mãozinha (Tailwind 4 trocou o cursor dos botões para `default`). (2) O Felipe relata cronômetros quebrados na maioria das telas. (3) Falta uma página que explique o leilão.

**Approach:** (1) Regra global em `@layer base` mais auditoria no navegador. (2) Diagnóstico sistemático no Chrome real; só corrige com causa provada. (3) Rota `/como-funciona` com 3 passos tirados da SPEC, link na navegação e no rodapé, CTA para a vitrine.

## Boundaries & Constraints

**Always:** só local (commits locais, sem `git push`, sem deploy); commits atômicos em português, sem Co-Authored-By nem marca de IA; servidor é a verdade de tempo; textos de estado vêm de `packages/shared`; paleta azul e componentes atuais; diário em `_bmad-output/progresso.md`.

**Never:** inventar regra fora da SPEC; na página nova, citar "dinheiro falso", "fictício", "simulação", "teste", "demonstração" ou parecidos; mexer no contador do lance (`placa-lance.tsx`); "corrigir" cronômetro sem causa reproduzida.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Botão ativo | `button`, `[role=tab]`, `summary`, checkbox, radio | `cursor: pointer` | N/A |
| Botão inerte | `:disabled`, `[aria-disabled=true]` | `cursor: not-allowed`, sem mãozinha | N/A |
| Botão carregando | `aria-busy=true` | `cursor: progress` (já existente) | N/A |
| Página | `/como-funciona` | título "Como Funciona", exatamente 3 passos, CTA para `/`, rodapé | N/A |
| Navegação | cabeçalho e menu celular | link "Como Funciona" para `/como-funciona` | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/globals.css` -- `@layer base` ausente: o preflight do Tailwind 4 deixa `button` com `cursor: default`; regra global entra aqui.
- `apps/web/src/components/ui/button.tsx`, `filter-tabs.tsx`, `field.tsx` -- já têm `disabled:cursor-not-allowed`; utilities vencem a camada base.
- `apps/web/src/lib/server-clock.ts`, `use-server-clock.ts` -- relógio único (store + 1 `setInterval`); `components/lots/cronometro.tsx` é o único componente de contagem; `lib/lots.ts` tem `countdownState`/`formatCountdown`.
- `apps/web/src/components/site-header.tsx`, `public-header.tsx`, `menu-celular.tsx`, `site-footer.tsx` -- navegação e rodapé.
- `apps/web/src/components/ui/page-shell.tsx` -- casca das páginas internas; `app/(site)/` -- rotas com cabeçalho e rodapé.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/app/globals.css` -- regra global de cursor (pointer / not-allowed) -- consistência sem remendar
- [ ] `apps/web/src/lib/cursor.test.ts` (ou similar) -- teste que guarda a regra global
- [ ] Cronômetros -- reproduzir em prod build, dev, desvio de relógio, transições e extensão; só alterar código se houver causa provada; registrar o resultado no diário
- [ ] `apps/web/src/app/(site)/como-funciona/page.tsx` + componente + teste -- página de 3 passos com CTA
- [ ] Navegação e rodapé -- link "Como Funciona"
- [ ] `_bmad-output/progresso.md` -- registrar o feito

**Acceptance Criteria:**
- Given qualquer botão ativo do site, when o ponteiro passa por cima, then o cursor é mãozinha; desabilitado mostra `not-allowed`.
- Given `/como-funciona`, when a página renderiza, then há título "Como Funciona", 3 passos, CTA para a vitrine, rodapé, e nenhum dos termos proibidos.
- `npm run lint`, `npm run typecheck` e `npm test` passam.

## Implementation Notes

- Diagnóstico dos cronômetros (29/10/2026): ver diário. Não reproduzido em build de produção local, `next dev`, site publicado, desvios de relógio de +32 s, −5 min e +3 h, transição agendado→ao vivo, últimos 2 min, prorrogação por lance, apuração e encerramento, em desktop e 375 px, claro e escuro.
