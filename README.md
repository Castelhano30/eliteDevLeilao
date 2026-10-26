# LanceAuto

Casa de leilões online de carros: leiloeiros montam lotes a partir de carros da tabela FIPE, licitantes com saldo simulado disputam cada lote com lances ao vivo, o vencedor recebe um comprovante compartilhável e qualquer pessoa pode auditar o histórico de um lote. Teste técnico Elite Dev (Verzel).

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

- Web: http://localhost:3000 (mude com `WEB_PORT` e ajuste `WEB_ORIGIN` no `.env` para a mesma porta, senão o CORS recusa a API)
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

**Saldo:** quem lidera tem o valor do lance atual comprometido; ao ser superado, o valor volta ao disponível na mesma transação do lance que o superou. O total só muda na liquidação (ver Fechamento e comprovante). O extrato registra `HOLD` e `RELEASE` com o número do lote e, no arremate, `Arremate · lote NNN`.

**Privacidade e cadeia:** o histórico mostra um pseudônimo por lote ("Licitante 7F3A", 4 hex de um HMAC de usuário e lote), então a mesma pessoa aparece com nomes diferentes em lotes diferentes. Com 4 hex a colisão entre dois licitantes do mesmo lote é possível (1 em 65.536 por par) e foi aceita: o pseudônimo é só rótulo, o lance sempre pertence ao `userId` gravado. Nenhuma resposta pública leva `userId`, nome ou e-mail. Cada lance entra na cadeia HMAC-SHA256 do lote (`prevHash` e `hash`) e a tabela `Bid` recusa `UPDATE` e `DELETE` por trigger.

**Tempo real (Socket.IO):** lance, prorrogação, saldo e cartão da Vitrine chegam sem recarregar. Quem muda o dado é sempre uma rota REST: o service devolve os eventos, a rota os entrega ao `Publisher` **depois do commit**, e um evento nunca sai de uma recusa. Falha ao publicar é logada e não derruba a requisição já confirmada.

- **Salas:** `lot:{id}` (a Sala do lote; o cliente entra com `lot:join`, que responde o snapshot, e sai com `lot:leave`), `showcase` (Vitrine e Painel; `showcase:join`) e `user:{id}` (só o servidor atribui, a partir do JWT do handshake; o cliente não consegue pedir). Token ausente, inválido ou vencido conecta como visitante.
- **Eventos:** `bid:placed` (leva `version`, `minimumBidCents`, `endsAt` e `extended`), `showcase:lot` (o cartão do lote), `wallet:updated` (só o novo líder e o líder anterior, ou o dono no depósito). Todo payload leva `serverTime`, carimbado pelo `Publisher`; nenhum leva `userId`, nome ou e-mail.
- **Uma só regra de ordem:** o cliente aplica `bid:placed` se `version == atual + 1`, descarta se `<= atual` e, se houve salto, refaz o `GET /lots/:id`. O mesmo reducer trata a resposta do próprio lance, então a linha não duplica.
- **Queda e volta:** o servidor detecta a queda em até ~20 s (`pingInterval` e `pingTimeout` de 10 s). Com o socket fora, a Sala mostra "Sem sinal com o pátio. Tentando reconectar.", trava o botão de lance e mantém o valor digitado. Ao voltar, entra de novo na sala, refaz o `GET` e só então libera o botão. Nada é reenviado sozinho: lance com resposta ambígua pede conferir o histórico.
- **Sem WebSocket não há bloqueio eterno:** na primeira conexão o aviso aparece depois de 3 s e, passados 10 s, o botão de lance é liberado; o servidor valida tudo (`expectedCurrentCents`), então dar lance não depende do socket.
- **Relógio:** o cronômetro usa o relógio do servidor (`offset` da resposta HTTP de menor latência). Evento do socket não mexe no `offset`.
- **Fora desta versão:** replay de eventos perdidos (a reconciliação é um snapshot) e mais de uma instância da API (sem adapter Redis).

## Fechamento e comprovante

Quando o relógio chega ao fim, o lote fecha sozinho. Uma rotina na API (`settlement-job`) varre os lotes vencidos no boot e depois a cada 5 s, e cada lote é liquidado numa transação própria: o lote é travado (`FOR UPDATE SKIP LOCKED`), `settledAt` é relido sob o lock, as carteiras são travadas em ordem de `userId`, o vencedor é debitado (total e comprometido), o leiloeiro é creditado e o `Receipt` nasce com um token aleatório de 24 bytes. A garantia de liquidar uma única vez é a releitura sob o lock, com `Receipt.lotId UNIQUE` como rede de segurança. Sem lances, só `settledAt` é preenchido. Um `GET` nunca liquida; entre `endsAt` e a liquidação o status é `CLOSING` e a tela mostra "Martelo batido. Apurando o resultado…". Falha em um lote é logada e o ciclo segue para o próximo; ele é tentado de novo no ciclo seguinte.

- **`endsAt` × `settledAt`:** o martelo mostrado (Sala e comprovante) é sempre o `endsAt`, já com as prorrogações. `settledAt` é só quando a rotina liquidou e pode ser bem depois (a API ficou parada, ou um deploy atravessou o fim do lote): a varredura do boot liquida o que venceu enquanto ela estava fora, e é por isso que o lote que já estava vencido numa base antiga é liquidado na primeira subida depois do deploy da rotina.
- **Comprovante** (`/c/{token}`, público e sem login): recibo com lote, carro, valor, martelo com segundos, pseudônimo daquele lote e o HMAC-SHA256 final da cadeia (a liquidação não escreve na cadeia, então é o mesmo `lastHash` do lote). Nenhuma resposta traz nome, e-mail ou `userId`. O token só aparece para o vencedor logado (`myReceiptToken` em `GET /lots/:id`) e na própria URL; nenhum evento nem lista pública o carrega. A página é renderizada no servidor com timeout de 8 s e `noindex`; se a API não responder, o cliente tenta de novo, e só um 404 da API vira "Comprovante não encontrado".
- **Quem venceu** é decidido pelo servidor (`myReceiptToken`), nunca comparando pseudônimos no navegador.
- **Seed:** além do lote ao vivo e do agendado, `npm run seed` cria, pelos mesmos services e com relógio simulado, um lote **arrematado** pela Ana (4 lances, o último a menos de 2 minutos do fim, então prorrogado) e um **encerrado sem lances**, e imprime o link do comprovante de demonstração (`Comprovante de demonstração: /c/…`). Entre como Ana, abra o lote arrematado na Vitrine e use "Ver comprovante".
- **Vitrine apurando:** um cartão cujo fim passou e que o servidor ainda não encerrou fica em "Ao vivo" com "Apurando o resultado…"; a lista é refeita a cada 3 s, com teto de 20 respostas, e o `showcase:lot` do fechamento o move para "Encerrados" e zera a conta.

## Cancelamento com estorno e linha CANCEL na auditoria

O leiloeiro dono cancela qualquer lote seu **agendado ou ao vivo, com ou sem lances** (`POST /lots/:id/cancel`, corpo `{ "confirmEntryCount": N }`). Não existe editar nem reabrir: depois de agendado só existe "Cancelar". Tudo acontece numa transação: o lote é travado (`FOR UPDATE`), o `now` é lido depois do lock, e na ordem da fatia a API confere dono, se já foi cancelado (`LOT_CANCELLED`), se o fim já passou ou o lote já liquidou (`LOT_ENDED`) e a contagem. Se havia líder, a carteira dele é travada e o comprometido do lance atual volta ao disponível (`REFUND` no extrato, o total não muda); só o líder atual tem saldo comprometido no lote, quem foi superado já foi liberado por `RELEASE`.

- **Linha CANCEL na cadeia:** o cancelamento entra como linha própria do histórico (`kind=CANCEL`, `seq = entryCount + 1`, sem autor, pseudônimo nem valor), com hash `HMAC(chave, "v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}")`, e o selo passa a contar essa linha. É gravada **sempre**, com ou sem lances, e conta no veredito da auditoria. A Sala nunca a mostra (`bids[]` é só `BID`); a página de Auditoria a exibe como "Cancelado pelo leiloeiro".
- **Corrida do diálogo (`confirmEntryCount`):** o diálogo mostra "Cancelar o lote 019 com 2 lances?" e envia essa contagem. Se entrou lance enquanto o leiloeiro decidia, o servidor responde `LOT_CHANGED` com a contagem real e **nada muda**; o mesmo diálogo se atualiza e pede a confirmação de novo, e o estorno vai para o líder novo. Cancelar × lance serializam pelo lock do lote: ou o lance entra antes (e o cancelamento recebe `LOT_CHANGED`) ou o cancelamento entra antes (e o lance recebe `LOT_CANCELLED`, sem `HOLD`). Nunca sobra saldo comprometido em lote cancelado.
- **O que cada tela vê:** o lote some da Vitrine por `showcase:lot` (nunca vem em `GET /lots`); a Sala continua respondendo pela URL e vira "Cancelado" sem recarregar, sem formulário; o chip e a Carteira de quem liderava voltam ao disponível por `wallet:updated`; no Painel a linha só muda para "Cancelados" quando o servidor confirma (sem atualização otimista), com o estorno e o horário. O job de fechamento nunca liquida lote cancelado.
- **Rede ambígua:** se a resposta do cancelamento se perde, o diálogo não reenvia sozinho; ao tentar de novo ele primeiro refaz `GET /my/lots` e, se o lote já está cancelado, trata como sucesso.
- **Seed:** `npm run seed` cria, pelos mesmos services e com relógio simulado, um lote ao vivo "cancelado de demonstração" (dois lances e cancelamento com `confirmEntryCount = 2`, estorno ao líder, linha CANCEL `seq = 3`). O comprometido de cada carteira continua igual à soma dos lances dos lotes ao vivo que ela lidera.

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

**Tempo real no Railway:** a API é uma instância só e não hiberna, então não há cold start de socket. Um deploy da API reinicia o processo e derruba os sockets; os navegadores reconectam sozinhos (atraso de 1 s crescendo até 5 s), entram de novo nas salas e refazem o `GET`, e a Sala mostra "De volta ao pátio" por 4 s. O Railway repassa WebSocket pelo mesmo domínio público da API.

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
