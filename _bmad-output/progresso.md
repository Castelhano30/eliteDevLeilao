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

22. **Migração do deploy para o Railway (23/10/2026).** Render + Vercel + Neon saíram; API, web e Postgres ficaram no mesmo projeto do Railway. Motivo: o plano gratuito do Render hiberna e leva cerca de 50 s para acordar, o que atrapalha o Socket.IO e quem abre o link frio. Render, Vercel e Neon foram apagados. Verificado no ar: web https://lanceautoweb-production.up.railway.app e API https://lanceautoapi-production.up.railway.app (`/health` com `ok:true, db:true`; CORS e socket conferidos pelo navegador). Configuração (sem valores): três serviços no mesmo ambiente; cada um lê `apps/api/railway.json` e `apps/web/railway.json` pelo "Config file path", com Build/Start Command do painel vazios; porta 8080 nos dois domínios; o start da API roda `prisma migrate deploy` antes do servidor; `DATABASE_URL` e `DIRECT_URL` iguais, sem pooler, pela rede privada; variáveis só no painel.
23. **Imprevistos da migração.** (a) O Railpack ignorou o Custom Build Command do painel e rodou o build padrão sem compilar o shared; resolvido com um `railway.json` por serviço. (b) Referências de variável (`${{Postgres.DATABASE_URL}}`) resolveram vazias; funcionou com o valor literal e, depois, `DATABASE_URL = ${{DIRECT_URL}}` corrigiu a conexão de runtime. (c) CORS falhou porque o `WEB_ORIGIN` estava com barra no final. (d) Segredos do Neon e do Render apareceram em print; todos foram rotacionados.
24. **Documentação da migração.** README (seção Deploy) e comentários do `.env.example` reescritos para o Railway, sem valores. S00 e S09 ainda citam Render/Vercel/Neon: anotado em "Perguntas abertas" de cada uma, sem reescrever as fatias. O `apps/web/AGENTS.md` (gerado pelo `next dev`, bloco de regras do Next) ficou fora do git, via `.gitignore`, como a S00 já havia sugerido.

25. **Correção do WEB_ORIGIN (23/10/2026).** `env.ts` descarta barras no final antes de validar; 2 testes novos no `env.test.ts`.
26. **S01 implementada e verificada localmente (23/10/2026).** Migração `contas_e_carteira` (com os 2 CHECKs e `seq` autoincremento), contratos zod em `packages/shared`, JWT HS256, `requireAuth`/`requireRole`/`optionalAuth`, cadastro, login, `/me`, carteira e depósito, socket na sala `user:{id}`, seed pelos services, Acesso, Header por papel, guardas, Carteira. Saída real: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` → shared 26/26, api 62/62 (Postgres real), web 45/45; `npm run build` exit 0. CI do GitHub verde nos pushes. Conferência [manual] pelo Chrome (puppeteer-core, `next dev` + API locais): 28/28 verificações do roteiro (cadastro, depósito de R$ 50 mil, recusa de 10.000.001, aceite de 10.000.000, sair, `/entrar?next=`, login errado, papel errado com aviso, token inválido, `next=//evil.com`, 320px sem rolagem) mais teclado nas abas, foco no primeiro campo inválido e EMAIL_TAKEN. Bugs achados e corrigidos na conferência: o Sair era desfeito pela guarda de rota; link-botão perdia a cor no hover; `dotenv-cli` v11 mudou a sintaxe dos scripts.
27. **Deploy da S01: NÃO confirmado.** O CI está verde, mas os deploys do Railway dos commits da S01 aparecem como falha no GitHub (deployments c324d3b e 833dea0) e a API pública ainda responde 404 em `POST /auth/login` (o `/health` segue ok, com o código antigo). Não tenho acesso aos logs do Railway daqui; a causa não foi investigada e não vou chutá-la. Pendente: logs de build/deploy da API. O smoke público (AC-1.36, cadastro, depósito, logout) fica por fazer.

28. **Diagnóstico do deploy sem os logs (23/10/2026).** Reproduzi localmente o build e o start do `apps/api/railway.json` com `NODE_ENV=production` e um banco vazio: build exit 0, `migrate deploy` aplicou `0_init` e `contas_e_carteira`, o seed criou as 3 contas e `POST /auth/login` com corpo vazio respondeu 400 VALIDATION. Ou seja, o código e os comandos funcionam fora do Railway. O web público já serve `/entrar` (200, build da S01 no ar); a API pública segue com o código antigo (404 em `/auth/login`). Causa da falha do deploy da API: desconhecida até alguém ler o log do Railway.

### Onde parei

S01 implementada e verde localmente e no CI (itens 25 a 26). Bloqueio: deploy da API no Railway falhando (item 27); falta ler os logs, corrigir, rodar o smoke público e fechar a DoD da S01 (checkboxes de migração aplicada, seed em produção e smoke).

## Registro de uso de IA

- PRD e pesquisa de APIs: Claude, com revisão e ajustes de Felipe
- Design: Claude Design
- Planejamento e implementação: BMad com Claude Code
