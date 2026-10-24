import { Server } from "socket.io";
import { EVENTS, type LotJoinAck } from "@lanceauto/shared";
import { verifyToken, type AuthUser } from "./auth/token";
import { AppError } from "./errors";
import type { Logger } from "./infra/logger";
import type { LotService } from "./services/lot.service";

/** Sala privada do usuário: só o servidor a atribui, a partir do JWT (R-4.4). */
export const userRoom = (userId: string) => `user:${userId}`;
export const lotRoom = (lotId: string) => `lot:${lotId}`;
export const SHOWCASE_ROOM = "showcase";

/**
 * Queda detectada em até ~20 s (10 + 10). Os padrões do Socket.IO (25 + 20) deixariam a Sala parecendo viva por até
 * 45 s depois de a rede cair.
 */
export const PING_INTERVAL_MS = 10_000;
export const PING_TIMEOUT_MS = 10_000;

/** Ids de lote são texto curto; o formato mantém lixo e nomes de sala alheios fora do `join`. */
const LOT_ID = /^[\w-]{1,64}$/;

const NOT_FOUND: LotJoinAck = { ok: false, error: { code: "NOT_FOUND" } };

export interface SocketDeps {
  jwtSecret: string;
  lots: Pick<LotService, "getLotState">;
  logger: Logger;
}

/** Servidor Socket.IO ainda sem http: o `io` precisa existir antes do app, que recebe o `Publisher` dele. */
export function createSocketServer({ webOrigin }: { webOrigin: string }): Server {
  return new Server({ cors: { origin: webOrigin }, pingInterval: PING_INTERVAL_MS, pingTimeout: PING_TIMEOUT_MS });
}

function lotIdOf(payload: unknown): string | null {
  const lotId = typeof payload === "object" && payload !== null ? (payload as { lotId?: unknown }).lotId : undefined;
  return typeof lotId === "string" && LOT_ID.test(lotId) ? lotId : null;
}

/**
 * Só transmite (INV-4). Token válido no handshake entra em `user:{id}`; ausente, inválido ou expirado segue como
 * visitante, sem erro (R-1.12). O cliente só consegue entrar em `lot:*` e `showcase`; qualquer outro evento é ignorado.
 */
export function registerSocketHandlers(io: Server, { jwtSecret, lots, logger }: SocketDeps): void {
  io.on("connection", (socket) => {
    const user: AuthUser | null = verifyToken(jwtSecret, (socket.handshake.auth as { token?: unknown } | undefined)?.token);
    if (user) void socket.join(userRoom(user.id));

    socket.on(EVENTS.LOT_JOIN, async (payload: unknown, ack?: unknown) => {
      const reply = (response: LotJoinAck) => {
        if (typeof ack === "function") (ack as (response: LotJoinAck) => void)(response);
      };
      const lotId = lotIdOf(payload);
      if (lotId === null) return reply(NOT_FOUND);
      // Entra na sala antes de montar o snapshot: um lance entre os dois chega como evento, não se perde (R-4.8).
      await socket.join(lotRoom(lotId));
      try {
        reply({ ok: true, lot: await lots.getLotState(lotId, user ?? undefined) });
      } catch (err) {
        if (err instanceof AppError && err.code === "NOT_FOUND") {
          await socket.leave(lotRoom(lotId));
          return reply(NOT_FOUND);
        }
        logger.error({ err, lotId }, "falha ao montar o snapshot do lot:join");
        reply({ ok: false, error: { code: "INTERNAL" } });
      }
    });

    socket.on(EVENTS.LOT_LEAVE, (payload: unknown) => {
      const lotId = lotIdOf(payload);
      if (lotId !== null) void socket.leave(lotRoom(lotId));
    });

    socket.on(EVENTS.SHOWCASE_JOIN, () => {
      void socket.join(SHOWCASE_ROOM);
    });
  });
}
