import { z } from "zod";

export const ERROR_CODES = [
  "BELOW_MINIMUM",
  "INSUFFICIENT_BALANCE",
  "ALREADY_WINNING",
  "LOT_NOT_STARTED",
  "LOT_ENDED",
  "LOT_CANCELLED",
  "LOT_CHANGED",
  "ROLE_NOT_ALLOWED",
  "FORBIDDEN",
  "UNAUTHENTICATED",
  "VALIDATION",
  "EMAIL_TAKEN",
  "INVALID_CREDENTIALS",
  "NOT_FOUND",
  "EXTERNAL_UNAVAILABLE",
  "INTERNAL",
  "RATE_LIMITED",
  "PAYLOAD_TOO_LARGE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Status HTTP de cada código de erro (INV-16). */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  BELOW_MINIMUM: 422,
  INSUFFICIENT_BALANCE: 422,
  ALREADY_WINNING: 409,
  LOT_NOT_STARTED: 409,
  LOT_ENDED: 409,
  LOT_CANCELLED: 409,
  LOT_CHANGED: 409,
  ROLE_NOT_ALLOWED: 403,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  VALIDATION: 400,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  NOT_FOUND: 404,
  EXTERNAL_UNAVAILABLE: 503,
  INTERNAL: 500,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
};

export const INTERNAL_ERROR_MESSAGE = "Algo travou do nosso lado. Tente de novo em instantes.";
export const PAYLOAD_TOO_LARGE_MESSAGE = "A requisição passou de 100 KB. Envie menos dados.";
export const RATE_LIMITED_MESSAGE = "Calma, uma coisa de cada vez. Tente de novo em instantes.";

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
