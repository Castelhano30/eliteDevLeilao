---
title: 'Repaginação visual do site inteiro: sistema "Azul de leilão" (DESIGN Rev. 04)'
type: 'feature'
created: '2026-10-27'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '52405366d3a83af629f07f813525e4af4fdfdce9'
review_loop_iteration: 0
context:
  - ../planning-artifacts/DESIGN.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Só o cabeçalho foi repaginado (azul, cantos arredondados, sombra suave, hover). O resto do site ainda carrega o "Manual de pátio": bordas de 3px, sombras duras, cantos retos, carimbos inclinados, tracejado como linguagem e tokens de cor sem contraste no tema noite (o `#0033A0` dá 1,65:1 sobre a superfície).

**Approach:** Aplicar o DESIGN.md Rev. 04 ao site inteiro, nos temas claro e noite, em 12 etapas pequenas, uma por commit, na ordem da seção 7 do DESIGN. Só estilo: nenhum comportamento, fluxo, rota, texto canônico ou regra de negócio muda.

</frozen-after-approval>

## Boundaries & Constraints

**Always:**
- **Fonte dos valores:** `_bmad-output/planning-artifacts/DESIGN.md`. Para esta spec, e só para ela, abra as seções 2 (tokens), 4 (componentes), 5 (estados de lote), 6 (acessibilidade) e 7 (etapas) e o frontmatter. Em divergência entre esta spec e o DESIGN em *valores* (cor, raio, sombra), vale o DESIGN; em *escopo e limites*, vale esta spec.
- Referência visual aprovada: o cabeçalho (`.cabecalho` em `apps/web/src/app/globals.css`, `site-header.tsx`, `ui/logo.tsx`). Os botões Entrar e Criar conta são o padrão de acabamento: compactos, arredondados, com hover, foco e afundar.
- Contraste medido (não estimado): ≥ 4,5:1 texto, ≥ 3:1 borda de controle, ícone e anel de foco, nos dois temas. Registre as razões que medir com `node`. No noite, o `#0033A0` nunca é texto nem borda: use `ocreTexto` (`#6B93FF`) para texto azul e `ocre` (`#174BC2`) para fundo de botão.
- **Nomes de token e de classe Tailwind existentes não mudam** (`ocre`, `ocreTexto`, `sobreOcre`, `ferrugem`, `verde`, `papel`, `linha`, `shadow-cartao` etc.). Mudam os *valores*. Tokens novos: `borda`, `ocreHover`, `selecionado`, `foco`, `destaque`, `verdeSuave`, `alerta`, `alertaSuave`, `sobreAlerta` (e a chave `shadow-modal`).
- Preservar: Manrope; logo (placa escura no cabeçalho claro, clara no noite); etiqueta do lote em faixa própria no cartão (chanfro, furo, cordão); cronômetro com `tabular-nums` e `nowrap`, `role="timer"` e `aria-label` intactos; valores em reais inteiros; `la-*` keyframes e `prefers-reduced-motion`.
- Estado nunca só por cor: todo selo, aviso e faixa mantém texto e, quando o DESIGN prevê, ícone.
- Alvo de toque 44px; o compacto de 40px do cabeçalho sobe a 44px com `pointer: coarse` (decidido).
- Um botão primário por tela (por camada, no diálogo). O confirmar de "Cancelar lote" **continua primário azul**; `ferrugem` só no aviso (SPEC C9).
- Commits atômicos em português, claros e enxutos, sem `Co-Authored-By` nem marca de IA; só a conta Castelhano30. Registro por etapa em `_bmad-output/progresso.md`, com push e deploy marcados como pendentes de aprovação.
- Cada etapa fecha com `npm run typecheck`, `npm run lint` e `npm test` verdes (testes que citam classes antigas são atualizados na própria etapa) e conferência no Chrome real, nos dois temas, em 360 e 1280 px.

**Never:**
- `git push`, deploy, tocar o banco de produção. A branch `repaginacao-visual` fica local até o Felipe aprovar.
- Mudar texto canônico, rota, regra de negócio, ordem de foco, `aria-*` existentes ou comportamento (inclusive de diálogo e Socket.IO). Se um ajuste visual exigir isso, pare e registre em "Perguntas abertas" do DESIGN (seção 8) ou em `deferred-work.md`, e siga com a sugestão marcada.
- Criar o texto "Encerrando" (P2): o estado usa "ÚLTIMOS 2 MIN" e "Apurando…" que já existem.
- Renomear `ocre` ou qualquer token (P5 só propõe, como commit separado e opcional ao final, e só com aval do Felipe).
- Trocar a fonte do hash (P4) ou adicionar fonte monoespaçada.
- Criar toast, sidebar, menu hambúrguer, breakpoint nomeado ou fluxo mobile novo.
- Gradiente, glow ou sombra dura. A única exceção é o brilho azul do logo dentro do cabeçalho noite, que já está aprovado.
- Abrir PRD, EXPERIENCE ou architecture. O INV-18 do SPEC cita "IBM Plex Mono"; isso foi superado pela decisão de tipografia Manrope (`spec-tipografia-manrope.md`) e não vale para esta spec.
- Mexer no escopo `.cabecalho` além de apontar seus `--h-*` para os tokens globais (DESIGN 2.4). O cabeçalho precisa ficar pixel a pixel como hoje.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Botão primário no noite | Tema noite, qualquer tela | Fundo `#174BC2`, texto branco 7,44:1, hover `#2459D6`, borda 1px `destaque` | N/A |
| Texto azul no noite | Link, filtro ativo, "VOCÊ" | `#6B93FF`, ≥ 5,30:1 em `papel`, `fundo`, `suave` e `selecionado` | N/A |
| Campo com erro | Valor inválido | Borda `ferrugem` (2px visuais), ícone, mensagem ligada por `aria-describedby`, valor digitado preservado | N/A |
| Estados de lote | Agendado, aberto, encerrando, encerrado, cancelado | Cinco aparências distintas, cada uma com texto e ícone, legíveis em escala de cinza | N/A |
| Lote cancelado | `CANCELLED` | Etiqueta neutra (`papel`), selo "Cancelado" vermelho suave, título legível | N/A |
| Cronômetro ≤ 2 min | `ultimos` | Borda `alerta`, dígitos `ledAlerta` pulsando, rótulo "ÚLTIMOS 2 MIN" e ícone | Com `prefers-reduced-motion`, sem pulso e ainda legível |
| Cronômetro longo | `26d 10:18:34` a 320 px | Uma linha, sem rolagem lateral da página | N/A |
| Selo "+2 MIN" | Prorrogado, `ultimos` | Não cobre o rótulo do cronômetro (cartão e Sala) | N/A |
| Auditoria "ELO QUEBRADO" | Linha de elo quebrado | `suave` + `tinta2`, sem `opacity`, com texto e ícone | N/A |
| Tabela larga | 360 px | Rola dentro de região focável e identificada; a página não rola | N/A |
| Zoom 200% e 320 px | Qualquer tela | Sem overflow da página; ações quebram linha | N/A |
| Foco por teclado | Qualquer controle, claro e noite | Anel de 3px `foco`, afastamento 2px, sempre visível | N/A |
| Cabeçalho | Visitante, licitante, leiloeiro, claro e noite | Idêntico ao estado anterior à repaginação | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/globals.css` -- tokens `--c-*` (`:root`/`[data-theme="claro"]`, `[data-theme="noite"]` e o bloco `prefers-color-scheme`), literais `--f-*`, foco global, `a`/`a:hover`, `dialog::backdrop`, escopo `.cabecalho` (`--h-*`), keyframes `la-*`.
- `apps/web/tailwind.config.mjs` -- `colors`, `borderRadius` (`nenhum`, `placa`, `logo*`, `circulo`), `boxShadow` (`cartao`, `botao`, `botao-ativo`, `chip`, `painel`).
- Botões e campos: `ui/button.tsx` (`buttonClasses`), `ui/skip-link.tsx`, `ui/field.tsx`, `money-field.tsx`, `lots/bid-form.tsx`, `access-tabs.tsx`, `site-header.tsx` (`BOTAO`, `BOTAO_ENTRAR`, `BOTAO_CRIAR`), `ui/theme-switch.tsx`, `balance-chip.tsx`.
- Selos e estados: `ui/stamp.tsx`, `ui/lot-tag.tsx`, `ui/identity-chip.tsx`, `my-bids/status-seal.tsx`, `lots/chip-licitante.tsx`.
- Vitrine e cartão: `lots/lot-card.tsx` (`ROTATE`, `shell`), `ui/filter-tabs.tsx`, `lots/car-photo.tsx`, `vitrine.tsx`.
- Sala: `sala.tsx`, `lots/cronometro.tsx` (`SeloProrrogacao`), `lots/placa-lance.tsx`, `lots/bid-panel.tsx`, `lots/faixa-status.tsx`, `lots/placar-posicao.tsx`, `lots/bid-history.tsx`, `lots/resultado-do-lote.tsx`, `lots/canhoto.tsx`.
- Feedback: `ui/feedback-state.tsx`, `ui/refusal-message.tsx`, `connection-banner.tsx`, `aviso-papel.tsx`, `global-states.tsx`, `ui/dialog.tsx`, `cancel-dialog.tsx`, `profile-menu.tsx`, `ui/perforation.tsx`.
- Tabelas: `ui/data-table.tsx`, `wallet-screen.tsx`, `painel-screen.tsx`, `audit/audit-table.tsx`, `audit/row-status.tsx`.
- Telas: `access-screen.tsx`, `role-tickets.tsx`, `test-accounts.tsx`, `my-bids/*`, `comprovante/*`, `audit/*`, `criar-lote-form.tsx`, `require-auth.tsx`.
- Testes que citam classes visuais: `ui/ui.test.tsx`, `lots/lot-card.test.tsx`, `lots/cronometro.test.tsx`, `header.test.tsx`, `balance-chip.test.tsx`, `my-bids/bid-ticket-list.test.tsx`, `cancel-dialog.test.tsx`, `global-states.test.tsx`, `audit/audit.test.tsx`.
- Pendência herdada: selo "+2 MIN" cobre parte do rótulo no cartão (`deferred-work.md`); esta spec a resolve só no visual.

## Tasks & Acceptance

**Execution** (uma etapa = um commit; o número é o da seção 7 do DESIGN):
- [ ] 1. `globals.css`, `tailwind.config.mjs` -- tokens claro e noite (inclusive `prefers-color-scheme`), tokens novos, `painel`/rótulos do relógio/`digitoPlaca`, sombras e raios por nome existente, `shadow-modal`, `::backdrop`; `.cabecalho` aponta os `--h-*` para os globais (DESIGN 2.4) sem mudar sua aparência; medir e registrar os pares da seção 6.
- [ ] 2. `globals.css` -- foco global (anel `foco`), links (sublinhado em texto corrido, hover azul, fim do `a:hover` vermelho), `body`, seleção.
- [ ] 3. `ui/button.tsx`, `site-header.tsx`, `ui/skip-link.tsx` -- primário, secundário, fantasma, perigo (secundário e sólido), desabilitado, carregando (spinner + `loadingText`, `aria-busy`, sem virar desabilitado), atalho, ícone; tamanhos padrão, compacto e Sala; botões da conta do cabeçalho passam a usar as classes globais.
- [ ] 4. Campos -- `Field`, `MoneyField`, selects, busca, campo e atalhos do lance, valores do depósito, controle segmentado do Acesso.
- [ ] 5. Selos e estados -- `Stamp` em pílula sem rotação, `LotTag` com os tons novos (cancelado neutro), `StatusSeal`, estados da seção 5 do DESIGN.
- [ ] 6. Cartão de lote, `FilterTabs`, `CarPhoto`, Vitrine -- casca nova, faixa da etiqueta preservada, rodapés por estado, hover.
- [ ] 7. `Cronometro`, `placa-lance` -- display novo, variante encerrando com ícone, `SeloProrrogacao` fora do rótulo.
- [ ] 8. Sala -- painel, faixa de posição, histórico, resultado e carimbo (`la-bate` até -3°), cancelado, "Apurando".
- [ ] 9. Avisos e diálogos -- `FeedbackState`, `RefusalMessage`, `ConnectionBanner`, `AvisoPapel`, estados globais, `Dialog`, `CancelDialog`, menu do perfil.
- [ ] 10. Tabelas e listas -- `DataTable`, extrato da Carteira, painel do leiloeiro, lista de lances, chip do licitante.
- [ ] 11. Telas -- Acesso (bilhetes), Carteira ("Disponível"), Arremates (canhoto), Comprovante e recibo, Auditoria, Criar lote.
- [ ] 12. Limpeza -- remover `rounded-nenhum`, `border-2`, `border-dashed` e sombras duras restantes; varrer `hover:text-ferrugem`; conferir pares renderizados; 200% e 320 px; atualizar o diário.
- [ ] `_bmad-output/progresso.md` -- um registro por etapa (o que mudou, razões de contraste medidas, o que foi conferido no Chrome). Base do relato de uso de IA.

**Acceptance Criteria:**
- Given os temas claro e noite, when qualquer texto, ícone, borda de controle ou anel de foco é renderizado, then respeita os mínimos da seção 6 do DESIGN, e nenhum `#0033A0` aparece como texto ou borda no noite.
- Given qualquer tela, when há um botão, then ele tem hover, foco, pressionado, desabilitado e carregando coerentes com o botão "Criar conta" do cabeçalho.
- Given os cinco estados de lote, when vistos em escala de cinza, then são distinguíveis por texto e ícone.
- Given a Vitrine, a Sala, a Carteira, Meus arremates, o Painel, Criar lote, o Comprovante, a Auditoria e o Acesso, nos dois temas, em 360 e 1280 px, then nenhum elemento tem sombra dura, borda de 3px, tracejado fora do picote nem canto reto (exceto picote).
- Given 320 px e 200% de zoom, then a página não rola na horizontal (só tabelas, dentro de região identificada).
- Given o cabeçalho (visitante, licitante, leiloeiro; claro e noite), then está igual ao de antes da repaginação.
- Given `prefers-reduced-motion`, then nenhum estado depende de animação.
- Given `npm run typecheck`, `npm run lint` e `npm test`, then todos terminam verdes.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- expected: exit 0 (na raiz, após cada etapa).
- `npm run build` -- expected: exit 0 (ao fim da etapa 12).
- `grep -rn "rounded-nenhum\|border-dashed\|border-\[3px\]\|hover:text-ferrugem" apps/web/src` -- expected (etapa 12): só o picote e usos justificados no diário.
- `grep -rin "e2a514\|e8ae22\|226, 165" apps packages` -- expected: nenhum resultado fora de `node_modules` e `.next`.

**Manual checks (if no CLI):**
- Chrome real, aplicação local (banco descartável `lanceauto_visual`, ver pegadinhas em `conferencia-no-chrome-real`): Vitrine (ao vivo, agendados, encerrados e um cancelado), Sala (todas as variantes, incluindo ≤ 2 min, prorrogado, apurando, encerrado e cancelado), Carteira, Meus arremates, Painel, Criar lote, Comprovante, Auditoria (íntegro e adulterado) e Acesso. Claro e noite, 360 e 1280 px, mais 320 px e 200% nas telas de formulário e tabela. Prints antes e depois em `.tmp/repag/`.
- Navegação só por teclado: anel de foco visível em todos os controles e no cartão de lote.

## Implementation Notes

(a preencher pela Amelia: uma linha por etapa, no padrão da spec anterior)

## Review Triage Log

(a preencher na revisão)
