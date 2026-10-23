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

## Próximos passos

- [x] `bmad-ux`: gerar `DESIGN.md` e `EXPERIENCE.md` a partir do design (aceitos como draft)
- [x] `bmad-architecture`: fixar as decisões técnicas (spine em `planning-artifacts/architecture/`, draft)
- [x] `bmad-spec`: SPEC + 10 fatias (substitui épicos e sprint planning)
- [ ] `bmad-build`: implementar uma fatia por vez, em contexto novo, da S00 à S09 (deploy mínimo já na S00)

### Onde parei na S00 (retomar daqui)

Feito e no GitHub (`main`, CI verde): monorepo, shared, API, web com tema e página diagnóstica, Prisma `0_init`, `.env.example`, Compose, lint, CI, README esqueleto.

Falta, nesta ordem:

1. **Deploy mínimo** (depende do Felipe): Neon (copiar as strings pooled e direta direto para o painel do Render), Render (Web Service com build/start do README, variáveis incluindo `WEB_ORIGIN`), Vercel (Root Directory `apps/web`, `NEXT_PUBLIC_API_URL`), depois trocar `WEB_ORIGIN` no Render pela URL da Vercel. As instruções passo a passo estão na conversa e resumidas no README (seções "Deploy"). Ao confirmar, testar AC-0.8 nos links públicos e registrar as URLs no README.
2. **Verificações pendentes do dia 1:** (c) o Render gratuito executa o start com `migrate deploy`; (d) CORS e WebSocket entre Vercel e Render.
3. **Primitivos de UI restantes** (já existem: Button, SkipLink, Logo, ThemeSwitch, PageShell, FeedbackState): Field, RefusalMessage, DataTable, FilterTabs, Dialog, IdentityChip. "Se sobrar tempo": Stamp, LotTag, Perforation.
4. **Página `/kit`** (só fora de produção, `notFound()` em produção) com os primitivos nos dois temas.
5. **Fechamento:** preencher no AGENTS.md os comandos verificados e as versões (hoje ainda "a definir na S00"), rodar o checklist da Definition of Done da S00 e registrar a saída dos comandos.

Lembretes: o banco do Compose usa a porta 5433 (a 5432 está ocupada por outro projeto); 3000/4000 também estão ocupadas na máquina, use `WEB_PORT`/`PORT` para testar. Perguntas abertas da S00: textos "Banco: fora do ar" e "Banco: não verificado" na página diagnóstica não constam na SPEC.

## Registro de uso de IA

- PRD e pesquisa de APIs: Claude, com revisão e ajustes de Felipe
- Design: Claude Design
- Planejamento e implementação: BMad com Claude Code
