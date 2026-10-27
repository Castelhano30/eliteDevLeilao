import type { ErrorRequestHandler, RequestHandler } from "express";
import {
  ERROR_HTTP_STATUS,
  INTERNAL_ERROR_MESSAGE,
  PAYLOAD_TOO_LARGE_MESSAGE,
  RATE_LIMITED_MESSAGE,
  type ErrorCode,
  type ErrorEnvelope,
} from "@lanceauto/shared";

/** Mensagens padrão em pt-BR (INV-16). Cada rota pode sobrescrever com o texto exato da regra. */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  BELOW_MINIMUM: "O lance está abaixo do mínimo aceito.",
  INSUFFICIENT_BALANCE: "Saldo disponível insuficiente para este lance.",
  ALREADY_WINNING: "Você já está na frente neste lote.",
  LOT_NOT_STARTED: "Este lote ainda não começou.",
  LOT_ENDED: "Este lote já encerrou.",
  LOT_CANCELLED: "Este lote foi cancelado pelo leiloeiro.",
  LOT_CHANGED: "O lote mudou desde a última vez que você viu.",
  ROLE_NOT_ALLOWED: "Seu papel nesta conta não permite essa ação.",
  FORBIDDEN: "Você não tem permissão para isso.",
  UNAUTHENTICATED: "Entre na sua conta para continuar.",
  VALIDATION: "Confira os campos e tente de novo.",
  EMAIL_TAKEN: "Já existe uma conta com este e-mail.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  NOT_FOUND: "Não encontramos o que você procurou.",
  EXTERNAL_UNAVAILABLE: "Um serviço externo não respondeu. Tente de novo em instantes.",
  INTERNAL: INTERNAL_ERROR_MESSAGE,
  RATE_LIMITED: RATE_LIMITED_MESSAGE,
  PAYLOAD_TOO_LARGE: PAYLOAD_TOO_LARGE_MESSAGE,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: unknown,
    message?: string,
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.status = ERROR_HTTP_STATUS[code];
  }

  toEnvelope(): ErrorEnvelope {
    const error: ErrorEnvelope["error"] = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("NOT_FOUND"));
};

function isBodyParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed";
}

function isBodyTooLarge(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large";
}

/** Toda resposta de erro sai no envelope; o inesperado vira INTERNAL sem stack para o cliente. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(err.toEnvelope());
    return;
  }
  if (isBodyParseError(err)) {
    const invalidJson = new AppError("VALIDATION", undefined, "O corpo da requisição não é um JSON válido.");
    res.status(invalidJson.status).json(invalidJson.toEnvelope());
    return;
  }
  if (isBodyTooLarge(err)) {
    const tooLarge = new AppError("PAYLOAD_TOO_LARGE");
    res.status(tooLarge.status).json(tooLarge.toEnvelope());
    return;
  }
  req.log.error({ err, requestId: req.id }, "erro não tratado");
  const internal = new AppError("INTERNAL");
  res.status(internal.status).json(internal.toEnvelope());
};
