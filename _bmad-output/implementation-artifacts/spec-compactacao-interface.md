---
title: 'Interface compacta e cabeçalho organizado'
type: 'feature'
created: '2026-10-24'
status: 'done'
baseline_commit: '9d9cc10ec51468f441d6a0805b2285e97d5fa04c'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="Escopo aprovado por Felipe na conversa">

## Intent

**Problema:** a escala e a fragmentação dos controles consomem espaço na interface.
**Abordagem:** implementar `_bmad-output/proposta-ux-compactacao.md`, aprovada por Felipe em 24/10/2026 com “aprovo. Pode fazer e me entregar pronto”. Compactar estilos e agrupar o header preservando identidade e funcionamento.

## Boundaries & Constraints

**Sempre:** paleta e fontes existentes, foco visível, alvos de 44 px, layout responsivo, preferência persistente, rotas e ação de logout existentes. Servidor continua fonte de saldo/tempo/valor. Seguir SPEC T1–T13 e INV-1–18. Commits atômicos em português, diário e push por etapa, deploy e smoke.
**Nunca:** zoom/scale global, dependências novas, mudanças em API, contratos, regras de lance, autorização, cache ou rotas. Não versionar apps/web/AGENTS.md. Não abrir PRD/EXPERIENCE/DESIGN/arquitetura.

## I/O & Edge-Case Matrix

| Estado | Interação | Resultado |
|---|---|---|
| Tema automático inicial | Abrir | Toggle reflete sistema; primeira escolha persiste claro/noite |
| Tema explícito | Recarregar/outra aba | Tema e toggle coerentes |
| Perfil fechado | Enter/Espaço | Abre nome, papel e Sair; foco na ação |
| Perfil aberto | Escape | Fecha e devolve foco ao botão |
| Perfil aberto | Clique fora/Tab sai | Fecha, respeita foco de destino |
| Licitante | Ocultar saldo | Máscara de seis pontos, sem valor em DOM acessível/tooltip |
| Saldo oculto | Recarregar/logout/outra aba | Continua oculto, sem lampejo durante hidratação |
| Saldo oculto | Mostrar | Exibe valor atual do cache, formatado como antes |
| Storage bloqueado | Alternar | Funciona em memória na sessão |
| Visitante/leiloeiro | Abrir header | Links do papel; sem saldo de licitante |
| Sessão carregando/erro | Abrir | Preserva estados existentes |

</frozen-after-approval>

## Code Map

- `apps/web/src/app/globals.css`, `apps/web/tailwind.config.mjs`: tokens de escala, cores e foco.
- `apps/web/src/components/ui/{button,field,page-shell,logo,theme-switch}.tsx`: primitivos; `lib/theme.ts` possui storage e script antes da pintura.
- `components/site-header.tsx`: navegação por papel; `balance-chip.tsx`: link, `useWalletSummary` e `formatBRL`; `auth-provider.tsx`: usuário e logout, sem reescrever.
- `components/{vitrine,sala,wallet-screen,painel-screen,access-screen,criar-lote-form}.tsx`, `components/lots/*`: medidas locais; preservar comportamento.
- `components/ui/dialog.tsx`: modal, não reutilizar como dropdown.

## Tasks & Acceptance

**Execution:**
- [x] `globals.css`, `tailwind.config.mjs` e primitivos: reduzir títulos, controles, sombras e espaçamentos conforme proposta.
- [x] Telas e cards acima: ajustar medidas locais para escala consistente.
- [x] `lib/theme.ts`, `ui/theme-switch.tsx`, SVGs locais: toggle acessível com sistema, memória e sincronização.
- [x] `components/profile-menu.tsx`: botão/avatar, dropdown e foco, usando usuário/logout existentes.
- [x] `lib/balance-visibility.ts`, `balance-chip.tsx`: preferência, máscara e privacidade, link e olho irmãos.
- [x] `site-header.tsx`, CSS: agrupar e reorganizar sem duplicar controles; ajustar escala de `public-header.tsx`.
- [x] Testes de preferências e roteiro no navegador: matriz, reflow, fluxos existentes, deploy/smoke.

**Acceptance Criteria:**
- Dado cada papel, quando abrir em 320/390/768/1024/1440 px, então header não sobrepõe nem cria rolagem horizontal; navegação preservada.
- Dado ambos os temas, quando navegar por teclado, então foco/estado são visíveis e controles operáveis.
- Dado saldo oculto, quando a página hidratar e receber atualizações, então nenhum valor aparece no header até escolha explícita.
- Dado viewport pequeno ou zoom 200%, quando ler conteúdo e menus, então textos e controles continuam acessíveis.
- Dado fluxo de busca, acesso, carteira e lance, quando usar ações existentes, então a compactação não modifica regras ou destinos.

## Implementation Notes

Sem lacunas de intenção após aprovação. Área afetada: frontend e documentação/testes. Push aciona deploy já autorizado pelo projeto; não há migração ou mudança de dados necessária. Implementação seguirá o escopo já aprovado, sem solicitar novamente a mesma autorização. Implementador: fazer commits atômicos e push por etapa conforme pedido do usuário (precedência sobre orientação genérica da skill); registrar no diário. Ler guia Next local pertinente antes de editar código, conforme apps/web/AGENTS.md. A aprovação da proposta autoriza todo este escopo. O agente principal poderá complementar verificação de navegador/deploy ao final.

## Spec Change Log

## Review Triage Log

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`: saída zero. Navegador Chrome: temas, papéis, tamanhos, foco, recarga/abas, storage bloqueado e árvore acessível. Smoke público após deploy. Registrar evidência real e limitações no diário.
