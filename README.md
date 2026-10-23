# LanceAuto

Casa de leilões online de carros: leiloeiros montam lotes a partir de carros da tabela FIPE, licitantes com saldo simulado disputam cada lote com lances ao vivo, o vencedor recebe um comprovante compartilhável e qualquer pessoa pode auditar o histórico de um lote. Teste técnico Elite Dev (Verzel).

> Este README é o esqueleto da fundação (S00). As seções de regras, auditoria e usuários de teste entram nas fatias seguintes.

## Stack

- Web: Next.js (App Router), React, TypeScript, Tailwind, TanStack Query, Socket.IO client
- API: Node, Express, Socket.IO, Prisma, zod
- Banco: PostgreSQL
- Monorepo com npm workspaces: `apps/web`, `apps/api`, `packages/shared`
- Testes: Vitest

## Como rodar

Pré-requisitos: Node 22.12 ou superior (testado no 24), npm e Docker.

### Com Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000 (mude com `WEB_PORT`)
- API: http://localhost:4000, teste em `/health` (muda com `PORT`)
- Postgres: `localhost:5433`

### Sem Docker para a aplicação

```bash
cp .env.example .env
docker compose up -d db        # só o banco
npm ci
npm run build -w packages/shared
npm run prisma:generate -w apps/api
npm run migrate:deploy -w apps/api
npm run dev                    # shared em watch, API e web
```

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | shared (watch), API e web em modo desenvolvimento |
| `npm run build` | build na ordem shared, api, web |
| `npm run lint` | ESLint |
| `npm run typecheck` | compila o shared e checa os tipos dos três pacotes |
| `npm test` | compila o shared e roda os testes (a API usa `DATABASE_URL_TEST`) |

## Deploy

| Parte | Host | Configuração |
|---|---|---|
| Web | Vercel | Root Directory `apps/web` |
| API | Render | build e start na seção abaixo |
| Banco | Neon | `DATABASE_URL` pooled, `DIRECT_URL` direta |

Links públicos:

- Web: https://elite-dev-leilao.vercel.app/
- API: https://elitedevleilao.onrender.com (teste em `/health`)
- Banco: Neon (sem link público)

No plano gratuito do Render a API hiberna: a primeira chamada depois de um tempo parado pode levar cerca de 50 s.

### API no Render

- Build: `npm ci --include=dev && npm run build -w packages/shared -w apps/api && npx prisma generate --schema apps/api/prisma/schema.prisma`
- Start: `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/server.js`
- Health check: `/health`

### Web na Vercel

- Root Directory: `apps/web`
- Install: `cd ../.. && npm ci`
- Build: `cd ../.. && npm run build -w packages/shared && npm run build -w apps/web`
- Variável: `NEXT_PUBLIC_API_URL` com o endereço público da API

## Variáveis de ambiente

Todas estão comentadas em [.env.example](.env.example). O `.env` nunca é versionado.
