# LanceAuto

Casa de leilões online de carros: o leiloeiro monta um lote a partir de um carro da tabela FIPE, licitantes com saldo simulado disputam cada lote com lances ao vivo, o vencedor recebe um comprovante compartilhável e qualquer pessoa pode auditar o histórico de um lote. É a minha resposta ao teste técnico **Elite Dev**, da Verzel.

Monorepo com `apps/web` (Next.js), `apps/api` (Express, Socket.IO e PostgreSQL) e `packages/shared` (contratos compartilhados), publicado no Railway. O fluxo está completo de ponta a ponta: cadastrar, depositar, criar lote, dar lance em tempo real, fechar e liquidar, emitir o comprovante, cancelar com estorno e auditar.

Usei IA em boa parte do trabalho, com o Claude Code e o BMad Method. Onde, como e com qual método está em **[USO_DE_IA.md](USO_DE_IA.md)**.

---

## Roteiro de avaliação

**Comece por aqui.** Este é o caminho de ponta a ponta, com as contas já prontas, em uns 10 minutos.

| Se você quer… | Vá para |
|---|---|
| Abrir a aplicação agora, sem instalar nada | **<https://lanceautoweb-production.up.railway.app>** |
| As credenciais dos três papéis | [Contas semeadas](#contas-semeadas-e-dados-de-demonstração) |
| Rodar na sua máquina | [Como executar](#como-executar) |
| Ver o contrato da API | [Documentação da API](#documentação-da-api) |
| Saber onde e como usei IA | [USO_DE_IA.md](USO_DE_IA.md) |

### ⚠️ Antes de começar: três coisas que mudam o resultado

> **1. O link público já foi usado.**
> O roteiro abaixo vale para um banco recém-semeado. Na aplicação publicada, quem lidera cada lote e a numeração dos lotes podem ser outros. Os passos continuam valendo; só os nomes e valores mudam.
>
> **2. Lance não se desfaz.**
> Não existe editar nem apagar lance. O valor do lance atual fica **comprometido** na carteira de quem lidera e só vira débito quando o lote fecha; se alguém cobre, o valor volta ao disponível. Um lance alto de propósito segura o saldo daquela conta até alguém cobri-lo.
>
> **3. O lote do seed demora 30 dias para acabar.**
> Para ver a **prorrogação** e o **fechamento** ao vivo, crie você mesmo um lote curto como leiloeiro: a duração mínima é de **5 minutos**, o início não pode estar mais de 1 minuto no passado, e as datas são digitadas em horário de Brasília. Um lance feito quando faltam 2 minutos ou menos leva o fim a *hora do lance + 2 min*.

### O caminho recomendado, do começo ao fim

Funciona igual [na aplicação publicada](https://lanceautoweb-production.up.railway.app) e na sua máquina.

**1 · Como visitante, sem login**

1. Abra a Vitrine. Ela mostra um lote ao vivo, um agendado e os encerrados (os cancelados nunca aparecem). Ligue o **Tema escuro** no cabeçalho
2. Abra o lote ao vivo e olhe a Sala: relógio, lance atual, histórico com pseudônimos ("Licitante 7F3A") e nenhum jeito de dar lance sem entrar

**2 · Como licitante, em duas janelas**

3. Na tela de acesso, a aba "Entrar" lista as três contas: um toque preenche e-mail e senha. Entre como **Ana** e abra o lote ao vivo (Fiat Uno Mille Way 2010). Ela chega como **"superada"**, porque o Bruno lidera
4. Dê um lance: o campo já vem preenchido com o mínimo, e há atalhos de valor. A Ana passa à frente e, na **Carteira**, o valor do lance aparece como comprometido
5. Em uma **janela anônima**, entre como **Bruno** na mesma Sala. O lance da Ana aparece **sem recarregar**. Cubra o lance: na Carteira da Ana, o valor volta ao disponível

**3 · Como leiloeiro — criar e cancelar**

6. Saia e entre como `leiloeiro@lanceauto.test`. Abra **Criar lote**: escolha marca, modelo e ano na **tabela FIPE**. A foto é sugerida pela Wikipedia e pode ser trocada por uma URL ou por até 5 fotos do aparelho
7. Veja o lote em **Meus lotes** e no **Painel**. Cancele-o: o diálogo mostra quantos lances o lote tem e, se entrou lance enquanto você decidia, pede a confirmação de novo

**4 · Sem login — conferir o resultado**

8. Abra o comprovante do lote arrematado: entre como Ana → **Meus arremates** → "Ver comprovante". O link abre sem login e mostra o recibo com o hash final da cadeia
9. Na Sala, clique em **"Auditar este lote"**. A auditoria deve dizer **"íntegro"**

### Os caminhos que valem a pena provocar

| O quê | Como |
|---|---|
| **Lance abaixo do mínimo** | Digite um valor menor que o mínimo e envie → recusa `BELOW_MINIMUM`, com o motivo na mensagem |
| **Líder reenviando** | Como líder, envie um valor abaixo do mínimo → "Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ X". O servidor não diz ao líder que "alguém levantou a mão" |
| **Saldo insuficiente** | Dê um lance maior que o disponível → recusa com link para a Carteira, onde há depósito de até R$ 10.000.000,00 |
| **Lances simultâneos** | Mande o mesmo valor por dois navegadores ao mesmo tempo → um entra e o outro é recusado, porque a tela dele estava desatualizada. Nunca há dois líderes |
| **Prorrogação** | Num lote curto, dê um lance com 2 minutos ou menos no relógio → o fim anda para *hora do lance + 2 min* e a Sala mostra o selo "+2 MIN" |
| **Cancelamento com estorno** | O lote 003 do seed já está cancelado: o Bruno liderava, então o extrato dele tem o estorno e a auditoria mostra "Cancelado pelo leiloeiro" |
| **Adulteração do histórico** | Altere um lance direto no banco ([como, passo a passo](#anti-adulteração-do-histórico)) → a auditoria acusa a linha exata |
| **Quedas de rede** | Com a Sala aberta, desligue a rede → "Sem sinal com o pátio. Tentando reconectar.", botão de lance travado e valor digitado mantido |

### O que dá para conferir sem instalar nada

Sem seguir o roteiro: a Vitrine, as Salas e a **auditoria** de qualquer lote são públicas; o **comprovante** abre por link, sem login; e a **documentação da API** está em `/docs`, com todas as rotas para testar pelo navegador. Nenhuma resposta pública traz nome, e-mail ou id de usuário, e o token do comprovante só aparece para o vencedor.

---

## Documentação da API

A API é documentada em **OpenAPI 3.1**, gerada dos mesmos schemas zod que a API usa para validar (`packages/shared`), e dá para exercitar tudo pelo navegador. **São 22 operações** em 8 grupos.

| | |
|---|---|
| **Swagger UI** | **<https://lanceautoapi-production.up.railway.app/docs>** |
| OpenAPI (JSON) | <https://lanceautoapi-production.up.railway.app/docs/openapi.json> |
| Saúde | <https://lanceautoapi-production.up.railway.app/health> |

Rodando local, os mesmos endereços em <http://localhost:4000/docs>.

> **Para autenticar no Swagger:** chame `POST /auth/login` com uma [conta semeada](#contas-semeadas-e-dados-de-demonstração), copie o campo `token` da resposta, clique em **Authorize** e cole. Daí em diante todo `Try it out` das rotas protegidas já vai autenticado, e o navegador lembra o token. A descrição geral da página traz o passo a passo, as tabelas de papéis e os eventos de Socket.IO.

| Grupo | Operações |
|---|---|
| **Auth** | `POST /auth/register` · `POST /auth/login` |
| **Conta** | `GET /me` · `GET /wallet` · `POST /wallet/deposits` |
| **Catálogo** | `GET /catalog/brands` · `GET /catalog/brands/{brandId}/models` · `GET /catalog/brands/{brandId}/models/{modelId}/years` · `GET /catalog/preview` |
| **Lotes** | `GET /brands` · `GET /lots` · `GET /lots/{id}` · `POST /lots` · `POST /lots/{id}/cancel` · `GET /my/lots` · `GET /items/{id}/image` · `GET /items/{id}/images/{position}` |
| **Lances** | `POST /lots/{id}/bids` · `GET /me/bids` |
| **Comprovante** | `GET /receipts/{token}` |
| **Auditoria** | `GET /lots/{id}/audit` |
| **Saúde** | `GET /health` |

Só existem `GET` e `POST` de propósito: lance nunca é editado nem apagado, e cancelar um lote é um `POST` próprio. O Socket.IO **não** faz parte do OpenAPI (só transmite eventos), e está descrito na [seção de tempo real](#lances-regras-e-transação).

**Todo erro sai no mesmo formato**, venha da regra de negócio, da validação ou de uma rota inexistente: `{"error": {"code": "BELOW_MINIMUM", "message": "...", "details": {...}}}`. O `code` é estável e a `message` está em português.

---

## No ar

| | |
|---|---|
| **Aplicação** (Railway) | **<https://lanceautoweb-production.up.railway.app>** |
| **API** (Railway) | <https://lanceautoapi-production.up.railway.app> |
| **Banco** | PostgreSQL do Railway, sem link público (a API o acessa pela rede privada) |

Web, API e banco ficam no mesmo projeto do Railway, e nenhum dos serviços hiberna.

```bash
curl -i -X POST https://lanceautoapi-production.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@lanceauto.test","password":"lance1234"}'
```

Essa chamada prova a API inteira em um comando: ela só responde `200`, com o `token` e o usuário, se o build rodou, **e** as migrações foram aplicadas, **e** o seed gravou as contas. Para checar só o processo e o banco, `GET /health` devolve `{"ok":true,"db":true}`.

---

## Como executar

### Pré-requisitos

Node 22.12 ou superior (testado no 24), npm, Docker (opcional, para o Compose e o banco local) e PostgreSQL 16 ou superior.

### Com Docker Compose

O jeito mais curto. Sobe banco, API e web; as migrações e o seed rodam sozinhos a cada start da API (e o seed só age em banco vazio).

```bash
cp .env.example .env      # no PowerShell o cp também funciona
docker compose up --build
```

Abra <http://localhost:3000> e entre com `ana@lanceauto.test` e `lance1234`.

- Web: http://localhost:3000 (mude com `WEB_PORT` e ajuste `WEB_ORIGIN` no `.env` para a mesma porta, senão o CORS recusa a API)
- API: http://localhost:4000, teste em `/health` (muda com `PORT`); documentação Swagger em `/docs`
- Postgres: `localhost:5433`
- Para parar: `docker compose down`. Para apagar também o banco: `docker compose down -v`.
- O Compose também cria o banco `lanceauto_test` (usado pelos testes), mas só na primeira vez que o volume do Postgres nasce. Se o volume já existia, rode `docker compose down -v` ou `docker compose exec db createdb -U lanceauto lanceauto_test`.

**Sem Docker para a aplicação** (só o banco no Docker):

```bash
cp .env.example .env
docker compose up -d db
npm ci
npm run build -w packages/shared
npm run prisma:generate -w apps/api
npm run migrate:deploy -w apps/api
npm run seed
npm run dev                    # shared em watch, API e web
```

Web em http://localhost:3000 e API em http://localhost:4000. No `npm run dev` o Next não lê o `.env` da raiz: o web usa `http://localhost:4000` como endereço da API. Se mudar `PORT`, crie `apps/web/.env.local` com `NEXT_PUBLIC_API_URL=http://localhost:<porta>`.

| Comando | O que faz |
|---|---|
| `npm run dev` | shared (watch), API e web em modo desenvolvimento |
| `npm run build` | build na ordem shared, api, web |
| `npm run lint` / `npm run typecheck` | ESLint; tipos dos três pacotes |
| `npm test` | testes dos três pacotes |
| `npm run seed` / `npm run seed:demo` | ver [Contas semeadas](#contas-semeadas-e-dados-de-demonstração) |
| `npm run seed:reset -- --confirmo` | **apaga o banco inteiro** e semeia de novo; ver [Recomeçar do zero](#recomeçar-do-zero-seedreset) |

### Os testes

`npm test` na raiz roda o Vitest dos três pacotes. Os testes de integração da API precisam de um Postgres próprio em `DATABASE_URL_TEST` (o Compose cria o banco `lanceauto_test`; as migrações são aplicadas sozinhas antes da suíte). Sem ela, eles são pulados. O CI (GitHub Actions) roda lint, typecheck, testes e build a cada push.

O que a suíte cobre:

- **Regras de lance:** ordem de validação, mínimo, líder que reenvia, papel, saldo, prorrogação.
- **Concorrência:** dez lances iguais ao mesmo tempo resultam num só líder; rodadas embaralhadas (a ordem de chegada usa uma semente; `TEST_SEED=<n>` repete uma falha); lances cruzados sem deadlock.
- **Saldo e extrato:** comprometido, liberado, estorno e liquidação batem com a carteira.
- **Liquidação única** e **cancelamento com estorno**, inclusive disputando o lock do lote.
- **Adulteração direto no banco:** o teste desliga o trigger de `Bid`, altera, apaga ou insere linhas e confere que a auditoria aponta a linha exata.
- **Seed:** estados dos cinco lotes, auditoria `OK`, saldos, idempotência e execução simultânea.
- **Resiliência:** com FIPE e Wikipedia fora do ar as telas públicas respondem do banco.
- **Privacidade:** nenhuma resposta pública traz `userId`, nome, e-mail ou o token do comprovante.
- **Voz do pátio:** os textos do shared não têm exclamação nem emoji.

Para rodar só uma parte: `npm test -w apps/api -- bids` (por exemplo).

### Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `NODE_ENV` | `development` (padrão), `test` ou `production`. Em `production` a API confia no proxy (`trust proxy` = 1) e loga em nível `info`. O Compose já define `production`; em hospedagem atrás de proxy, defina também |
| `DATABASE_URL` | Conexão do Prisma com o Postgres. No Railway: URL privada do serviço de banco |
| `DIRECT_URL` | Igual à anterior (conexão direta, usada nas migrações) |
| `DATABASE_URL_TEST` | Banco só dos testes de integração da API; sem ela esses testes são pulados |
| `JWT_SECRET` | Assina os tokens de login (mín. 32 caracteres). Trocar desloga todo mundo |
| `AUDIT_HMAC_KEY` | Chave da cadeia HMAC da auditoria (mín. 32 caracteres). Trocar invalida todos os históricos |
| `PORT` | Porta da API (padrão 4000) |
| `WEB_ORIGIN` | Origem exata do web (CORS e Socket.IO), com `https` e sem barra no final |
| `NEXT_PUBLIC_API_URL` | Endereço da API visto pelo navegador; embutido no build do web |
| `INTERNAL_API_URL` | Opcional: endereço da API visto pelo SSR do web (no Compose, `http://api:4000`) |
| `WEB_PORT` | Porta do web no Compose (padrão 3000) |
| `FIPE_BASE_URL`, `FIPE_TOKEN` | Tabela FIPE v2; o token é opcional e aumenta a cota |
| `WIKI_USER_AGENT`, `WIKIPEDIA_BASE_URL` | Identificação e endereço da Wikipedia (imagem sugerida) |
| `AUTH_RATE_LIMIT_MAX` | Limite de login/cadastro por minuto e por IP (padrão 30) |
| `RATE_LIMIT_DISABLED` | `1` desliga todos os limites (usado nos testes) |

Só para os testes existem `TEST_SEED` e `CANCEL_RACE_SEED` (repetem uma rodada embaralhada de concorrência; ver [Os testes](#os-testes)).

Gere segredos fortes com `openssl rand -hex 32` ou, sem OpenSSL (Windows), com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. O [.env.example](.env.example) está completo e comentado, com valores de desenvolvimento que funcionam com o Compose.

---

## Contas semeadas e dados de demonstração

Um comando cria as **três contas** e **cinco lotes** em estados diferentes, para o roteiro funcionar sem preparar nada:

```bash
npm run seed
```

Senha de todas as contas: `lance1234`. Ela é pública de propósito: é dado de teste.

| Papel | E-mail | Saldo inicial |
|---|---|---|
| `AUCTIONEER` (leiloeiro) | `leiloeiro@lanceauto.test` | — (recebe os créditos das vendas) |
| `BIDDER` (licitante) | `ana@lanceauto.test` | R$ 500.000,00 |
| `BIDDER` (licitante) | `bruno@lanceauto.test` | R$ 300.000,00 |

**Dois licitantes e um leiloeiro, de propósito.** Com dois licitantes dá para demonstrar a disputa, o "superada", a prorrogação e o estorno; um só não mostraria nada disso. **Conta criada em `/entrar` → "Criar conta"** escolhe o papel no cadastro.

`npm run seed` cria, **só pelos services da aplicação e sem nenhuma requisição de rede** (usa [apps/api/prisma/fipe-fixture.json](apps/api/prisma/fipe-fixture.json)), as três contas com os saldos da tabela acima e cinco lotes, numerados na ordem de criação:

| Lote | Estado | O que mostra |
|---|---|---|
| 001 | Encerrado, arrematado pela Ana | 4 lances, o último nos 2 minutos finais (prorrogou); comprovante, "Meus arremates" e total recebido |
| 002 | Encerrado, sem lances | Carimbo "Sem lances" e auditoria sem corrente |
| 003 | Cancelado | Bruno liderava: estorno no extrato e linha CANCEL na auditoria; some da Vitrine |
| 004 | Agendado | Abre em 2 dias |
| 005 | Ao vivo por 30 dias | 5 lances de Ana e Bruno; o Bruno termina na frente, então a Ana entra "superada" e pode cobrir |

O passado é fabricado com um relógio simulado e `createLot({ allowPast })`, que só o seed usa. Por isso as cadeias de hash nascem válidas e a auditoria responde "íntegro" em todos.

- **Seguro a cada deploy:** se já existem usuários, o seed não faz nada, imprime `seed ignorado: já existem usuários` e sai com código 0. Nunca apaga dados. Duas execuções ao mesmo tempo não se atropelam (`pg_advisory_xact_lock`).
- **`npm run seed:demo`** cria um lote ao vivo **novo** (30 dias, 5 lances de Ana e Bruno) sem tocar nos demais e, se o saldo disponível de um deles estiver abaixo de R$ 100.000,00, deposita a diferença (aparece no extrato como depósito). Imprime o número e a URL do lote. Rode quando o lote ao vivo expirar.
- **Defina `AUDIT_HMAC_KEY` e `JWT_SECRET` uma vez, antes do primeiro seed.** Trocar a chave HMAC depois faz todos os históricos aparecerem como adulterados.

### Recomeçar do zero (`seed:reset`)

Para entregar o ambiente limpo (sem os dados dos testes internos), `npm run seed:reset -- --confirmo` **apaga todas as tabelas** (menos o controle de migrações do Prisma) e roda o seed completo em seguida: as mesmas três contas, com os mesmos e-mails, senha e saldos, e os lotes 001 a 005, numerados de novo a partir de 001.

- **Trava:** sem `--confirmo` o comando só mostra o host do banco (sem usuário nem senha), recusa e sai com erro, sem alterar nada. Confira esse host antes de confirmar.
- **Nunca roda sozinho:** não faz parte do start da API nem do deploy. É um passo manual.
- **Por que não apagar só as contas:** `Bid` é append-only e a exclusão de um usuário tentaria zerar o `bidderId` dos lances, o que o trigger recusa. O `TRUNCATE` não é interceptado de propósito.
- **Se o seed falhar no meio**, o reset esvazia o banco de novo e mostra o erro, para não restar um seed pela metade que o próximo start pularia.
- **Todos os tokens e dados somem:** quem estava logado precisa entrar de novo, e comprovantes antigos deixam de existir.
- **O lote 005 dura 30 dias** a partir do reset. Faça o reset perto da avaliação.

**As mesmas contas existem no banco do Railway**, criadas por este mesmo comando, que roda a cada deploy logo depois das migrações.

---

## Stack e estrutura

| Camada | Escolha |
|---|---|
| Web | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind · TanStack Query · Socket.IO client |
| API | Node · Express 5 · Socket.IO · zod |
| Banco | PostgreSQL 16 · Prisma 6.19 |
| Contratos | `packages/shared`: schemas zod, DTOs, `lotStatus`, códigos de erro e textos canônicos |
| Autenticação | JWT HS256 · senha com `bcryptjs` |
| Catálogo externo | Tabela FIPE (parallelum v2) e Wikipedia |
| Tipografia e tema | Manrope · tema claro e noite |
| Testes | Vitest, com PostgreSQL de verdade nos testes da API |
| Documentação | OpenAPI 3.1 + Swagger UI (gerados dos zod) |
| Integração e deploy | GitHub Actions · Railway |

```text
docker-compose.yml    # banco, API e web
docker/initdb/        # cria o banco de teste na primeira subida do Compose
packages/shared/      # contratos zod, tipos, lotStatus e textos canônicos
apps/api/
  prisma/             # schema, migrações, seed e a fixture da FIPE
  src/routes/         # HTTP e validação com zod; sem regra de negócio
  src/services/       # transações; é o único lugar que escreve no banco
  src/domain/         # regras puras: lance, cadeia HMAC, pseudônimo, ranking
  src/infra/          # relógio, FIPE, Wikipedia, publisher do Socket.IO, job de fechamento
  src/docs/           # OpenAPI e Swagger, gerados dos zod
  src/seed/           # seed e seed:demo
apps/web/src/
  app/(site)/         # Vitrine, Sala, Painel, Carteira, Meus arremates, acesso
  app/(publico)/      # comprovante (/c/{token})
  app/(auditoria)/    # auditoria pública do lote
  components/         # componentes
  lib/                # cliente da API, relógio do servidor, formatação
_bmad-output/         # planejamento: PRD, UX, arquitetura, SPEC e fatias, diário de progresso
USO_DE_IA.md          # onde, como e com qual método usei IA
```

A dependência vai em um só sentido: `routes → services → domain`, com `services → infra`. O `apps/web` nunca importa `apps/api`: os dois só se encontram em `packages/shared`.

**`_bmad-output/` é versionado de propósito**, porque o desafio pede os artefatos de planejamento junto do código: o PRD, o `DESIGN.md` e o `EXPERIENCE.md`, a espinha de arquitetura (AD-1 a AD-13), a SPEC com as dez fatias (S00 a S09) e o [diário de progresso](_bmad-output/progresso.md), que registra passo a passo o que foi feito, decidido e verificado.

---

## Como funciona por dentro

O que está por trás do roteiro: as regras e as transações de cada parte do sistema.

### Lances (regras e transação)

Cada lance é uma única transação no Postgres: o lote é travado (`FOR UPDATE`) e só depois as carteiras, em ordem de `userId`, o que evita deadlock entre lances cruzados. O relógio é lido depois do lock, o saldo vem da própria query que trava, e os eventos (`bid:placed`, `showcase:lot`, `wallet:updated`) só são entregues depois do commit.

**Ordem de validação** (a do PRD): lote cancelado, ainda não aberto, encerrado, valor abaixo do mínimo, líder reenviando, papel, saldo. A API devolve o primeiro código que falhar.

Consequência dessa ordem: o líder que reenvia um valor **abaixo** do mínimo recebe `BELOW_MINIMUM`, não `ALREADY_WINNING`. Para não dizer ao próprio líder que "alguém levantou a mão antes de você", o erro leva `details.reason = "OWN_LEAD"` e uma mensagem própria ("Você já está na frente. Para cobrir o próprio lance, o mínimo é R$ X"). Os outros motivos são `OUTDATED` (o lance que a tela viu já não é o atual) e `MINIMUM`. Reenviar um valor suficiente cai em `ALREADY_WINNING`, e o leiloeiro só recebe `ROLE_NOT_ALLOWED` quando o lance passaria nas checagens anteriores.

**Prorrogação:** lance feito quando faltam 2 minutos ou menos (inclusive) leva o fim a *hora do lance + 2 min*, sem teto de prorrogações. O `originalEndsAt` nunca muda; a Sala mostra o selo "+2 MIN" quando `endsAt > originalEndsAt`.

**Saldo:** quem lidera tem o valor do lance atual comprometido; ao ser superado, o valor volta ao disponível na mesma transação do lance que o superou. O total só muda na liquidação (ver [Fechamento e comprovante](#fechamento-e-comprovante)). O extrato registra `HOLD` e `RELEASE` com o número do lote e, no arremate, `Arremate · lote NNN`.

**Privacidade e cadeia:** o histórico mostra um pseudônimo por lote ("Licitante 7F3A", 4 hex de um HMAC de usuário e lote), então a mesma pessoa aparece com nomes diferentes em lotes diferentes. Com 4 hex a colisão entre dois licitantes do mesmo lote é possível (1 em 65.536 por par) e foi aceita: o pseudônimo é só rótulo, o lance sempre pertence ao `userId` gravado. Nenhuma resposta pública leva `userId`, nome ou e-mail. Cada lance entra na cadeia HMAC-SHA256 do lote (`prevHash` e `hash`) e a tabela `Bid` recusa `UPDATE` e `DELETE` por trigger.

**Tempo real (Socket.IO):** lance, prorrogação, saldo e cartão da Vitrine chegam sem recarregar. Quem muda o dado é sempre uma rota REST: o service devolve os eventos, a rota os entrega ao `Publisher` **depois do commit**, e um evento nunca sai de uma recusa. Falha ao publicar é logada e não derruba a requisição já confirmada.

- **Salas:** `lot:{id}` (a Sala do lote; o cliente entra com `lot:join`, que responde o snapshot, e sai com `lot:leave`), `showcase` (Vitrine e Painel; `showcase:join`) e `user:{id}` (só o servidor atribui, a partir do JWT do handshake; o cliente não consegue pedir). Token ausente, inválido ou vencido conecta como visitante.
- **Eventos:** `bid:placed` (leva `version`, `minimumBidCents`, `endsAt` e `extended`), `showcase:lot` (o cartão do lote), `wallet:updated` (só o novo líder e o líder anterior, ou o dono no depósito). Todo payload leva `serverTime`, carimbado pelo `Publisher`; nenhum leva `userId`, nome ou e-mail.
- **Uma só regra de ordem:** o cliente aplica `bid:placed` se `version == atual + 1`, descarta se `<= atual` e, se houve salto, refaz o `GET /lots/:id`. O mesmo reducer trata a resposta do próprio lance, então a linha não duplica.
- **Queda e volta:** o servidor detecta a queda em até ~20 s (`pingInterval` e `pingTimeout` de 10 s). Com o socket fora, a Sala mostra "Sem sinal com o pátio. Tentando reconectar.", trava o botão de lance e mantém o valor digitado. Ao voltar, entra de novo na sala, refaz o `GET` e só então libera o botão. Nada é reenviado sozinho: lance com resposta ambígua pede conferir o histórico.
- **Sem WebSocket não há bloqueio eterno:** na primeira conexão o aviso aparece depois de 3 s e, passados 10 s, o botão de lance é liberado; o servidor valida tudo (`expectedCurrentCents`), então dar lance não depende do socket.
- **Relógio:** o cronômetro usa o relógio do servidor (`offset` da resposta HTTP de menor latência). Evento do socket não mexe no `offset`.
- **Fora desta versão:** replay de eventos perdidos (a reconciliação é um snapshot) e mais de uma instância da API (sem adapter Redis).

### Fechamento e comprovante

Quando o relógio chega ao fim, o lote fecha sozinho. Uma rotina na API (`settlement-job`) varre os lotes vencidos no boot e depois a cada 5 s, e cada lote é liquidado numa transação própria: o lote é travado (`FOR UPDATE SKIP LOCKED`), `settledAt` é relido sob o lock, as carteiras são travadas em ordem de `userId`, o vencedor é debitado (total e comprometido), o leiloeiro é creditado e o `Receipt` nasce com um token aleatório de 24 bytes. A garantia de liquidar uma única vez é a releitura sob o lock, com `Receipt.lotId UNIQUE` como rede de segurança. Sem lances, só `settledAt` é preenchido. Um `GET` nunca liquida; entre `endsAt` e a liquidação o status é `CLOSING` e a tela mostra "Martelo batido. Apurando o resultado…". Falha em um lote é logada e o ciclo segue para o próximo; ele é tentado de novo no ciclo seguinte.

- **`endsAt` × `settledAt`:** o martelo mostrado (Sala e comprovante) é sempre o `endsAt`, já com as prorrogações. `settledAt` é só quando a rotina liquidou e pode ser bem depois (a API ficou parada, ou um deploy atravessou o fim do lote): a varredura do boot liquida o que venceu enquanto ela estava fora, e é por isso que o lote que já estava vencido numa base antiga é liquidado na primeira subida depois do deploy da rotina.
- **Comprovante** (`/c/{token}`, público e sem login): recibo com lote, carro, valor, martelo com segundos, pseudônimo daquele lote e o HMAC-SHA256 final da cadeia (a liquidação não escreve na cadeia, então é o mesmo `lastHash` do lote). Nenhuma resposta traz nome, e-mail ou `userId`. O token só aparece para o vencedor logado (`myReceiptToken` em `GET /lots/:id`) e na própria URL; nenhum evento nem lista pública o carrega. A página é renderizada no servidor com timeout de 8 s e `noindex`; se a API não responder, o cliente tenta de novo, e só um 404 da API vira "Comprovante não encontrado".
- **Quem venceu** é decidido pelo servidor (`myReceiptToken`), nunca comparando pseudônimos no navegador.
- **Seed:** `npm run seed` cria, pelos mesmos services e com relógio simulado, o lote 001 **arrematado** pela Ana (4 lances, o último a menos de 2 minutos do fim, então prorrogado) e o 002 **encerrado sem lances**, e imprime o link do comprovante de demonstração (`Comprovante de demonstração: /c/…`). Entre como Ana, abra o lote arrematado em Meus arremates e use "Ver comprovante" (ver [Contas semeadas](#contas-semeadas-e-dados-de-demonstração)).
- **Vitrine apurando:** um cartão cujo fim passou e que o servidor ainda não encerrou fica em "Ao vivo" com "Apurando o resultado…"; a lista é refeita a cada 3 s, com teto de 20 respostas, e o `showcase:lot` do fechamento o move para "Encerrados" e zera a conta.

### Cancelamento com estorno e linha CANCEL na auditoria

O leiloeiro dono cancela qualquer lote seu **agendado ou ao vivo, com ou sem lances** (`POST /lots/:id/cancel`, corpo `{ "confirmEntryCount": N }`). Não existe editar nem reabrir: depois de agendado só existe "Cancelar". Tudo acontece numa transação: o lote é travado (`FOR UPDATE`), o `now` é lido depois do lock, e na ordem da fatia a API confere dono, se já foi cancelado (`LOT_CANCELLED`), se o fim já passou ou o lote já liquidou (`LOT_ENDED`) e a contagem. Se havia líder, a carteira dele é travada e o comprometido do lance atual volta ao disponível (`REFUND` no extrato, o total não muda); só o líder atual tem saldo comprometido no lote, quem foi superado já foi liberado por `RELEASE`.

- **Linha CANCEL na cadeia:** o cancelamento entra como linha própria do histórico (`kind=CANCEL`, `seq = entryCount + 1`, sem autor, pseudônimo nem valor), com hash `HMAC(chave, "v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}")`, e o selo passa a contar essa linha. É gravada **sempre**, com ou sem lances, e conta no veredito da auditoria. A Sala nunca a mostra (`bids[]` é só `BID`); a página de Auditoria a exibe como "Cancelado pelo leiloeiro".
- **Corrida do diálogo (`confirmEntryCount`):** o diálogo mostra "Cancelar o lote 019 com 2 lances?" e envia essa contagem. Se entrou lance enquanto o leiloeiro decidia, o servidor responde `LOT_CHANGED` com a contagem real e **nada muda**; o mesmo diálogo se atualiza e pede a confirmação de novo, e o estorno vai para o líder novo. Cancelar × lance serializam pelo lock do lote: ou o lance entra antes (e o cancelamento recebe `LOT_CHANGED`) ou o cancelamento entra antes (e o lance recebe `LOT_CANCELLED`, sem `HOLD`). Nunca sobra saldo comprometido em lote cancelado.
- **O que cada tela vê:** o lote some da Vitrine por `showcase:lot` (nunca vem em `GET /lots`); a Sala continua respondendo pela URL e vira "Cancelado" sem recarregar, sem formulário; o chip e a Carteira de quem liderava voltam ao disponível por `wallet:updated`; no Painel a linha só muda para "Cancelados" quando o servidor confirma (sem atualização otimista), com o estorno e o horário. O job de fechamento nunca liquida lote cancelado.
- **Rede ambígua:** se a resposta do cancelamento se perde, o diálogo não reenvia sozinho; ao tentar de novo ele primeiro refaz `GET /my/lots` e, se o lote já está cancelado, trata como sucesso.
- **Seed:** o lote 003 é cancelado pelos mesmos services (Ana abre, Bruno cobre e lidera, cancelamento com `confirmEntryCount = 2`): estorno ao Bruno e linha CANCEL `seq = 3`. O comprometido de cada carteira continua igual à soma dos lances dos lotes ao vivo que ela lidera.

### Meus arremates

O licitante vê em `/arremates` (item "Meus arremates" no cabeçalho) todos os lotes em que deu lance, cada um num ingresso com o seu estado: **Ganhando**, **Superado**, **Arrematado**, **Perdido** ou **Cancelado**. `GET /me/bids` (só `BIDDER`) devolve a lista já ordenada e com o `state` pronto, calculado pelo servidor só com as colunas do banco; o cliente não decide estado nem reordena.

- **Perdido** é o lote que **encerrou e foi liquidado** com outra pessoa vencendo. **Cancelado nunca é Perdido**: `cancelledAt` vence tudo, aparece só na aba "Todos" e, se a pessoa liderava, a frase diz que o saldo voltou.
- **Apurando:** entre o fim do relógio e a liquidação o `state` segue Ganhando/Superado, mas a tela troca o selo por "APURANDO" e a frase "Martelo batido. Apurando o resultado…", sem posição e sem "Cobrir lance" (o lance já está bloqueado). Só esse rótulo é derivado no navegador, com `lotStatus` e o relógio do servidor; quando a liquidação sai, o `showcase:lot` refaz a lista e o ingresso vira Arrematado ou Perdido.
- **Posição:** "é o 2º maior de 3" conta licitantes distintos pelo maior lance de cada um (o mesmo `rankFrom` da Sala). O token do comprovante só vem no ingresso Arrematado e só do próprio `Receipt`; "Ver comprovante" abre em outra guia e "Copiar link" copia `{origem}/c/{token}`.
- **Tempo real:** a lista só muda com a resposta do `GET`. Evento de lote que não está na lista é ignorado, versão velha é descartada, rajadas viram uma consulta (300 ms), e `wallet:updated` e a reconexão do socket também refazem. Os anúncios da região viva ("Lote 018: você foi superado.") só saem entre duas respostas do servidor, nunca na carga inicial.
- Na Carteira, cada lote de "Travado onde você lidera" leva ao ingresso (`/arremates#lote-018`). Os ingressos Perdido e Cancelado têm "Conferir na auditoria" (`/lotes/<id>/auditoria`).

### Anti-adulteração do histórico

Cada lote tem uma **cadeia de hashes assinada com HMAC-SHA256**. A chave fica só numa variável de ambiente do servidor (`AUDIT_HMAC_KEY`), nunca no banco.

**Como funciona**

1. Cada lance guarda: número de sequência no lote (1, 2, 3…), pseudônimo do licitante, valor em centavos, horário (UTC), o hash do lance anterior e o próprio hash. O cancelamento de um lote também entra na cadeia como uma linha própria.
2. O hash de cada linha é `HMAC-SHA256(chave, "v1|entry|{lote}|{seq}|{tipo}|{pseudônimo}|{valor}|{horário}|{hash anterior}")`. O primeiro lance usa um hash inicial (genesis) derivado dos dados do lote: `HMAC(chave, "v1|genesis|{lote}|{início}|{lance inicial}|{incremento}")`.
3. O lote guarda a quantidade de linhas e o último hash, com um **selo** `HMAC(chave, "v1|seal|{lote}|{quantidade}|{último hash}")`.
4. Ao fechar o lote, o hash final é gravado também no comprovante.
5. A página de auditoria (`/lotes/<id>/auditoria`, pública, sem login) pede ao servidor que **refaça a conta** do primeiro ao último lance e compare com o que está gravado, com o selo do lote e com o hash do comprovante. A verificação roda no servidor porque só ele tem a chave.

| Adulteração feita direto no banco | Como é detectada |
|---|---|
| Alterar valor, horário ou licitante de um lance | O hash daquela linha deixa de bater |
| Remover um lance do meio | A sequência pula e o encadeamento da linha seguinte quebra |
| Inserir um lance | A sequência ou o hash da linha inserida não fecha (sem a chave não há hash válido) |
| Remover os últimos lances | A contagem e o último hash deixam de bater com o selo do lote (e, em lotes encerrados, o hash final deixa de bater com o comprovante) |
| Recalcular a cadeia inteira | Não dá sem a chave secreta |

Um SHA-256 simples (sem chave) não bastaria: quem tem acesso ao banco recalcularia a cadeia inteira e ninguém perceberia. O que impede isso é a chave estar fora do banco.

Veredito possível: **íntegro**, **adulterado na linha N** (primeiro registro com problema), **selo do lote não confere** (faltam ou sobram registros no fim) e **comprovante não confere**. A verificação também confere o que o hash não alcança: lote vendido sem comprovante, valor do comprovante diferente do último lance e cancelamento que a cadeia não registra. A página nunca mostra o valor "original" de um registro adulterado, porque o hash não permite recuperá-lo.

A rota é `GET /lots/:id/audit`: pública, sem cache (`Cache-Control: no-store`), com lote, linhas e comprovante lidos numa única transação (`RepeatableRead`) para que um lance que entre durante a verificação não gere um falso alarme. Nada é gravado: o veredito é recalculado a cada chamada. A resposta nunca traz o token do comprovante, `userId`, nome nem e-mail.

Reforços no código: um trigger do PostgreSQL rejeita `UPDATE` e `DELETE` na tabela de lances (os testes o desativam de propósito, numa única transação, para simular quem tem acesso ao banco). Dá para reproduzir a detecção à mão. Com o Docker Compose, abra o `psql` dentro do serviço do banco (usuário e banco do seu `.env`; os do `.env.example` são `lanceauto`):

```bash
docker compose exec db psql -U lanceauto -d lanceauto
```

O `id` do lote é o UUID que aparece na URL da Sala (`/lotes/<id>`), ou sai de `SELECT id, number, title FROM "Lot" ORDER BY number;`. Depois:

```sql
ALTER TABLE "Bid" DISABLE TRIGGER bid_no_update_delete;
UPDATE "Bid" SET "amountCents" = "amountCents" + 100 WHERE "lotId" = '<id>' AND seq = 3;
ALTER TABLE "Bid" ENABLE TRIGGER bid_no_update_delete;
-- agora abra /lotes/<id>/auditoria: "Adulterado", linha 03
```

**Limitações**

- Quem tem a chave (o próprio servidor) poderia forjar uma cadeia nova e consistente.
- Restaurar um backup antigo **e completo** do banco não seria detectado em lotes ainda abertos (o selo do backup também é válido). Em lotes já encerrados, o hash impresso no comprovante compartilhado denuncia a troca.
- Trocar `AUDIT_HMAC_KEY` depois de existirem lotes invalida todas as cadeias (todas passam a aparecer como adulteradas).
- Evolução possível: assinar com Ed25519 e publicar a chave pública, para verificar no próprio navegador.
- Reforço possível: o usuário do banco usado pela aplicação pode ficar sem permissão de `UPDATE`/`DELETE` na tabela de lances.
- O pseudônimo tem 4 caracteres hexadecimais; dois licitantes do mesmo lote podem, raramente, ter o mesmo pseudônimo.
- O dono de um lance (`bidderId`) e o líder atual do lote ficam fora do hash: trocar o dono de um lance direto no banco não é detectado pela cadeia (o pseudônimo, que está no hash, não muda). A auditoria cobre o histórico de lances, não a contabilidade (saldos e extrato).
- A auditoria é pública e recalcula a cadeia a cada chamada, então tem limite de 60 requisições por minuto por IP. Atrás de proxy (Railway) o IP vem de `X-Forwarded-For` (`trust proxy` = 1). Quem avalia de uma rede corporativa com IP compartilhado pode, raramente, receber "muitas requisições": basta esperar um minuto.

### Catálogo: Tabela FIPE e Wikipedia

Só o back-end fala com as APIs externas, e só em duas situações: as rotas `/catalog/*` (selects do Criar lote) e a criação do lote (`POST /lots`, que busca de novo o detalhe do carro na FIPE em vez de confiar no navegador). Vitrine, Sala, Painel e imagens leem só o banco: com a FIPE e a Wikipedia fora do ar, só o Criar lote mostra o aviso "A tabela FIPE não respondeu.", e nada do que foi digitado se perde.

- **FIPE** ([parallelum v2](https://fipe.parallelum.com.br/api/v2), `FIPE_BASE_URL`): sem token, a cota observada é de **500 requisições por dia** (cabeçalho `x-ratelimit-limit`; um `FIPE_TOKEN` opcional aumenta). Por isso: cache em memória de 24 h por URL (até 500 entradas), uma única requisição para chamadas simultâneas, timeout de 4 s com uma repetição só em falha de rede ou 5xx, e **429 nunca repete**. Se a FIPE falha e há entrada vencida, ela é servida (com log de aviso); falha nunca entra no cache.
- **O cache vive na memória do processo**: zera a cada reinício ou deploy da API, e a primeira consulta volta a gastar cota.
- **Wikipedia** (`WIKIPEDIA_BASE_URL`, resumo `page/summary` em português, com `WIKI_USER_AGENT`): a foto sugerida sai do artigo "{marca} {modelo}" (ou só do modelo, se o resumo falar de carro), em miniatura de 1280 px. O resumo não traz autor nem licença do arquivo; o crédito sugerido é "Foto: Wikipedia, artigo … (licença Creative Commons, veja a página do artigo)" com link para o artigo. Se o leiloeiro troca a URL, o crédito da Wikipedia é apagado.
- **A imagem é baixada na criação do lote** e guardada no banco (`GET /items/:id/image`); depois disso nenhuma tela depende da Wikipedia. O download só aceita http/https nas portas 80/443, recusa endereços privados e de nuvem (inclusive por DNS e redirecionamento), para em 4 MB e aceita só JPEG, PNG, WebP e GIF. Falhou, o lote nasce com a ilustração padrão.

---

## Deploy e integração contínua

**Web e API sobem sozinhos a partir da `main`.** A cada push, a CI do GitHub (Actions) roda lint, typecheck, testes e build, com um PostgreSQL de serviço, e o Railway publica web e API sozinhos (os *Watch Paths* de cada serviço decidem quem precisa de um deploy novo).

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

Migrações novas são aplicadas sozinhas a cada start. O seed também roda no start, ao lado do `migrate deploy`: com o banco sem usuários ele cria as contas e os lotes 001 a 005; com usuários ele não faz nada (`seed ignorado: já existem usuários`) e sai com código 0. Uma falha nele não derruba a API. A hospedagem não hiberna, então não há "acordar" a API.

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

### Checklist de deploy

1. Lockfile commitado e versões confirmadas (Node 24, Next, Prisma 6).
2. Serviço de banco com as variáveis do próprio Railway; `DATABASE_URL` e `DIRECT_URL` iguais, pela rede privada.
3. API com todas as variáveis da tabela de [Variáveis de ambiente](#variáveis-de-ambiente); `WEB_ORIGIN` igual à origem exata do web; comando de start com `migrate deploy` e seed; `trust proxy` ativo em produção.
4. Web com `NEXT_PUBLIC_API_URL` apontando para o domínio público da API.
5. `JWT_SECRET` e `AUDIT_HMAC_KEY` fortes, definidos **antes** do primeiro seed e guardados em local seguro.
6. `GET /health` devolve `{"ok":true,"db":true}`.
7. Smoke pelo link público: login como Ana, Bruno e leiloeiro, lance, Sala ao vivo em duas janelas, comprovante, auditoria e Criar lote com a FIPE real.
8. Console do navegador sem erro de CORS nem de WebSocket.

---

## Decisões: por que isso e não aquilo

O desafio quer ver como se pensa: o que foi descartado e por quê. Esta seção é a resposta.

A régua para uma decisão entrar aqui: **se eu tivesse escolhido a alternativa, quem avalia veria um sistema diferente.** Detalhe de tela e biblioteca menor ficam de fora. As decisões de arquitetura (AD-1 a AD-13) e as transversais (T1 a T13) estão na [espinha de arquitetura](_bmad-output/planning-artifacts/architecture/architecture-eliteDevLeilao-2026-10-22/ARCHITECTURE-SPINE.md) e no [SPEC.md](_bmad-output/specs/spec-lanceauto/SPEC.md).

### 1 · Mutação só por REST; o Socket.IO só transmite

**Decidi** que todo lance, depósito e cancelamento é uma requisição REST que passa por um service. O Socket.IO leva eventos do servidor ao cliente, e só depois do commit. Uma recusa nunca gera evento.

**Por quê:** com um único caminho de escrita, a regra do lance tem uma implementação só e um código de recusa só. E, como o evento sai depois do commit, ninguém vê na tela um lance que a transação poderia desfazer.

**O que caiu:** dar lance pelo socket, que é mais rápido de demonstrar e criaria dois caminhos de escrita com regras que acabariam divergindo. Caiu junto a **atualização otimista**: o servidor é a verdade de tempo, saldo e valor, e a tela só muda com a resposta dele.

### 2 · Um lock só, sempre na mesma ordem

**Decidi** que toda transação que mexe em dinheiro trava primeiro o **lote** (`FOR UPDATE`) e depois as **carteiras**, numa só query, em ordem crescente de `userId`. O relógio é lido depois do lock, e o saldo vem da própria query que trava.

**Por quê:** um lance mexe no líder anterior e no novo; o cancelamento e a liquidação, no líder e no leiloeiro. Com uma ordem fixa, dois lances cruzados não esperam um pelo outro. Isso foi provado em teste: dez lances iguais ao mesmo tempo, rodadas embaralhadas e lances cruzados entre dois lotes.

**O que caiu:** travar cada carteira na ordem em que a lógica as encontra, que é o caminho natural e dá deadlock quando dois lances disputam o mesmo par de carteiras em ordem inversa.

### 3 · Dinheiro em centavos inteiros; a carteira é cache e o extrato é a verdade

**Decidi** guardar todo valor como `BigInt` em centavos e converter para `number` só nas bordas (campos `…Cents`). A interface mostra reais inteiros. A carteira tem só `total` e `committed`, atualizados **na mesma transação** que grava uma linha do extrato (append-only); o disponível é sempre calculado, nunca gravado. O banco recusa `committed < 0` e `total < committed`.

**Por quê:** `float` erra centavo, e `Int32` estoura em R$ 21 milhões. E, com o extrato gravado junto, o saldo sempre fecha com a soma das linhas.

**O que caiu:** guardar só o saldo, sem extrato, que seria mais simples e deixaria o usuário sem como conferir de onde saiu cada centavo.

### 4 · A auditoria é uma cadeia HMAC com a chave fora do banco

**Decidi** que cada lote tem uma cadeia de hashes `HMAC-SHA256` com chave em variável de ambiente (`AUDIT_HMAC_KEY`), um selo no lote e o hash final impresso no comprovante. A tabela de lances recusa `UPDATE` e `DELETE` por trigger.

**Por quê:** um SHA-256 simples não bastaria. Quem tem acesso ao banco recalcularia a cadeia inteira e ninguém perceberia. Com a chave fora do banco, alterar, remover ou inserir um lance quebra a conta, e remover os últimos lances quebra o selo. O [teste de adulteração](#os-testes) faz exatamente isso, direto no banco, e confere que a auditoria aponta a linha certa.

**O que caiu:** assinar com **Ed25519** e publicar a chave pública, o que permitiria verificar no navegador. Ficou como evolução possível. O custo de ter ficado no HMAC está declarado em [O que não está pronto](#o-que-não-está-pronto): a verificação roda no servidor, e quem tem a chave poderia forjar uma cadeia nova.

### 5 · Pseudônimo por lote

**Decidi** que o histórico mostra "Licitante 7F3A", quatro caracteres de um HMAC de usuário **e lote**, então a mesma pessoa aparece com nomes diferentes em lotes diferentes. Nenhuma resposta pública traz nome, e-mail ou `userId`.

**Por quê:** a auditoria e o comprovante são públicos. Com um pseudônimo por lote, ninguém consegue seguir um licitante de um lote para outro.

**O que caiu:** um apelido fixo por usuário no cabeçalho, que era o que o `DESIGN.md` previa. O cabeçalho mostra só "VOCÊ · papel", e o pseudônimo só existe dentro do lote. A colisão de dois licitantes no mesmo lote (1 em 65.536 por par) foi aceita: o pseudônimo é só rótulo, e o lance sempre pertence ao `userId` gravado.

### 6 · Quando as fontes se contradisseram, escolhi uma ordem

**Decidi** a precedência: minhas decisões > PRD > arquitetura > EXPERIENCE > DESIGN. Cada conflito virou uma linha numerada no SPEC.md (C1 a C13). Os dois que mais mudaram o comportamento:

- **Ordem de validação do lance.** Segui a do **PRD** (valor antes de liderança), e não a da arquitetura. Efeito: o líder que reenvia um valor abaixo do mínimo recebe `BELOW_MINIMUM`, com `reason = OWN_LEAD` e a frase "Você já está na frente…", no lugar do texto que mentiria para ele ("alguém levantou a mão antes de você").
- **Cancelamento na cadeia.** O PRD exige que o cancelamento fique no histórico, então ele entra como uma linha `CANCEL` própria, **também em lote sem lances**. A alternativa, não cobrir o cancelamento na cadeia, deixaria o histórico terminar sem registrar que o lote foi cancelado.

**O que caiu:** a ordem de validação da arquitetura e a cadeia sem a linha de cancelamento.

### 7 · O fechamento é um timer idempotente, e leitura nunca liquida

**Decidi** que uma rotina da API varre os lotes vencidos no boot e a cada 5 segundos. Cada lote é liquidado numa transação própria, com `FOR UPDATE SKIP LOCKED` e `settledAt` relido sob o lock. A garantia final contra liquidação dupla é `Receipt.lotId UNIQUE`.

**Por quê:** a liquidação mexe em dinheiro, então precisa acontecer uma vez só, mesmo se a rotina rodar duas vezes ou o deploy atravessar o fim do lote. Entre o fim do relógio e a liquidação o lote está "apurando", e a tela diz isso.

**O que caiu:** liquidar dentro de um `GET`, o que faria uma simples leitura mexer em dinheiro. E **mais de uma instância da API**: o Socket.IO está sem adaptador e escalar exigiria Redis.

### 8 · Telas públicas leem só o banco; o catálogo é copiado na criação do lote

**Decidi** que a FIPE e a Wikipedia só são chamadas pelo Criar lote. No ato da criação, o detalhe do carro é buscado de novo no servidor (sem confiar no navegador) e a imagem é baixada e **guardada no banco**.

**Por quê:** a FIPE dá cerca de 500 requisições por dia sem token. Se a Vitrine a consultasse a cada visita, a cota acabaria cedo e a tela pública quebraria junto com a FIPE. Assim, com as duas APIs fora do ar, só o Criar lote mostra aviso, e há um teste que prova isso. O cache de 24 h serve entrada vencida se a chamada falhar.

**O que caiu:** consultar ao vivo a cada visita, e depender da Wikipedia para exibir a foto. O download aceita só http/https nas portas 80 e 443, recusa endereços privados e de nuvem (inclusive por DNS e redirecionamento), para em 4 MB e só aceita JPEG, PNG, WebP e GIF.

### 9 · Autenticação com JWT em `localStorage`

**Decidi** usar JWT HS256 de 7 dias, enviado em `Authorization: Bearer` e no handshake do Socket.IO, guardado no `localStorage`. Um papel por conta, autorização no servidor.

**Por quê:** a decisão foi tomada quando o plano era Vercel (web) e Render (API), em domínios diferentes. Nesse arranjo o navegador bloqueia o cookie entre os dois sites, e a Vercel não faz proxy de WebSocket, que é por onde o token iria no handshake.

**O que caiu:** cookie `httpOnly`, que protege o token de qualquer script da página. É a troca de segurança mais relevante do projeto, e o custo está declarado em [O que não está pronto](#o-que-não-está-pronto): uma falha de XSS entregaria a sessão. Também não há refresh token: o token vale 7 dias e depois é preciso entrar de novo.

### 10 · Hospedagem: tudo no Railway

**Decidi**, no segundo dia, trocar Render + Vercel + Neon por **Railway** (web, API e Postgres no mesmo projeto). Tirei Render, Vercel e Neon do ar.

**Por quê:** o plano gratuito do Render hiberna e leva cerca de 50 segundos para acordar. Isso atrapalha o Socket.IO e quem abre o link frio, que é exatamente quem avalia. No Railway a API é um processo contínuo, então não há cold start de socket, e a ideia de mostrar "Acordando o pátio…" deixou de fazer sentido.

**O que caiu:** manter a divisão por especialidade (Vercel para o front, Render para o back, Neon para o banco). Era a que a SPEC previa, e ficou registrada nas fatias S00 e S09 como desatualizada.

### 11 · Cor, contraste e tema

**Decidi**, a partir da base visual do Claude Design, trocar o amarelo pelo azul `#0033A0`, com tema claro e noite (padrão do sistema, com chave manual no cabeçalho, aplicada antes da pintura para não piscar).

**Por quê:** o azul puro sobre o fundo escuro dá só 1,72:1 de contraste, então no tema noite ele serve de fundo de bloco, e não de texto. Para texto, traço e ponto criei um token à parte (`#6B93FF`, 6,29:1 sobre o fundo). Medi os 62 pares de cor da tabela do DESIGN.

**O que caiu:** `#4D7BFF` como cor de texto no noite, que dava 4,13:1 sobre o papel, abaixo do mínimo de 4,5:1.

---

## O que não está pronto

Estes são **cortes conscientes**, não esquecimentos:

| O quê | Por quê |
|---|---|
| **Recuperação de senha** | Fora do escopo, e exigiria envio de e-mail |
| **Pagamento real** | O saldo é simulado: o depósito é um registro no extrato, com máximo de R$ 10.000.000,00 por operação |
| **Editar lote agendado** | Decisão de produto: depois de agendado, o lote só pode ser cancelado |
| **Lance automático, chat, notificação por e-mail, aplicativo nativo, preço de reserva, nota fiscal, revenda** | Fora do escopo do teste |
| **Paginação da Vitrine e filtro de preço** | A Vitrine filtra por busca, marca e situação, e não pagina |
| **Mais de uma instância da API** | O Socket.IO está sem adaptador; escalar exigiria Redis. O fechamento já é seguro contra rodada dupla (`SKIP LOCKED`), mas o tempo real não |
| **Replay de eventos perdidos** | Quem cai e volta reconcilia por um snapshot (`GET /lots/:id`), e não pela repetição dos eventos que perdeu |
| **Token de login em `localStorage`** | [Decisão 9](#9--autenticação-com-jwt-em-localstorage): uma falha de XSS entregaria a sessão. O logout é do cliente (descarta o token) e não há refresh |
| **Verificação da cadeia no navegador (Ed25519)** | A verificação roda no servidor, porque só ele tem a chave. Quem tem a chave poderia forjar uma cadeia nova e consistente |
| **Backup antigo e completo do banco** | Restaurá-lo não seria detectado em lotes ainda abertos (o selo do backup também é válido). Em lotes encerrados, o hash impresso no comprovante denuncia a troca |
| **O dono do lance e a contabilidade fora do hash** | `bidderId`, o líder atual, os saldos e o extrato ficam fora da cadeia. A auditoria cobre o histórico de lances, não a contabilidade |
| **Pseudônimo com colisão possível** | 4 caracteres hexadecimais: dois licitantes do mesmo lote podem, raramente, ter o mesmo |
| **Cache da FIPE na memória do processo** | Zera a cada reinício ou deploy da API, e a primeira consulta volta a gastar cota. Se o cache esvaziar e a FIPE cair, o Criar lote mostra erro e o resto do app segue |
| **Nem todo carro tem foto** | Nem todo modelo tem artigo na Wikipedia. Sem foto, vale a ilustração padrão. As imagens têm licença Creative Commons, com crédito |
| **Limites de requisição por IP** | Login e cadastro (30/min), auditoria (60/min). Atrás do proxy do Railway o IP vem de `X-Forwarded-For`; numa rede corporativa com IP compartilhado, quem avalia pode receber "muitas requisições" e basta esperar um minuto |
| **Hibernação** | Não existe no Railway. Quem hospedar num plano que dorme pode usar um ping externo em `/health`; não está configurado aqui |
| **Seed só em banco vazio** | Para recomeçar do zero use o [`seed:reset`](#recomeçar-do-zero-seedreset) (apaga tudo, com confirmação) ou, em ambiente local, `docker compose down -v`. O `seed:demo` cria um lote novo, mas nunca recria lotes antigos |
| **Conferência manual com leitor de tela e aparelhos reais** | Foi feita na Sala, no Comprovante e na Carteira. As demais telas foram verificadas por teclado, axe-core e Chrome real (de 320 a 768 px), sem leitor de tela |
| **Itens adiados nas revisões** | Achados de code review que escolhi adiar, cada um com onde está e o que fecharia, estão em [`deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md) |

Outras escolhas que podem surpreender na primeira vez:

1. **Prorrogação:** o novo fim é o horário do lance + 2 min (interpretação adotada do enunciado), sem teto de prorrogações.
2. **Apuração:** o fechamento roda a cada 5 s, então entre `00:00` e o resultado podem aparecer alguns segundos de "Apurando o resultado…".
3. **Segredos:** trocar `AUDIT_HMAC_KEY` invalida os históricos (todos aparecem como adulterados); trocar `JWT_SECRET` desloga todo mundo. Defina os dois uma vez, antes do primeiro seed.
4. **Rede restrita:** se o WebSocket for bloqueado, o Socket.IO usa long-polling e a Sala segue pelo snapshot HTTP.
5. **Corpo de requisição** acima de 100 KB volta `413`.

---

## Uso de IA

O desafio permite IA e pede transparência. A resposta completa, com as ferramentas, as etapas, o que decidi e como conduzi a IA, está em **[USO_DE_IA.md](USO_DE_IA.md)**.

O resumo: usei o **Claude Code**, com o **BMad Method**, para planejar junto comigo (PRD, UX, arquitetura e a SPEC dividida em fatias) e para me ajudar a implementar, uma fatia por vez, com revisão de código e conferência no navegador. O **Claude Design** me deu uma boa base visual, e eu alterei o que achei justo e válido, conforme o meu gosto. **As decisões foram minhas**, e cada uma das principais está na seção acima, com a alternativa que descartei e o motivo. Os artefatos do processo estão versionados em [`_bmad-output/`](_bmad-output/), com o [diário de progresso](_bmad-output/progresso.md) que sustenta o relato.
