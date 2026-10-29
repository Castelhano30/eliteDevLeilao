# LanceAuto

Casa de leilões online de carros: leiloeiros montam lotes a partir de carros da tabela FIPE, licitantes com saldo simulado disputam cada lote com lances ao vivo, o vencedor recebe um comprovante compartilhável e qualquer pessoa pode auditar o histórico de um lote. Teste técnico Elite Dev (Verzel).

## Índice

1. [Visão geral e contas de teste](#1-visão-geral-e-contas-de-teste)
2. [Stack e decisões](#2-stack-e-decisões)
3. [Pré-requisitos e variáveis](#3-pré-requisitos-e-variáveis)
4. [Banco de dados e seed](#4-banco-de-dados-e-seed)
5. [Como rodar](#5-como-rodar)
6. [Testes](#6-testes)
7. [Anti-adulteração do histórico](#7-anti-adulteração-do-histórico)
8. [Comportamentos inesperados e limitações](#8-comportamentos-inesperados-e-limitações)

Entre os itens 6 e 8 ficam as seções de detalhe: lances, tempo real, fechamento, cancelamento, Meus arremates, catálogo e deploy.

## 1. Visão geral e contas de teste

- **Web:** https://lanceautoweb-production.up.railway.app
- **API:** https://lanceautoapi-production.up.railway.app (teste em `/health`)
- **Documentação da API (Swagger):** https://lanceautoapi-production.up.railway.app/docs (o JSON OpenAPI está em `/docs/openapi.json`)

Contas de teste (senha de todas: `lance1234`, pública de propósito: é dado de teste):

| Papel | E-mail | Saldo inicial |
|---|---|---|
| Leiloeiro | leiloeiro@lanceauto.test | — (recebe os créditos das vendas) |
| Licitante | ana@lanceauto.test | R$ 500.000,00 |
| Licitante | bruno@lanceauto.test | R$ 300.000,00 |

Na tela de entrar, a aba "Entrar" lista as três contas: um clique preenche e-mail e senha.

**Roteiro de 5 passos para testar**

1. Abra a Vitrine, sem login. Ela mostra lotes ao vivo, agendado e encerrados (os cancelados nunca aparecem). Alterne o tema claro/noite no cabeçalho.
2. Entre como **Ana**, abra o lote ao vivo (Fiat Uno Mille Way 2010) e dê um lance. A Ana entra "superada": o Bruno lidera.
3. Em outra janela anônima, entre como **Bruno** na mesma Sala. O lance da Ana aparece sem recarregar, e o valor do lance dela fica comprometido no saldo, voltando ao disponível quando ela é superada.
4. Entre como **leiloeiro**, crie um lote (Painel → Criar lote, com a tabela FIPE), veja-o no Painel e cancele.
5. Sem login, abra o comprovante do lote arrematado (Ana → Meus arremates → "Ver comprovante") e a auditoria do lote (link "Auditar este lote" na Sala). A auditoria deve dizer "íntegro".

## 2. Stack e decisões

- Web: Next.js (App Router), React, TypeScript, Tailwind, TanStack Query, Socket.IO client
- API: Node, Express, Socket.IO, Prisma, zod
- Banco: PostgreSQL 16
- Monorepo com npm workspaces: `apps/web`, `apps/api`, `packages/shared` (contratos zod, tipos e textos canônicos; o web nunca importa a API)
- Testes: Vitest. Hospedagem: Railway (web, API e Postgres no mesmo projeto)

Decisões de produto e de engenharia:

- **Prorrogação:** lance nos últimos 2 minutos leva o fim a *hora do lance + 2 min*, sem teto.
- **Posição:** o maior lance de cada licitante, contado uma vez ("2º de 4").
- **Cancelamento com lances:** o líder é estornado e o cancelamento entra no histórico (linha CANCEL na cadeia).
- **Sem edição de lote agendado:** só cancelar. Depósito máximo de R$ 10.000.000,00 por operação.
- **Imagem:** sugerida pela Wikipedia, editável pelo leiloeiro; baixada na criação e guardada no banco.
- **Dinheiro em centavos inteiros** (`BigInt` no banco, `number` nas bordas); a interface mostra reais inteiros. **Datas em UTC**, exibidas em Brasília.
- **Pseudônimo por lote:** "Licitante 7F3A" muda de lote para lote; nenhuma resposta pública traz nome, e-mail ou id de usuário.
- **Autenticação:** JWT em `localStorage` (7 dias), um papel por conta, autorização no back-end.
- **Monólito modular, um processo:** a API serve REST e Socket.IO juntos. O servidor é a verdade de tempo, saldo e valor: sem atualização otimista.

## 3. Pré-requisitos e variáveis

Node 22.12 ou superior (testado no 24), npm, Docker (opcional, para o Compose e o banco local) e PostgreSQL 16 ou superior. Copie `.env.example` para `.env` e ajuste: `cp .env.example .env`. O `.env` nunca é versionado.

| Variável | Para que serve |
|---|---|
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

Gere segredos fortes com `openssl rand -hex 32`. O [.env.example](.env.example) está completo e comentado, com valores de desenvolvimento que funcionam com o Compose.

## 4. Banco de dados e seed

Com o Docker: `docker compose up -d db` (Postgres na porta 5433 do host). Sem Docker, crie um banco e aponte `DATABASE_URL` e `DIRECT_URL` para ele. Depois:

```bash
npm run prisma:generate -w apps/api   # gera o client do Prisma
npm run migrate:deploy -w apps/api    # aplica as migrações
npm run seed                          # contas e lotes de demonstração
npm run seed:demo                     # (opcional) mais um lote ao vivo
```

`npm run seed` cria, **só pelos services da aplicação e sem nenhuma requisição de rede** (usa [apps/api/prisma/fipe-fixture.json](apps/api/prisma/fipe-fixture.json)), as três contas com os saldos da tabela acima e cinco lotes, numerados na ordem de criação:

| Lote | Estado | O que mostra |
|---|---|---|
| 001 | Encerrado, arrematado pela Ana | 4 lances, o último nos 2 minutos finais (prorrogou); comprovante, "Meus arremates" e total recebido |
| 002 | Encerrado, sem lances | Carimbo "Sem lances" e auditoria sem corrente |
| 003 | Cancelado | Bruno liderava: estorno no extrato e linha CANCEL na auditoria; some da Vitrine |
| 004 | Agendado | Abre em 2 dias |
| 005 | Ao vivo por 30 dias | 5 lances de Ana e Bruno; o Bruno termina na frente, então a Ana entra "superada" e pode cobrir |

O passado é fabricado com um relógio simulado e `createLot({ allowPast })`, que só o seed usa. Por isso as cadeias de hash nascem válidas e a auditoria responde "íntegro" em todos.

- **Seguro a cada deploy:** se já existem usuários, o seed não faz nada, imprime `seed ignorado: já existem usuários` e sai com código 0. Nunca apaga dados. Duas execuções ao mesmo tempo não se atropelam (`pg_advisory_lock`).
- **`npm run seed:demo`** cria um lote ao vivo **novo** (30 dias, 5 lances de Ana e Bruno) sem tocar nos demais e, se o saldo disponível de um deles estiver abaixo de R$ 100.000,00, deposita a diferença (aparece no extrato como depósito). Imprime o número e a URL do lote. Rode quando o lote ao vivo expirar.
- **Defina `AUDIT_HMAC_KEY` e `JWT_SECRET` uma vez, antes do primeiro seed.** Trocar a chave HMAC depois faz todos os históricos aparecerem como adulterados.

## 5. Como rodar

**Com Docker Compose** (sobe banco, API e web; migrações e seed rodam no primeiro start da API):

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000 (mude com `WEB_PORT` e ajuste `WEB_ORIGIN` no `.env` para a mesma porta, senão o CORS recusa a API)
- API: http://localhost:4000, teste em `/health` (muda com `PORT`); documentação Swagger em `/docs`
- Postgres: `localhost:5433`
- Para parar: `docker compose down`. Para apagar também o banco: `docker compose down -v`.

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

| Comando | O que faz |
|---|---|
| `npm run dev` | shared (watch), API e web em modo desenvolvimento |
| `npm run build` | build na ordem shared, api, web |
| `npm run lint` / `npm run typecheck` | ESLint; tipos dos três pacotes |
| `npm test` | testes dos três pacotes |
| `npm run seed` / `npm run seed:demo` | ver o item 4 |

## 6. Testes

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

## Lances (regras e transação)

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
- **Seed:** `npm run seed` cria, pelos mesmos services e com relógio simulado, o lote 001 **arrematado** pela Ana (4 lances, o último a menos de 2 minutos do fim, então prorrogado) e o 002 **encerrado sem lances**, e imprime o link do comprovante de demonstração (`Comprovante de demonstração: /c/…`). Entre como Ana, abra o lote arrematado em Meus arremates e use "Ver comprovante" (ver o item 4).
- **Vitrine apurando:** um cartão cujo fim passou e que o servidor ainda não encerrou fica em "Ao vivo" com "Apurando o resultado…"; a lista é refeita a cada 3 s, com teto de 20 respostas, e o `showcase:lot` do fechamento o move para "Encerrados" e zera a conta.

## Cancelamento com estorno e linha CANCEL na auditoria

O leiloeiro dono cancela qualquer lote seu **agendado ou ao vivo, com ou sem lances** (`POST /lots/:id/cancel`, corpo `{ "confirmEntryCount": N }`). Não existe editar nem reabrir: depois de agendado só existe "Cancelar". Tudo acontece numa transação: o lote é travado (`FOR UPDATE`), o `now` é lido depois do lock, e na ordem da fatia a API confere dono, se já foi cancelado (`LOT_CANCELLED`), se o fim já passou ou o lote já liquidou (`LOT_ENDED`) e a contagem. Se havia líder, a carteira dele é travada e o comprometido do lance atual volta ao disponível (`REFUND` no extrato, o total não muda); só o líder atual tem saldo comprometido no lote, quem foi superado já foi liberado por `RELEASE`.

- **Linha CANCEL na cadeia:** o cancelamento entra como linha própria do histórico (`kind=CANCEL`, `seq = entryCount + 1`, sem autor, pseudônimo nem valor), com hash `HMAC(chave, "v1|entry|{lotId}|{seq}|CANCEL|||{at}|{prevHash}")`, e o selo passa a contar essa linha. É gravada **sempre**, com ou sem lances, e conta no veredito da auditoria. A Sala nunca a mostra (`bids[]` é só `BID`); a página de Auditoria a exibe como "Cancelado pelo leiloeiro".
- **Corrida do diálogo (`confirmEntryCount`):** o diálogo mostra "Cancelar o lote 019 com 2 lances?" e envia essa contagem. Se entrou lance enquanto o leiloeiro decidia, o servidor responde `LOT_CHANGED` com a contagem real e **nada muda**; o mesmo diálogo se atualiza e pede a confirmação de novo, e o estorno vai para o líder novo. Cancelar × lance serializam pelo lock do lote: ou o lance entra antes (e o cancelamento recebe `LOT_CHANGED`) ou o cancelamento entra antes (e o lance recebe `LOT_CANCELLED`, sem `HOLD`). Nunca sobra saldo comprometido em lote cancelado.
- **O que cada tela vê:** o lote some da Vitrine por `showcase:lot` (nunca vem em `GET /lots`); a Sala continua respondendo pela URL e vira "Cancelado" sem recarregar, sem formulário; o chip e a Carteira de quem liderava voltam ao disponível por `wallet:updated`; no Painel a linha só muda para "Cancelados" quando o servidor confirma (sem atualização otimista), com o estorno e o horário. O job de fechamento nunca liquida lote cancelado.
- **Rede ambígua:** se a resposta do cancelamento se perde, o diálogo não reenvia sozinho; ao tentar de novo ele primeiro refaz `GET /my/lots` e, se o lote já está cancelado, trata como sucesso.
- **Seed:** o lote 003 é cancelado pelos mesmos services (Ana abre, Bruno cobre e lidera, cancelamento com `confirmEntryCount = 2`): estorno ao Bruno e linha CANCEL `seq = 3`. O comprometido de cada carteira continua igual à soma dos lances dos lotes ao vivo que ela lidera.

## Meus arremates

O licitante vê em `/arremates` (item "Meus arremates" no cabeçalho) todos os lotes em que deu lance, cada um num ingresso com o seu estado: **Ganhando**, **Superado**, **Arrematado**, **Perdido** ou **Cancelado**. `GET /me/bids` (só `BIDDER`) devolve a lista já ordenada e com o `state` pronto, calculado pelo servidor só com as colunas do banco; o cliente não decide estado nem reordena.

- **Perdido** é o lote que **encerrou e foi liquidado** com outra pessoa vencendo. **Cancelado nunca é Perdido**: `cancelledAt` vence tudo, aparece só na aba "Todos" e, se a pessoa liderava, a frase diz que o saldo voltou.
- **Apurando:** entre o fim do relógio e a liquidação o `state` segue Ganhando/Superado, mas a tela troca o selo por "APURANDO" e a frase "Martelo batido. Apurando o resultado…", sem posição e sem "Cobrir lance" (o lance já está bloqueado). Só esse rótulo é derivado no navegador, com `lotStatus` e o relógio do servidor; quando a liquidação sai, o `showcase:lot` refaz a lista e o ingresso vira Arrematado ou Perdido.
- **Posição:** "é o 2º maior de 3" conta licitantes distintos pelo maior lance de cada um (o mesmo `rankFrom` da Sala). O token do comprovante só vem no ingresso Arrematado e só do próprio `Receipt`; "Ver comprovante" abre em outra guia e "Copiar link" copia `{origem}/c/{token}`.
- **Tempo real:** a lista só muda com a resposta do `GET`. Evento de lote que não está na lista é ignorado, versão velha é descartada, rajadas viram uma consulta (300 ms), e `wallet:updated` e a reconexão do socket também refazem. Os anúncios da região viva ("Lote 018: você foi superado.") só saem entre duas respostas do servidor, nunca na carga inicial.
- Na Carteira, cada lote de "Travado onde você lidera" leva ao ingresso (`/arremates#lote-018`). Os ingressos Perdido e Cancelado têm "Conferir na auditoria" (`/lotes/<id>/auditoria`).

## 7. Anti-adulteração do histórico

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
3. API com todas as variáveis da tabela do item 3; `WEB_ORIGIN` igual à origem exata do web; comando de start com `migrate deploy` e seed; `trust proxy` ativo em produção.
4. Web com `NEXT_PUBLIC_API_URL` apontando para o domínio público da API.
5. `JWT_SECRET` e `AUDIT_HMAC_KEY` fortes, definidos **antes** do primeiro seed e guardados em local seguro.
6. `GET /health` devolve `{"ok":true,"db":true}`.
7. Smoke pelo link público: login como Ana, Bruno e leiloeiro, lance, Sala ao vivo em duas janelas, comprovante, auditoria e Criar lote com a FIPE real.
8. Console do navegador sem erro de CORS nem de WebSocket.

## 8. Comportamentos inesperados e limitações

1. **Prorrogação:** o novo fim é o horário do lance + 2 min (interpretação adotada do enunciado), sem teto de prorrogações.
2. **Hospedagem sem hibernação:** a API roda no Railway como processo contínuo, então não há cold start de socket. Um deploy ou reinício derruba os sockets por alguns segundos; os navegadores reconectam sozinhos. Se a API ficar parada, o timer de fechamento para, e a varredura de boot liquida o atraso. Para quem hospedar num plano que dorme, um ping externo (UptimeRobot e semelhantes) em `/health` evita a hibernação; não está configurado aqui.
3. **Limite da FIPE:** 500 requisições por dia sem token (mais com um token gratuito); por isso o cache de 24 h, em memória (zera a cada reinício da API). Se o cache esvaziar e a FIPE cair, o Criar lote mostra erro e o resto do app segue.
4. **Carros sem imagem:** nem todo modelo tem artigo ou foto na Wikipedia; o nome da FIPE é simplificado para buscar; sem foto usa a ilustração padrão; as imagens têm licença Creative Commons, com crédito.
5. **Auditoria:** limites listados no item 7 (quem tem a chave, backup antigo e completo, troca de `AUDIT_HMAC_KEY`).
6. **Apuração:** o fechamento roda a cada 5 s, então entre `00:00` e o resultado podem aparecer alguns segundos de "Apurando o resultado…".
7. **Pseudônimo:** 4 caracteres hexadecimais; colisão entre dois licitantes do mesmo lote é rara, mas possível.
8. **Uma instância da API:** Socket.IO sem adaptador; escalar para mais instâncias exigiria Redis.
9. **Autenticação:** sem recuperação de senha (por escolha); JWT de 7 dias em `localStorage`; um papel por conta.
10. **Saldo simulado:** sem pagamento real; depósito máximo de R$ 10.000.000,00 por operação.
11. **Valores e horários:** a interface mostra reais inteiros e horários de Brasília; internamente são centavos e UTC.
12. **Lote agendado não pode ser editado**, só cancelado.
13. **Segredos:** trocar `AUDIT_HMAC_KEY` invalida os históricos; trocar `JWT_SECRET` desloga todos.
14. **Rede restrita:** se o WebSocket for bloqueado, o Socket.IO usa long-polling e a Sala segue pelo snapshot HTTP.
15. **Limites de requisição:** login e cadastro (30/min por IP), lances (30/min por usuário), criação de lote (10/min por leiloeiro) e auditoria (60/min por IP). Atrás do proxy do Railway o IP vem de `X-Forwarded-For` (`trust proxy` = 1); numa rede corporativa com IP compartilhado, o avaliador pode, raramente, receber "muitas requisições" e deve esperar um minuto. Corpo de requisição acima de 100 KB volta 413.
16. **Limites da auditoria:** o dono de um lance (`bidderId`) e a contabilidade (saldos e extrato) ficam fora do hash; ver o item 7.
17. **Seed e produção:** o seed só age em banco sem usuários. Para recomeçar do zero é preciso esvaziar o banco (por exemplo `docker compose down -v` no Compose); `seed:demo` nunca recria lotes antigos.
