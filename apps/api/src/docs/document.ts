import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { EVENTS, MAX_DEPOSIT_CENTS } from "@lanceauto/shared";
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
API REST do **LanceAuto**, uma casa de leilões de carros. Leiloeiros montam lotes a partir da tabela FIPE; licitantes com saldo simulado disputam cada lote com lances ao vivo; o vencedor recebe um comprovante público; qualquer pessoa audita o histórico de um lote.

## Convenções

- **Dinheiro** sempre em centavos inteiros, nos campos \`…Cents\` (R$ 31.000,00 = \`3100000\`). Um depósito vai até ${MAX_DEPOSIT_CENTS} centavos (R$ 10.000.000,00).
- **Datas** em ISO 8601 UTC com milissegundos e \`Z\`. O relógio do servidor (\`serverTime\`) é a verdade de tempo; o cliente soma o desvio a cada resposta.
- **Ids** são texto curto, não UUID.
- **Autenticação:** JWT no cabeçalho \`Authorization: Bearer <token>\`, obtido em \`POST /auth/login\` ou \`POST /auth/register\`. Há dois papéis, \`BIDDER\` (licitante) e \`AUCTIONEER\` (leiloeiro), um por conta, e o servidor faz valer o papel. Use o botão **Authorize** para testar as rotas protegidas.
- **Erros** sempre no envelope \`{"error": {"code", "message", "details?"}}\`, com a mensagem em pt-BR. O status HTTP de cada código é fixo (ver as respostas de cada rota). As rotas com limite de requisições devolvem 429 \`RATE_LIMITED\`.
- **Privacidade:** nenhuma resposta pública traz nome, e-mail ou id de usuário. Cada licitante aparece como \`Licitante XXXX\`, um pseudônimo diferente a cada lote. O token do comprovante só chega ao vencedor, em \`myReceiptToken\` (Sala) e \`receiptToken\` (Meus arremates).

## Tempo real (Socket.IO, fora deste documento)

O Socket.IO fica no mesmo endereço da API e só **transmite**: toda mutação é feita por REST, e os eventos saem depois do commit. Para identificar o usuário, conecte com \`auth: { token }\`; sem token ou com token inválido a conexão segue como visitante.

Cliente para servidor:

- \`${EVENTS.LOT_JOIN}\` com \`{ lotId }\` e callback de confirmação: entra na sala do lote e recebe o mesmo \`LotState\` de \`GET /lots/{id}\`, ou \`{ ok: false, error: { code: "NOT_FOUND" | "INTERNAL" } }\`.
- \`${EVENTS.LOT_LEAVE}\` com \`{ lotId }\`: sai da sala do lote.
- \`${EVENTS.SHOWCASE_JOIN}\`: entra na sala da Vitrine.

Servidor para cliente:

- \`${EVENTS.BID_PLACED}\` (sala do lote): novo lance, com \`version\`, \`bid\`, \`currentBidCents\`, \`minimumBidCents\`, \`bidCount\`, \`bidderCount\`, \`endsAt\`, \`extended\` e \`serverTime\`.
- \`${EVENTS.LOT_CLOSED}\` (sala do lote): o lote fechou, com \`outcome\` \`SOLD\` ou \`UNSOLD\`, e o lance, o pseudônimo do vencedor e o hash final quando houve venda. Idempotente.
- \`${EVENTS.LOT_CANCELLED}\` (sala do lote): o leiloeiro cancelou; refaça o \`GET /lots/{id}\`.
- \`${EVENTS.SHOWCASE_LOT}\` (sala da Vitrine): o cartão de um lote mudou, no formato \`LotCard\` mais \`serverTime\`.
- \`${EVENTS.WALLET_UPDATED}\` (sala privada do usuário, atribuída pelo servidor a partir do token): a carteira mudou, no formato \`Wallet\` mais \`serverTime\`.

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
