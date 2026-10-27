---
title: 'Repaginação: azul da marca, etiqueta do lote sem sobreposição e cronômetro sem fantasma'
type: 'feature'
created: '2026-10-27'
status: 'in-progress'
route: 'dispatch'
baseline_commit: 'd994e619c2d86588c38edf4ba7f6e5cee35af9db'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A marca ainda usa o amarelo `#E2A514` e deve passar a `#0033A0`. A etiqueta do lote (`LotTag`) cobre subtítulo, foto e chip de data, e o carimbo "ARREMATADO" é cortado. O cronômetro mostra um segundo mostrador "88:88:88" abaixo do tempo real.

**Approach:** Três etapas, na ordem, cada uma com ao menos um commit local: (1) trocar a cor com contraste validado nos dois temas; (2) reservar espaço e reancorar etiqueta e laço; (3) alinhar o fantasma do cronômetro ao texto real, depois de confirmar a causa no navegador.

## Boundaries & Constraints

**Always:** Contraste ≥ 4,5:1 para texto e ≥ 3:1 para borda e ícone (medido, não estimado). `--c-sobre-ocre` é papel claro (`#f5eedf`) nos dois temas. LED do cronômetro fica âmbar (metáfora do LCD de bomba, luz quente). `aria-label` e `role="timer"` do cronômetro não mudam. Foco visível, hover e disabled dos botões preservados. Commits atômicos em português, sem marca de IA. Progresso registrado em `_bmad-output/progresso.md`, com push e deploy marcados como pendentes de aprovação.

**Never:** `git push`, deploy, tocar o banco de produção. Renomear `ocre` neste trabalho (só propor, como commit separado e opcional ao final). Abrir PRD, EXPERIENCE, DESIGN ou architecture. Remover a identidade "etiqueta amarrada no retrovisor".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cronômetro longo | `26d 10:18:34`, "sala" e "cartao" | Fantasma numa linha, mesma largura, dígito a dígito | N/A |
| Cronômetro curto | `09:05` | Fantasma `88:88` alinhado | N/A |
| Últimos 2 min | `alert` | Pulsa; fantasma parado e alinhado | N/A |
| Etiqueta, título de 1 e 2 linhas | Ao vivo, agendado, encerrado | Nada sobreposto: subtítulo, linha divisória, foto, chip de data | N/A |
| Carimbo "ARREMATADO" | Cartão a 360 px | Cabe inteiro dentro da foto | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/globals.css` -- tokens (`--c-ocre` :16/:38/:61, `--c-sobre-ocre`, `--f-faixa-placa` :75), `la-marca` (:157, usa `rgba(226,165,20)`), `.la-segmentos-apagados` (:145), `.theme-sun/.theme-moon`.
- `apps/web/tailwind.config.mjs` -- mapeia `ocre`, `sobreOcre`, `faixaPlaca`; receberá o token de texto.
- Usos de `ocre` como FUNDO com texto `sobreOcre`: `ui/button.tsx`, `ui/identity-chip.tsx`, `lots/chip-licitante.tsx`, `lots/cronometro.tsx` (SeloProrrogacao), `painel-screen.tsx`, `role-tickets.tsx`, `wallet-screen.tsx`, `test-accounts.tsx`, `audit/audit-table.tsx`, `ui/logo.tsx` (faixa da placa).
- Usos como TEXTO, traço ou ponto: `lots/canhoto.tsx` (`var(--c-ocre)` com `WebkitTextStroke`), `audit/verifying-indicator.tsx` (`bg-ocre`), `la-marca`.
- `apps/web/src/components/ui/lot-tag.tsx` -- laço SVG (`left -22`, `top -26`) e etiqueta. Usado em `lots/lot-card.tsx:103`, `sala.tsx:204`, `audit/audit-screen.tsx:92`, `my-bids/bid-ticket.tsx:52`, `comprovante/recibo.tsx:36`, `criar-lote-form.tsx:323`, `kit-demo.tsx`.
- `lots/lot-card.tsx:103` ancora a etiqueta a `-55%` do topo; `vitrine.tsx:234` tem `mb-10` entre cabeçalho e grade; `lot-card.tsx:111` fixa o carimbo em `w-[184px]`; `ui/stamp.tsx` usa `.t-carimbo` (26 px).
- `lots/cronometro.tsx:84-94` -- fantasma `absolute inset-0` com `data-ghost` (`\d`→`8`) dentro de um `span` inline.
- Testes: `lots/cronometro.test.tsx`, `my-bids/bid-ticket-list.test.tsx` (citam `bg-ocre`), `ui/ui.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [ ] `globals.css`, `tailwind.config.mjs` -- `--c-ocre` e `--f-faixa-placa` = `#0033A0`; `--c-sobre-ocre` = papel nos dois temas; novo `--c-ocre-texto` (claro `#0033A0`, noite clara da mesma matiz, ≥ 4,5:1 sobre `--c-papel`/`--c-fundo`); `canhoto`, `verifying-indicator` e `la-marca` passam ao token de texto; medir razões com `node` e registrar -- etapa 1
- [ ] `lot-tag.tsx`, `lot-card.tsx`, `vitrine.tsx` e os outros usos -- reservar espaço e reancorar etiqueta e laço sem tocar subtítulo, foto nem chip; carimbo menor, sem corte -- etapa 2
- [ ] `cronometro.tsx`, `globals.css` -- confirmar a causa no Chrome real; `tabular-nums` nos dois textos e `white-space: nowrap` no fantasma -- etapa 3
- [ ] `cronometro.test.tsx` -- teste que trava o fantasma (mesmo comprimento do texto, `aria-hidden`, `role="timer"` intacto) -- etapa 3
- [ ] `_bmad-output/progresso.md` -- um registro por etapa; push e deploy pendentes de aprovação

**Acceptance Criteria:**
- Given o tema claro ou noite, when qualquer botão, etiqueta, selo ou faixa ocre aparece, then o texto sobre ele tem ≥ 4,5:1 e não resta `#E2A514`, `#E8AE22` nem `rgba(226,165,20)` em `apps/` e `packages/`.
- Given a Vitrine em 360, 768 e 1280 px, claro e noite, when há lotes ao vivo, agendados e encerrados, then nenhuma etiqueta, laço ou carimbo cobre texto ou é cortado.
- Given o cronômetro "sala" e "cartao", when mostra `26d 10:18:34`, `09:05` ou "últimos 2 min", then existe um único mostrador e o fantasma tem a largura do texto.
- Given `npm run typecheck`, `npm run lint` e `npm test`, then todos terminam verdes.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- expected: exit 0
- `grep -ri "e2a514\|e8ae22\|226, 165" apps packages` -- expected: nenhum resultado fora de `node_modules` e `.next`

**Manual checks (if no CLI):**
- Chrome real, aplicação local: Vitrine, Sala, Painel, Meus lances, Auditoria e Comprovante em claro e noite, com prints antes e depois.
