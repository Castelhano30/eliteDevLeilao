import type { Server } from "socket.io";
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@lanceauto/shared";
import { FakeClock } from "./clock";
import { createLogger } from "./logger";
import { SocketPublisher, guardPublisher } from "./publisher";

interface Emission {
  room: string;
  type: string;
  payload: unknown;
}

/** `Server` falso que anota o que sairia; `failOn` faz o emit daquela sala lançar. */
function fakeIo(failOn?: string) {
  const emitted: Emission[] = [];
  const io = {
    to(room: string) {
      return {
        emit(type: string, payload: unknown) {
          if (room === failOn) throw new Error("serialização falhou");
          emitted.push({ room, type, payload });
        },
      };
    },
  } as unknown as Server;
  return { io, emitted };
}

function capture() {
  const lines: string[] = [];
  return { lines, logger: createLogger("error", { write: (chunk: string) => void lines.push(chunk) }) };
}

const event = (type: DomainEvent["type"], room: string, payload: unknown): DomainEvent => ({ type, room, payload });

describe("SocketPublisher", () => {
  it("emite na sala do evento com o serverTime do relógio, sem mexer no payload original", () => {
    const { io, emitted } = fakeIo();
    const clock = new FakeClock("2026-10-24T18:58:49.123Z");
    const original = { lotId: "L1", version: 3 };
    new SocketPublisher(io, clock, createLogger("silent")).publish([event("bid:placed", "lot:L1", original)]);

    expect(emitted).toEqual([
      { room: "lot:L1", type: "bid:placed", payload: { lotId: "L1", version: 3, serverTime: "2026-10-24T18:58:49.123Z" } },
    ]);
    expect(original).toEqual({ lotId: "L1", version: 3 });
  });

  it("carimba na hora de emitir: o relógio andou, o serverTime andou", () => {
    const { io, emitted } = fakeIo();
    const clock = new FakeClock("2026-10-24T12:00:00.000Z");
    const publisher = new SocketPublisher(io, clock, createLogger("silent"));
    publisher.publish([event("showcase:lot", "showcase", { id: "L1" })]);
    clock.advance(5_000);
    publisher.publish([event("showcase:lot", "showcase", { id: "L1" })]);
    expect(emitted.map((e) => (e.payload as { serverTime: string }).serverTime)).toEqual([
      "2026-10-24T12:00:00.000Z",
      "2026-10-24T12:00:05.000Z",
    ]);
  });

  it("um evento que falha ao emitir é logado e não impede os seguintes", () => {
    const { io, emitted } = fakeIo("user:ruim");
    const { lines, logger } = capture();
    new SocketPublisher(io, new FakeClock(), logger).publish([
      event("bid:placed", "lot:L1", {}),
      event("wallet:updated", "user:ruim", {}),
      event("wallet:updated", "user:bom", {}),
    ]);
    expect(emitted.map((e) => e.room)).toEqual(["lot:L1", "user:bom"]);
    expect(lines.join("")).toContain("falha ao emitir evento");
    expect(lines.join("")).toContain("user:ruim");
  });
});

describe("guardPublisher", () => {
  it("repassa os eventos quando tudo vai bem", () => {
    const received: DomainEvent[][] = [];
    const { lines, logger } = capture();
    const events = [event("bid:placed", "lot:L1", {})];
    guardPublisher({ publish: (batch) => void received.push(batch) }, logger).publish(events);
    expect(received).toEqual([events]);
    expect(lines).toEqual([]);
  });

  it("publisher que lança não propaga: loga com o tipo dos eventos", () => {
    const { lines, logger } = capture();
    const guarded = guardPublisher(
      {
        publish() {
          throw new Error("socket caiu");
        },
      },
      logger,
    );
    expect(() => guarded.publish([event("bid:placed", "lot:L1", {}), event("showcase:lot", "showcase", {})])).not.toThrow();
    const log = lines.join("");
    expect(log).toContain("falha ao publicar eventos depois do commit");
    expect(log).toContain("socket caiu");
    expect(log).toContain("bid:placed");
  });
});
