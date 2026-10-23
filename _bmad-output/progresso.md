# Diário de progresso — Casa de Leilões (Verzel)

Registro passo a passo do que foi feito, decidido e do que vem a seguir. Serve também de base para o relato de uso de IA exigido na entrega.

## Convenções de trabalho

- **Commits atômicos:** uma mudança lógica por commit.
- **Mensagens:** em português, claras, enxutas, objetivas e com tom humano.
- **Repositório:** monorepo (front e back juntos).
- **Stack:** React com Next.js, Node.js com Express, Socket.IO, PostgreSQL com Prisma.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Prorrogação | Novo fim = horário do lance + 2 minutos |
| Posição do usuário | Colocação do maior lance de cada licitante |
| Cancelamento com lances | Fazer, com estorno automático |
| Edição de lote agendado | Não fazer |
| Limite por depósito | R$ 10 milhões |
| Imagem dos lotes | Wikipedia, editável, com ilustração padrão |

## Passo a passo

### 22/10/2026

1. **Ponto de partida.** Rodado o `bmad-help` para mapear o fluxo: PRD, UX, arquitetura, épicos, sprint e build.
2. **Design importado.** Baixados 29 arquivos do Claude Design para `planning-artifacts/design/project/` (9 telas, com variações claro, noite e celular).
3. **PRD reconciliado.** Havia duas versões: o PDF antigo (marketplace) e o `.md` novo (Casa de Leilões, teste Verzel). O `.md` é a fonte única e bate com o design.
4. **Stack definida.** Next.js no front e Express no back, registrada no PRD.
5. **Decisões em aberto fechadas** e monorepo adotado (tabela acima).
6. **Git e GitHub.** Repositório iniciado na `main` e publicado (privado, por enquanto) em `Castelhano30/eliteDevLeilao`. Só o `_bmad-output` vai para o git. Envio com `git push` ao fim de cada etapa, e commits sempre só no nome do autor.

7. **UX gerado.** `DESIGN.md` e `EXPERIENCE.md` escritos a partir do design e do PRD, com as 40 perguntas abertas (P1 a P40) triadas por recomendação. Divergências entre design e PRD resolvidas a favor do PRD (pseudônimo por lote, cancelamento com estorno, auditoria HMAC-SHA256). Aceitos como `draft` para ganhar agilidade, sem o Reviewer Gate.

8. **Arquitetura gerada.** Spine com 13 decisões (AD-1 a AD-13), contratos REST e Socket.IO, formato da cadeia HMAC v1 e ledger. Sem Reviewer Gate, por agilidade; versões de libs e hosts (Vercel, Render, Neon) ainda a confirmar no dia 1.

9. **SPEC gerada.** `_bmad-output/specs/spec-lanceauto/`: `SPEC.md` curto, `rastreabilidade.md` (131 requisitos do PRD, nenhum órfão) e 10 fatias autossuficientes (S00 a S09). Conflitos entre PRD, UX e arquitetura resolvidos pela precedência; 10 perguntas abertas com sugestão no fim do SPEC.md. Épicos e sprint planning dispensados: a fatia é a unidade de build.

10. **SPEC revisada.** Cinco revisores independentes leram as dez fatias contra o PRD e a arquitetura e acharam cerca de 80 pontos. Entre os mais graves: consulta SQL da S07 que falharia no Postgres, token do comprovante exposto na auditoria pública, seed que violava a regra de datas, SSRF incompleto no download de imagem, eventos de fechamento sem dono e `version`/`entryCount` com dois nomes. Tudo corrigido nas fatias; as decisões que valem para o projeto inteiro (T1 a T13) ficaram no `SPEC.md`. Premissas externas (FIPE v2, Wikipedia, versões, release do Render) ficam para verificar no dia 1.

### 23/10/2026 — S00 Fundação

11. **Ambiente e versões verificados (T13).** Node 24.14.1, npm 11.11.0, Git 2.53, Docker 29.5.3. Versões fixadas (lockfile manda): Next 16.4.2, React 19.3.1, Express 5.3.0, Socket.IO 4.8.4, zod 4.6.7, TanStack Query 5.104.5, Tailwind 4.3.3, Vitest 5.0.5, ESLint 9.39.5, helmet 8.3.0, express-rate-limit 8.7.1, pino 10.4.0. Duas escolhas fora do "mais novo": **Prisma 6.19.3** (o 8 ainda é RC e o 7 tira `url`/`directUrl` do `schema.prisma`, que a SPEC exige) e **TypeScript 5.9.3** (o 7 passa do limite do typescript-eslint, `<6.1`).
12. **Verificações do dia 1 resolvidas.** (a) `next/font/google`: a fonte "Big Shoulders Display" não existe mais, virou "Big Shoulders" (variável, eixo `opsz`); Newsreader com `opsz` exige `axes: ['opsz']` e **sem** `weight`. (b) `prisma migrate deploy` com a migração `0_init` vazia roda sem erro (local e no Compose). (d) CORS e WebSocket entre Vercel e Render e (c) release do Render: pendentes do deploy.
13. **Monorepo, shared e API.** Workspaces `apps/web`, `apps/api`, `packages/shared` (compilado para `dist`, CommonJS). API com `/health`, envelope de erro, `makeRateLimiter`, `FakeClock`, `NoopPublisher`, Socket.IO no mesmo servidor e `env.ts` que falha no boot. 19 testes na API e 7 no shared, todos verdes, com Postgres real em `DATABASE_URL_TEST`.
14. **Web e tema.** Next com tokens dos dois temas, tipografia, movimento e foco em `globals.css`, script de tema antes da pintura (testado), cliente da API que nunca lança, socket singleton e página diagnóstica.
15. **Compose, lint e CI.** `docker compose up --build` sobe db, api e web (migração `0_init` aplicada no start). ESLint com a regra de `Date` só na API. CI no GitHub verde com Postgres de serviço.
16. **Imprevistos locais.** As portas 5432, 3000 e 4000 estavam ocupadas por outros projetos da máquina: o banco do Compose ficou na **5433** e o web aceita `WEB_PORT`. Um `Set-Content` do PowerShell 5.1 gravou BOM e corrompeu acentos em três arquivos; corrigido e `.gitattributes` adicionado.
17. **Em pausa: deploy mínimo** (Neon, Render, Vercel) depende de ações do Felipe nos painéis.

18. **Deploy verificado (23/10/2026).** Web https://elite-dev-leilao.vercel.app/ (200), API https://elitedevleilao.onrender.com. `GET /health` → `200 {"ok":true,"db":true}` em 1,3 s (API já acordada). CORS: a resposta traz `access-control-allow-origin: https://elite-dev-leilao.vercel.app` (só a origem configurada em `WEB_ORIGIN`). (d) WebSocket: cliente Socket.IO em Node, com `Origin` da Vercel e só transporte `websocket`, conectou na API do Render; o bundle do web aponta para a URL da API. (c) O Render só responde `db:true` com a `DATABASE_URL` do Neon válida; os logs do start (`migrate deploy`) ficam no painel e eu não tenho acesso a eles: **(c) fica "indiretamente confirmado" até o Felipe olhar o log do deploy**. AC-0.8 (página mostrando "API: ok · Banco: ok · Socket: conectado" no navegador): meu Chrome headless só capturou "Consultando…" (a captura sai antes da resposta), então **falta o Felipe confirmar a olho** abrindo a URL. URLs registradas no README, sem string de conexão.
19. **Primitivos e `/kit`.** Criados Field, RefusalMessage, DataTable, FilterTabs, Dialog (sobre `<dialog>` nativo), IdentityChip e, como sobrou tempo, Stamp, LotTag e Perforation. `/kit` mostra todos; conferido por captura nos dois temas. `next build` + `next start`: `/kit` responde 404 em produção (AC-0.14). 8 testes novos dos primitivos (renderização em servidor, sem DOM); o Vitest do web passou a incluir `.tsx` e usa `oxc.jsx` (o Vitest 5 não usa mais `esbuild`).
20. **Fechamento da S00.** AGENTS.md com comandos e versões reais. Saída dos comandos na máquina (banco do Compose na 5433): `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` → shared 7/7, api 19/19, web 15/15; `npm run build` exit 0 (shared → api → web; `/kit` prerenderizado como 404 em produção; sem `transpilePackages`). Pendências para a DoD fechar: Felipe confirmar AC-0.8 a olho e o log do `migrate deploy` no Render; checklist [manual] de a11y (AC-0.9 a 0.13: tema sem flash, teclado, reduced-motion, 320px/zoom 200%) ainda não foi feito por pessoa; CI no GitHub a olhar após o push.

## Próximos passos

- [x] `bmad-ux`: gerar `DESIGN.md` e `EXPERIENCE.md` a partir do design (aceitos como draft)
- [x] `bmad-architecture`: fixar as decisões técnicas (spine em `planning-artifacts/architecture/`, draft)
- [x] `bmad-spec`: SPEC + 10 fatias (substitui épicos e sprint planning)
- [ ] `bmad-build`: implementar uma fatia por vez, em contexto novo, da S00 à S09 (deploy mínimo já na S00)

21. **Conferência manual (relato do Felipe, 23/10/2026).** Felipe rodou as partes manuais: AC-0.8 na URL pública, log do `migrate deploy` no Render (verificação c) e checklist AC-0.9 a 0.13 no `/kit`. S00 fechada; próxima fatia: S01.

### Onde parei

S00 concluída (itens 18 a 21). Próximo passo: `bmad-build` da S01 (Auth, carteira e primeira migração), em contexto novo.

## Registro de uso de IA

- PRD e pesquisa de APIs: Claude, com revisão e ajustes de Felipe
- Design: Claude Design
- Planejamento e implementação: BMad com Claude Code
