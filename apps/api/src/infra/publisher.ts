import type { Server } from "socket.io";
import type { DomainEvent } from "@lanceauto/shared";
import type { Clock } from "./clock";
import type { Logger } from "./logger";

/** Entrega eventos de domínio depois do commit (INV-4). */
export interface Publisher {
  publish(events: DomainEvent[]): void;
}

/** Descarta. Testes e seed, onde ninguém está ouvindo. */
export class NoopPublisher implements Publisher {
  publish(_events: DomainEvent[]): void {
    // descarta
  }
}

/**
 * Publisher do Socket.IO. É o único lugar que carimba `serverTime` nos payloads (R-4.3). Um evento que falha ao
 * emitir é logado e não impede os seguintes (R-4.2).
 */
export class SocketPublisher implements Publisher {
  constructor(
    private readonly io: Server,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  publish(events: DomainEvent[]): void {
    for (const event of events) {
      try {
        const payload = { ...(event.payload as Record<string, unknown>), serverTime: this.clock.now().toISOString() };
        this.io.to(event.room).emit(event.type, payload);
      } catch (err) {
        this.logger.error({ err, event: event.type, room: event.room }, "falha ao emitir evento");
      }
    }
  }
}

/**
 * Falha ao publicar nunca derruba a requisição já confirmada: o commit aconteceu, o cliente tem de receber a
 * resposta de sucesso (R-4.2). Registra e segue.
 */
export function guardPublisher(publisher: Publisher, logger: Logger): Publisher {
  return {
    publish(events) {
      try {
        publisher.publish(events);
      } catch (err) {
        logger.error({ err, events: events.map((event) => event.type) }, "falha ao publicar eventos depois do commit");
      }
    },
  };
}
