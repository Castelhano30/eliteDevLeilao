import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { EVENTS, MAX_DEPOSIT_CENTS, formatBRL } from "@lanceauto/shared";
import { registerAccountPaths } from "./paths/account";
import { registerBidPaths } from "./paths/bids";
import { registerCatalogPaths } from "./paths/catalog";
import { TAG_DESCRIPTIONS } from "./paths/common";
import { registerHealthPaths } from "./paths/health";
import { registerLotPaths } from "./paths/lots";
import { registerReceiptAuditPaths } from "./paths/receipt-audit";
import { registry } from "./registry";

/** Texto da descrição geral. Os nomes dos eventos vêm de `EVENTS`, os mesmos que o servidor emite. */
const DESCRIPTION = `
API REST do **LanceAuto**, uma casa de leilões de carros. Leiloeiros montam lotes a partir da tabela FIPE, licitantes com saldo simulado disputam cada lote com lances ao vivo, o vencedor recebe um comprovante público e qualquer pessoa pode auditar o histórico de um lote.

## Como testar em 3 passos

1. Abra **Auth → \`POST /auth/login\`** (ou crie uma conta em \`POST /auth/register\`), clique em **Try it out** e **Execute**. Copie o \`token\` da resposta.
2. Clique em **Authorize** (cadeado, no topo da página), cole **só o token**, sem o prefixo \`Bearer\`, e confirme.
3. Abra qualquer rota, clique em **Try it out** e depois em **Execute**. Rotas com cadeado exigem o passo 2; as demais são públicas.

## Papéis

Cada conta tem um único papel, e o servidor faz valer a regra em cada rota.

| Papel | Quem é | O que pode fazer |
|-------|--------|------------------|
| \`BIDDER\` | Licitante | Depositar saldo, dar lances, ver seus lances e arremates |
| \`AUCTIONEER\` | Leiloeiro | Criar e cancelar lotes, ver os próprios lotes |

Vitrine, detalhe do lote, comprovante e auditoria são públicos.

## Convenções

| Tema | Regra |
|------|-------|
| **Métodos** | Só \`GET\` e \`POST\`. Não há \`PUT\`, \`PATCH\` nem \`DELETE\`: um lance nunca é editado nem apagado (o histórico só cresce, para poder ser auditado), e as ações que mudam estado, como cancelar um lote, são \`POST\` próprios. |
| **Dinheiro** | Centavos inteiros, nos campos \`…Cents\` (R$ 31.000,00 = \`3100000\`). Um depósito vai até ${formatBRL(MAX_DEPOSIT_CENTS)}. |
| **Datas** | ISO 8601 em UTC, com milissegundos e \`Z\`. O relógio do servidor (\`serverTime\`) é a verdade de tempo. |
| **Ids** | Texto curto, não UUID. |
| **Limite de requisições** | As rotas com limite devolvem \`429\` com o código \`RATE_LIMITED\`. |

## Erros

Todo erro vem no mesmo envelope, com a mensagem em português. O status HTTP de cada código é fixo, e cada rota lista os que pode devolver.

\`\`\`json
{ "error": { "code": "BELOW_MINIMUM", "message": "…", "details": { } } }
\`\`\`

\`details\` só aparece quando ajuda, por exemplo com os campos inválidos de uma validação.

## Privacidade

Nenhuma resposta pública traz nome, e-mail ou id de usuário. Cada licitante aparece como \`Licitante XXXX\`, um pseudônimo diferente a cada lote. O token do comprovante só chega ao vencedor, em \`myReceiptToken\` (Sala) e \`receiptToken\` (Meus arremates).

## Tempo real (Socket.IO, fora deste documento)

O Socket.IO fica no mesmo endereço da API e só **transmite**: toda mutação é feita por REST, e os eventos saem depois do commit. Para identificar o usuário, conecte com \`auth: { token }\`; sem token, ou com token inválido, a conexão segue como visitante.

**Cliente para servidor**

| Evento | Envia | Efeito |
|--------|-------|--------|
| \`${EVENTS.LOT_JOIN}\` | \`{ lotId }\` e callback | Entra na sala do lote e recebe o mesmo \`LotState\` de \`GET /lots/{id}\`; se falhar, \`{ ok: false, error: { code } }\` com \`NOT_FOUND\` ou \`INTERNAL\`. |
| \`${EVENTS.LOT_LEAVE}\` | \`{ lotId }\` | Sai da sala do lote. |
| \`${EVENTS.SHOWCASE_JOIN}\` | nada | Entra na sala da Vitrine. |

**Servidor para cliente**

| Evento | Sala | Conteúdo |
|--------|------|----------|
| \`${EVENTS.BID_PLACED}\` | Lote | Novo lance: \`version\`, \`bid\`, \`currentBidCents\`, \`minimumBidCents\`, \`bidCount\`, \`bidderCount\`, \`endsAt\`, \`extended\` e \`serverTime\`. |
| \`${EVENTS.LOT_CLOSED}\` | Lote | O lote fechou: \`outcome\` \`SOLD\` ou \`UNSOLD\` e, se vendeu, o lance, o pseudônimo do vencedor e o hash final. Idempotente. |
| \`${EVENTS.LOT_CANCELLED}\` | Lote | O leiloeiro cancelou; refaça o \`GET /lots/{id}\`. |
| \`${EVENTS.SHOWCASE_LOT}\` | Vitrine | O cartão de um lote mudou: \`LotCard\` mais \`serverTime\`. |
| \`${EVENTS.WALLET_UPDATED}\` | Privada do usuário | A carteira mudou: \`Wallet\` mais \`serverTime\`. A sala é atribuída pelo servidor a partir do token. |

Os eventos de lote levam \`version\` (igual a \`entryCount\`): descarte o que chegar com versão menor que a que você já tem.
`.trim();

let cached: ReturnType<OpenApiGeneratorV31["generateDocument"]> | undefined;

/** O documento OpenAPI 3.1, gerado uma vez a partir dos zod do shared e dos esquemas de `schemas.ts`. */
export function buildOpenApiDocument() {
  if (cached) return cached;
  registerHealthPaths();
  registerAccountPaths();
  registerCatalogPaths();
  registerLotPaths();
  registerBidPaths();
  registerReceiptAuditPaths();
  cached = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "LanceAuto API",
      version: "1.0.0",
      description: DESCRIPTION,
    },
    // Relativo: o "Try it out" vale em qualquer host (local, Compose, produção).
    servers: [{ url: "/", description: "O mesmo endereço que serve esta página." }],
    tags: TAG_DESCRIPTIONS,
  });
  return cached;
}
