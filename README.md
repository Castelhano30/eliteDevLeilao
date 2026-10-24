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

### Contas de teste

`npm run seed` cria as três contas abaixo pelos mesmos services da API (confere cada uma pelo e-mail e cria só as que faltam). Senha de todas: `lance1234`.

| Papel | E-mail | Saldo |
|---|---|---|
| Leiloeiro | leiloeiro@lanceauto.test | — |
| Licitante | ana@lanceauto.test | R$ 500.000,00 |
| Licitante | bruno@lanceauto.test | R$ 300.000,00 |

### Lotes de demonstração

O mesmo `npm run seed` cria dois lotes do leiloeiro, **sem rede**, a partir de [apps/api/prisma/fipe-fixture.json](apps/api/prisma/fipe-fixture.json) e pelo mesmo serviço de criação da API (com genesis e selo válidos): um **ao vivo** (Fiat Uno Mille Way 2010, aberto há 1 h, fecha em 30 dias) e um **agendado** (Toyota Corolla XEi 2015, abre em 2 dias). Só cria se o banco ainda não tiver lote nenhum, então é seguro a cada deploy. `npm run seed:demo` cria mais um lote ao vivo de 30 dias com datas relativas a agora. O seed também dá **5 lances alternados** no lote ao vivo (Bruno, Ana, Bruno, Ana, Bruno, cada um no mínimo corrente), pelo mesmo `placeBid` da API, então a cadeia de hashes nasce válida e o Bruno termina liderando. Essa parte roda em todo deploy e só age se o lote ao vivo ainda não tiver lance, o que a faz alcançar um banco já populado sem repetir. Esses lotes são provisórios: o seed final (lotes 001 a 005, um em cada estado) chega no polimento.

As fotos do seed usam a ilustração padrão do pátio (`image: null` no fixture); para usar uma foto, coloque o arquivo em `apps/api/prisma/seed-images/` e aponte `image`, `imageCredit` e `imageCreditUrl` no fixture.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | shared (watch), API e web em modo desenvolvimento |
| `npm run build` | build na ordem shared, api, web |
| `npm run lint` | ESLint |
| `npm run typecheck` | compila o shared e checa os tipos dos três pacotes |
| `npm test` | compila o shared e roda os testes (a API usa `DATABASE_URL_TEST`) |
| `npm run seed` / `npm run seed:demo` | contas de teste e lotes de demonstração (ver acima) |

## Lances

Cada lance é uma única transação no Postgres: o lote é travado (`FOR UPDATE`) e só depois as carteiras, em ordem de `userId`, o que evita deadlock entre lances cruzados. O relógio é lido depois do lock, o saldo vem da própria query que trava, e os eventos (`bid:placed`, `showcase:lot`, `wallet:updated`) só são entregues depois do commit.

**Ordem de validação** (a do PRD): lote cancelado, ainda não aberto, encerrado, valor abaixo do mínimo, líder reenviando, papel, saldo. A API devolve o primeiro código que falhar.

Consequência dessa ordem: o líder que reenvia um valor **abaixo** do mínimo recebe `BELOW_MINIMUM`, não `ALREADY_WINNING`. Para não dizer ao próprio líder que "alguém levantou a mão antes de você", o erro leva `details.reason = "OWN_LEAD"` e uma mensagem própria ("Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ X"). Os outros motivos são `OUTDATED` (o lance que a tela viu já não é o atual) e `MINIMUM`. Reenviar um valor suficiente cai em `ALREADY_WINNING`, e o leiloeiro só recebe `ROLE_NOT_ALLOWED` quando o lance passaria nas checagens anteriores.

**Prorrogação:** lance feito quando faltam 2 minutos ou menos (inclusive) leva o fim a *hora do lance + 2 min*, sem teto de prorrogações. O `originalEndsAt` nunca muda; a Sala mostra o selo "+2 MIN" quando `endsAt > originalEndsAt`.

**Saldo:** quem lidera tem o valor do lance atual comprometido; ao ser superado, o valor volta ao disponível na mesma transação do lance que o superou. O total só muda na liquidação (S05). O extrato registra `HOLD` e `RELEASE` com o número do lote.

**Privacidade e cadeia:** o histórico mostra um pseudônimo por lote ("Licitante 7F3A", 4 hex de um HMAC de usuário e lote), então a mesma pessoa aparece com nomes diferentes em lotes diferentes. Com 4 hex a colisão entre dois licitantes do mesmo lote é possível (1 em 65.536 por par) e foi aceita: o pseudônimo é só rótulo, o lance sempre pertence ao `userId` gravado. Nenhuma resposta pública leva `userId`, nome ou e-mail. Cada lance entra na cadeia HMAC-SHA256 do lote (`prevHash` e `hash`) e a tabela `Bid` recusa `UPDATE` e `DELETE` por trigger.

**Tempo real:** nesta versão a Sala **não** atualiza sozinha. Quem dá o lance vê o resultado na hora; os outros navegadores só veem o lance ao recarregar. O tempo real (Socket.IO) chega na S04: o serviço já produz os eventos, falta trocar o `Publisher`.

## Catálogo: Tabela FIPE e Wikipedia

Só o back-end fala com as APIs externas, e só em duas situações: as rotas `/catalog/*` (selects do Criar lote) e a criação do lote (`POST /lots`, que busca de novo o detalhe do carro na FIPE em vez de confiar no navegador). Vitrine, Sala, Painel e imagens leem só o banco: com a FIPE e a Wikipedia fora do ar, só o Criar lote mostra o aviso "A tabela FIPE não respondeu.", e nada do que foi digitado se perde.

- **FIPE** ([parallelum v2](https://fipe.parallelum.com.br/api/v2), `FIPE_BASE_URL`): sem token, a cota observada é de **500 requisições por dia** (cabeçalho `x-ratelimit-limit`; um `FIPE_TOKEN` opcional aumenta). Por isso: cache em memória de 24 h por URL (até 500 entradas), uma única requisição para chamadas simultâneas, timeout de 4 s com uma repetição só em falha de rede ou 5xx, e **429 nunca repete**. Se a FIPE falha e há entrada vencida, ela é servida (com log de aviso); falha nunca entra no cache.
- **O cache vive na memória do processo**: zera a cada reinício ou deploy da API, e a primeira consulta volta a gastar cota.
- **Wikipedia** (`WIKIPEDIA_BASE_URL`, resumo `page/summary` em português, com `WIKI_USER_AGENT`): a foto sugerida sai do artigo "{marca} {modelo}" (ou só do modelo, se o resumo falar de carro), em miniatura de 1280 px. O resumo não traz autor nem licença do arquivo; o crédito sugerido é "Foto: Wikipedia, artigo … (licença Creative Commons, veja a página do artigo)" com link para o artigo. Se o leiloeiro troca a URL, o crédito da Wikipedia é apagado.
- **A imagem é baixada na criação do lote** e guardada no banco (`GET /items/:id/image`); depois disso nenhuma tela depende da Wikipedia. O download só aceita http/https nas portas 80/443, recusa endereços privados e de nuvem (inclusive por DNS e redirecionamento), para em 4 MB e aceita só JPEG, PNG, WebP e GIF. Falhou, o lote nasce com a ilustração padrão.

## Deploy

Tudo roda no Railway, num só projeto e num só ambiente, com três serviços: Postgres, `@lanceauto/api` e `@lanceauto/web`.

Links públicos:

- Web: https://lanceautoweb-production.up.railway.app
- API: https://lanceautoapi-production.up.railway.app (teste em `/health`)
- Banco: Postgres do Railway, sem link público (a API o acessa pela rede privada, `postgres.railway.internal`)

### Configuração dos serviços

Build e start ficam gravados no próprio serviço do Railway (painel, campos Custom Build Command e Custom Start Command), com os valores abaixo. O Railway descontinuou a configuração por arquivo ("Config as Code"), então os [apps/api/railway.json](apps/api/railway.json) e [apps/web/railway.json](apps/web/railway.json) não são lidos: servem só de registro dos mesmos comandos e precisam ser mantidos iguais ao painel.

**API**

- Build: `npx prisma generate --schema apps/api/prisma/schema.prisma && npm run build -w packages/shared && npm run build -w apps/api`
- Start: `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && (npx tsx apps/api/prisma/seed.ts || echo seed-falhou-subindo-sem-ele) && node apps/api/dist/server.js`
- Health check: `/health`
- Porta pública: 8080 (o Railway injeta `PORT=8080`)

Migrações novas são aplicadas sozinhas a cada start. O seed também roda no start: cria só as contas que faltam e os lotes de demonstração só se ainda não houver lote, então é seguro a cada deploy; uma falha nele não derruba a API.

**Web**

- Build: `npm run build -w packages/shared && npm run build -w apps/web`
- Start: `npm run start -w apps/web`
- Porta pública: 8080

### Variáveis por serviço

Os valores ficam só no painel do Railway, nunca no repositório. Os nomes estão comentados em [.env.example](.env.example).

| Serviço | Variáveis |
|---|---|
| Postgres | as do próprio Railway |
| API | `DATABASE_URL` e `DIRECT_URL` (iguais, sem pooler), `JWT_SECRET`, `AUDIT_HMAC_KEY`, `WEB_ORIGIN`, `AUTH_RATE_LIMIT_MAX`, `FIPE_BASE_URL`, `FIPE_TOKEN` (opcional), `WIKI_USER_AGENT`, `WIKIPEDIA_BASE_URL` |
| Web | `NEXT_PUBLIC_API_URL` |

- `NEXT_PUBLIC_API_URL` é embutida no build do web: `https`, sem barra no final; se mudar, refaça o deploy do web.
- `WEB_ORIGIN` é a URL exata do web, com `https` e sem barra no final.
- O web só precisa de `NEXT_PUBLIC_API_URL`; banco e segredos ficam só na API.

### Ordem de criação

1. Postgres.
2. API, com banco e segredos; domínio público na porta 8080.
3. Web, com `NEXT_PUBLIC_API_URL` apontando para o domínio da API; domínio público na porta 8080.
4. De volta à API: `WEB_ORIGIN` com o domínio do web.

## Variáveis de ambiente

Todas estão comentadas em [.env.example](.env.example). O `.env` nunca é versionado.
