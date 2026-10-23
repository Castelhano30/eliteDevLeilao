import type { DomainEvent } from "@lanceauto/shared";

/** Entrega eventos de domínio depois do commit. A S04 troca por uma versão com Socket.IO. */
export interface Publisher {
  publish(events: DomainEvent[]): void;
}

export class NoopPublisher implements Publisher {
  publish(_events: DomainEvent[]): void {
    // descarta
  }
}
