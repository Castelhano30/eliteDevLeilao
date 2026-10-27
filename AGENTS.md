<!-- bmad:context -->
<!-- Verified 2026-10-23 against dd9707a. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## LanceAuto (eliteDevLeilao)

Casa de leilões de carros (teste técnico Verzel, 7 dias, deploy obrigatório). Next.js (App Router) + React + TypeScript, Node + Express + Socket.IO, PostgreSQL + Prisma, zod, TanStack Query, Tailwind, Vitest; npm workspaces (`apps/web`, `apps/api`, `packages/shared`). Ainda não há código: ele nasce na S00. Planejamento em `_bmad-output/`.

## Fonte de verdade

- Construa pela SPEC. Por tarefa, leia só `_bmad-output/specs/spec-lanceauto/SPEC.md`, o arquivo da fatia atual e o código existente. PRD, EXPERIENCE, DESIGN e architecture servem só para rastreio: não abra.
- Siga a ordem S00 → S09. Dúvida que a fatia não resolve: registre em "Perguntas abertas" da fatia e siga com a sugestão marcada; não invente.
- Conflito: decisões do usuário (`_bmad-output/progresso.md`) > PRD > arquitetura > EXPERIENCE > DESIGN. No build, a fatia vence a arquitetura e o EXPERIENCE, e as "Decisões transversais" T1–T13 do SPEC.md valem sobre qualquer fatia.

## Policy

- Commits atômicos (uma mudança lógica cada), em português, claros, enxutos, objetivos e com escrita humanizada.
- Nunca adicione `Co-Authored-By`, "Generated with Claude" ou qualquer marca de IA em commits e PRs; só a conta Castelhano30 aparece.
- `git push` ao fim de cada etapa.
- Após cada passo relevante, atualize `_bmad-output/progresso.md` (diário; base do relato de uso de IA da entrega).
- Feito = "Definition of Done" do arquivo da fatia (migração aplicada, testes [auto] verdes, checklist [manual] feito, deploy atualizado, smoke no link público).

## Where things are

- Contratos (zod, tipos, `lotStatus`, textos canônicos) em `packages/shared`; `apps/web` nunca importa `apps/api` (INV-17).
- Invariantes INV-1 a INV-18 e T1–T13: SPEC.md.

## Running and verifying

- Windows 11, PowerShell ou Git Bash: não assuma comandos Unix no PowerShell.
- Na raiz: `npm run dev` (shared em watch, API e web), `npm run build` (shared → api → web), `npm run lint`, `npm run typecheck`, `npm test`. Banco local: `docker compose up -d db` (porta 5433 na máquina do Felipe; 5432/3000/4000 ocupadas, use `WEB_PORT`/`PORT`). Os testes da API exigem `DATABASE_URL_TEST`. `next dev` gera `apps/web/AGENTS.md`: não versione.
- Versões verificadas (T13): Node 24.14.1 (engines >=22.12), npm 11.11.0, Next 16.4.2, React 19.3.1, Express 5.3.0, Socket.IO 4.8.4, zod 4.6.7, TanStack Query 5.104.5, Tailwind 4.3.3, Vitest 5.0.5, ESLint 9.39.5, TypeScript 5.9.3, **Prisma 6.19.3** (o 7 tira `url`/`directUrl` do schema). O Vitest do web usa `oxc.jsx`, não `esbuild`.

## Conventions that differ from defaults

- Dinheiro em centavos inteiros: `BigInt` no banco, `number` nas bordas, campos `…Cents`; a UI mostra só reais inteiros (INV-2).
- Datas em UTC; `Date`/`Date.now()` proibidos em `apps/api/src` fora de `infra/clock.ts`; services gravam `createdAt`/`at` com `clock.now()` (T6).
- O servidor é a verdade de tempo, saldo e valor: sem atualização otimista.
- Mutação só por REST via service; Socket.IO só transmite, e os eventos saem depois do commit.
- Ordem de locks: lote (`FOR UPDATE`) → carteiras por `userId` ascendente.
- `Bid` é append-only (trigger rejeita UPDATE/DELETE); nunca edite nem apague lance.
- Funções da cadeia HMAC recebem a chave como primeiro argumento (T5); `version` = `entryCount` (T4).
- Token do comprovante nunca entra em DTO público (T9); DTOs públicos não têm `userId`, nome nem e-mail.
- Erros no envelope `{error:{code,message,details?}}`, mensagem em pt-BR (INV-16).

## Known pitfalls

- Ids são TEXT: nunca use `::uuid` em SQL.
- Testes de integração compartilham um Postgres: Vitest da API com `fileParallelism: false`, e o helper de adulteração faz `DISABLE TRIGGER`, `UPDATE`, `ENABLE TRIGGER` numa só transação (T2).
- Premissas externas (FIPE v2, Wikipedia, versões, release do Render) estão por verificar: confira no dia 1 conforme T13 antes de depender delas.

<!-- /bmad:context -->
