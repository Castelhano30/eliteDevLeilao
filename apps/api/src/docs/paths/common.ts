import type { ResponseConfig } from "@asteasolutions/zod-to-openapi";
import { ERROR_HTTP_STATUS, type ErrorCode } from "@lanceauto/shared";
import { AppError } from "../../errors";
import { BEARER } from "../registry";
import { errorEnvelopeDoc } from "../schemas";

export const TAGS = {
  auth: "Auth",
  account: "Conta",
  catalog: "Catálogo",
  lots: "Lotes",
  bids: "Lances",
  receipt: "Comprovante",
  audit: "Auditoria",
  health: "Saúde",
} as const;

/** Descrição de cada tag, na ordem em que aparecem na Swagger UI. */
export const TAG_DESCRIPTIONS: Array<{ name: string; description: string }> = [
  { name: TAGS.auth, description: "Cadastro e login. Os dois devolvem o JWT que as demais rotas pedem." },
  { name: TAGS.account, description: "O usuário logado: perfil, carteira simulada, extrato e depósitos." },
  { name: TAGS.catalog, description: "Tabela FIPE e sugestão de foto, só para o leiloeiro montar um lote. Única parte que chama serviços externos." },
  { name: TAGS.lots, description: "Vitrine, Sala, criação e cancelamento de lotes, Painel do leiloeiro e fotos dos carros." },
  { name: TAGS.bids, description: "Lances e Meus arremates do licitante." },
  { name: TAGS.receipt, description: "Comprovante público do arremate, aberto pelo token do link." },
  { name: TAGS.audit, description: "Auditoria pública de um lote: refaz a cadeia HMAC-SHA256 e devolve o veredito." },
  { name: TAGS.health, description: "Verificação de vida do processo e do banco." },
];

/** `security` das rotas que exigem login. */
export const REQUIRES_AUTH: Array<Record<string, string[]>> = [{ [BEARER]: [] }];
/** `security` das rotas com login opcional: o `{}` diz que também vale sem credencial. */
export const OPTIONAL_AUTH: Array<Record<string, string[]>> = [{}, { [BEARER]: [] }];

export interface ErrorSpec {
  code: ErrorCode;
  /** Mensagem do exemplo, quando a rota troca o texto padrão. */
  message?: string;
  details?: unknown;
}

type ErrorInput = ErrorCode | ErrorSpec;

const VALIDATION_DETAILS = { fields: { campo: "Mensagem do campo com erro." } };

/**
 * Respostas de erro agrupadas por status HTTP (o de `ERROR_HTTP_STATUS`), cada uma no envelope de INV-16, com um
 * exemplo por código (a mensagem padrão vem do próprio `AppError`). `INTERNAL` entra sempre.
 */
export function errorResponses(...inputs: ErrorInput[]): Record<string, ResponseConfig> {
  const specs = [...inputs, "INTERNAL" as const].map((input): ErrorSpec => (typeof input === "string" ? { code: input } : input));
  const byStatus = new Map<number, ErrorSpec[]>();
  for (const spec of specs) {
    const status = ERROR_HTTP_STATUS[spec.code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), spec]);
  }
  const out: Record<string, ResponseConfig> = {};
  for (const [status, list] of [...byStatus].sort(([a], [b]) => a - b)) {
    const examples = Object.fromEntries(
      list.map(({ code, message, details }) => {
        const error = new AppError(code, details ?? (code === "VALIDATION" ? VALIDATION_DETAILS : undefined), message);
        return [code, { summary: code, value: error.toEnvelope() }];
      }),
    );
    out[String(status)] = {
      description: `Erro ${list.map(({ code }) => `\`${code}\``).join(", ")}.`,
      content: { "application/json": { schema: errorEnvelopeDoc, examples } },
    };
  }
  return out;
}
