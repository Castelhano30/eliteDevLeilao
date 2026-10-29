---
title: 'Reset do banco para o avaliador'
type: 'chore'
created: '2026-10-29'
status: 'done'
baseline_commit: '26fcb0d3cace251d660c8ca6ad96e133cacef79c'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** As 3 contas de teste (leiloeiro, Ana, Bruno) acumularam dados dos testes internos. O seed só age em banco sem usuários, e usuário não pode ser apagado (o trigger append-only de `Bid` rejeita o `SET NULL`). Não há como entregar ao avaliador um ambiente limpo sem mexer no SQL à mão.

**Approach:** Um comando `seed:reset` que esvazia o banco inteiro (`TRUNCATE … RESTART IDENTITY CASCADE`, menos `_prisma_migrations`) e reaplica o `runSeed`, atrás de uma trava de confirmação explícita. Os e-mails e a senha ficam como estão.

## Boundaries & Constraints

**Always:** Reset e seed na mesma execução: o `TRUNCATE` roda numa transação sob o `pg_advisory_xact_lock` do seed e, concluída ela, o `runSeed` assume o mesmo lock (duas transações em sequência, nunca aninhadas). A trava exige a flag `--confirmo` e imprime o host do banco (sem usuário e senha) antes de agir. A numeração dos lotes recomeça em 001. Seed pelos services (INV/T6). Validar num banco local descartável (`DATABASE_URL_TEST`) antes de qualquer menção à produção.

**Decisão do Felipe (dados do avaliador):** manter os 5 lotes atuais do `runSeed` (001 arrematado, 002 sem lances, 003 cancelado, 004 agendado, 005 ao vivo), sem alterar o seed nem o fixture.

**Never:** Rodar contra o Railway sem OK explícito do Felipe. Disparar o reset no start da API ou no deploy. Mexer em `Bid` por UPDATE/DELETE ou criar trigger de TRUNCATE. Trocar e-mails ou senha das contas. `git push` sem pedido.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reset com confirmação | Banco com usuários extras, lances e lotes além do seed | Só as 3 contas e os lotes do seed; saldos iniciais; lotes numerados de 001; auditoria `OK` | N/A |
| Sem `--confirmo` | Qualquer banco | Nada é alterado; mensagem em pt-BR e código de saída ≠ 0 | Sem conexão de escrita |
| Falha no seed | Erro no meio do `runSeed` | O erro sobe e o código sai ≠ 0; o seed roda numa transação, então não sobram dados parciais | Rodar de novo refaz tudo |
| Execução repetida | Reset duas vezes seguidas | Mesmo resultado, sem duplicar nada | N/A |

</frozen-after-approval>

## Code Map

- `apps/api/src/seed/showcase.ts` -- `runSeed`, `withSeedLock` (privada, exportar ou reutilizar a chave `ADVISORY_LOCK_KEY`), `SEED_ACCOUNTS`, `SeedDeps`. Reaproveitar `runSeed` sem alterá-lo.
- `apps/api/prisma/seed.ts` -- CLI do seed; modelo para o novo CLI (dotenv, `JWT_SECRET`/`AUDIT_HMAC_KEY`, fixture, `$disconnect`).
- `apps/api/test/helpers/db.ts` -- `truncateAll` e `restartLotNumbering` (mesmo SQL, só para teste; não importar de `src`).
- `apps/api/src/seed/seed.test.ts` -- padrão de teste de integração (`describe.skipIf(!testDatabaseUrl)`, `truncateAll`, `makeTestApp`).
- `apps/api/prisma/migrations/20261024120000_add_bid/migration.sql` -- sem trigger de TRUNCATE de propósito; `Lot.number` é `SERIAL`, então `RESTART IDENTITY` reinicia a sequência.
- `apps/api/package.json` e `package.json` (raiz) -- scripts `seed` / `seed:demo`; acrescentar `seed:reset`.
- `README.md` -- seção "Contas semeadas" e "Limitações" (seed só em banco vazio): documentar o reset.
- `apps/web/src/components/test-accounts.tsx` -- não alterar (e-mails e senha mantidos).

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/seed/reset.ts` -- `resetDatabase(deps)`: numa transação sob o advisory lock, lista as tabelas de `public` (menos `_prisma_migrations`) e faz `TRUNCATE … RESTART IDENTITY CASCADE`; depois chama `runSeed` -- se outro seed entrar no intervalo, o `runSeed` apenas pula e o resultado é o mesmo.
- [x] `apps/api/prisma/seed.ts` -- aceitar `--reset`, exigindo `--confirmo`; imprimir o host de `DATABASE_URL` mascarado antes; sem a confirmação, sair com código 1 sem conectar para escrever -- trava contra execução por engano.
- [x] `apps/api/package.json`, `package.json` -- scripts `seed:reset` (`seed.ts --reset`) -- ponto de entrada único.
- [x] `apps/api/src/seed/reset.test.ts` -- cobrir a matriz: usuário e lote extras somem, só 3 contas e 5 lotes (001–005), saldos iniciais, auditoria `OK` em todos, sem confirmação nada muda, repetir dá o mesmo resultado.
- [x] `README.md` -- documentar `seed:reset`, a trava e que ele apaga tudo; nota de que o lote 005 dura 30 dias, então resetar perto da avaliação.
- [x] `_bmad-output/progresso.md` -- registrar o passo.

**Acceptance Criteria:**
- Given um banco com usuários e lotes extras, when `seed:reset --confirmo`, then restam as 3 contas e os lotes do seed, numerados de 001.
- Given qualquer banco, when `seed:reset` sem `--confirmo`, then nenhuma tabela é alterada e o comando sai com erro.
- Given o reset concluído, when a auditoria de cada lote é consultada, then todas respondem íntegras.
- Given `npm run lint`, `npm run typecheck` e `npm test`, when rodam, then passam.

## Implementation Notes

- Criados `apps/api/src/seed/reset.ts` e `reset.test.ts`; `withSeedLock` exportado em `showcase.ts`; `--reset` em `prisma/seed.ts`; scripts `seed:reset` na API e na raiz (o da raiz termina em `--` para repassar `--confirmo` ao npm). README e `progresso.md` atualizados.
- A premissa da matriz ("o seed roda numa transação, então não sobram dados parciais") é falsa: `withSeedLock` só segura o lock e o `runSeed` grava pelos services, fora da transação. O comportamento da matriz (nada parcial) foi garantido no código: se o seed falha, `resetAndSeed` trunca de novo e relança o erro. Teste: "se o seed falha no meio".
- Validado no CLI contra um banco descartável (apagado depois): sem flag recusa com código 1; com flag sobram 3 contas e lotes 1–5; repetir dá o mesmo.
- Revisão (3 revisores, triagem no Review Triage Log): patches aplicados em `reset.ts`, `seed.ts` e nos testes. Validação de argumentos (`resetArgsProblem`: recusa host ilegível, `--reset` com `--demo`, `--confirmo` solto), schema por `current_schema()`, falha quando o `runSeed` pula, erro da limpeza propagado, teste do CLI como processo, estado sujo com lote 006, README com o aviso de tráfego. O nome real da função é `resetAndSeed` (o spec diz `resetDatabase`).
- Produção não foi tocada.

## Spec Change Log

## Review Triage Log

| Achado | Veredito | Rota | Evidência |
|---|---|---|---|
| CLI sem `--confirmo` sem teste automatizado (os 3 revisores) | medium | patch | `reset.test.ts` só testava `isResetConfirmed`; nada executava o `seed.ts`. Se o guard saísse, `npm run seed:reset` apagaria o banco sem teste vermelho |
| `--reset` com `--demo`, ou `--confirmo` sem `--reset`, ignorados em silêncio | low | patch | `seed.ts` deixava `--reset` vencer o `--demo`; correção é uma validação simples |
| Host ilegível ou ausente não impede o reset | medium | patch | `maskDatabaseHost` devolvia texto-placeholder e o fluxo seguia com `--confirmo`: apaga um alvo que o operador não conseguiu conferir |
| `schemaname = 'public'` fixo; com `?schema=outro` trunca 0 tabelas e o seed pula, parecendo sucesso | medium | patch | `truncateEverything` filtrava `public`; `runSeed` retorna `skipped` e o resultado era descartado, então o CLI saía 0 com dados antigos |
| `runSeed` devolvendo `skipped` é ignorado | medium | patch | mesmo ponto: reset "bem-sucedido" sem ter semeado |
| Falha da limpeza pós-seed é engolida; sem `log` fica invisível | medium | patch | `.catch(() => log(...))` com `log` padrão vazio: sobraria seed parcial que o próximo start pularia |
| Teste "sujo" só adiciona um usuário; não exercita lote/lances extras nem a volta da numeração | medium | patch | `dirty()` não cria lote além dos 5; a checagem de 001–005 passaria mesmo sem `RESTART IDENTITY` |
| Teste de migrações pode passar vazio (`before == after == 0`) | low | patch | sem `expect(before > 0)`; correção direta de uma linha |
| Reset com a API no ar: TRUNCATE bloqueia, site fica vazio, JWT de contas apagadas | medium | patch | só documentação: README não avisava; nota adicionada |
| TRUNCATE roda fora da transação do lock; pool 1 travaria | false | rejeitado | comportamento correto e igual ao `runSeed` (grava por `db` dentro de `withSeedLock`), que já roda no Railway; o comentário do código está certo. Diverge só do texto do spec (já anotado nas Implementation Notes) |
| Spec diz `resetDatabase` e "numa transação"; bloco congelado contradiz as notas | rejeitado | n/a | a correção seria editar o spec; as Implementation Notes já registram a divergência |
| Trava fraca: depois de mostrar o host o comando segue sem pausa (sugere `--confirmo=<banco>` ou prompt) | maybe-false | rejeitado | a trava `--confirmo` é decisão registrada no bloco congelado; mudar o formato é mudar a intenção. Levado ao Felipe como observação |
| Nome de tabela com aspas, `replaceAll` | low | rejeitado | só tabelas criadas pelo Prisma; correção sem dano real. Fica embutida no quoting ao qualificar o schema |
| `maskDatabaseHost` com senha com `@`, `#`, socket, multi-host | low | rejeitado | `new URL` já devolve o host certo com `@` na senha (conferido); casos restantes caem no "host ilegível" que agora aborta |
| Limpeza pós-falha pode apagar um seed legítimo de outro processo | low | rejeitado | exige seed concorrente e falha ao mesmo tempo; sem custo real |
| Sem backup nem trilha de auditoria do reset | low | rejeitado | fora da intenção; a trilha é o `progresso.md`. Backup anotado como cuidado para a produção |
| `progresso.md` fora do diff | false | n/a | foi excluído por mim do diff; a alteração existe e vai no commit do fechamento |
| Falta runbook da produção no README | maybe-false | adiado ao passo operacional | a forma de chegar ao banco do Railway ainda não foi decidida com o Felipe |

## Design Notes

A execução em produção não faz parte do código: é um passo operacional à parte, só com OK do Felipe. O Postgres do Railway é privado (`postgres.railway.internal`), então a execução será dentro do serviço da API (`railway ssh`/`railway run` no contexto do serviço) ou pela URL pública do banco, a combinar na hora. O CLI `railway` 5.71.0 está instalado.

## Verification

**Commands:**
- `npm run typecheck && npm run lint` -- expected: sem erros
- `npm test -w apps/api -- reset` -- expected: verde, com `DATABASE_URL_TEST` apontando para o banco descartável
- `npm run seed:reset` (sem flag) -- expected: recusa e sai com código ≠ 0
