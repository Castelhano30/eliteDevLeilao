import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import { io as connect, type Socket } from "socket.io-client";
import type { LotJoinAck } from "@lanceauto/shared";
import type { AppDeps } from "../../src/app";
import { FakeClock } from "../../src/infra/clock";
import { createLogger } from "../../src/infra/logger";
import { createRealtimeServer } from "../../src/realtime";
import { testEnv } from "./app";

export const NOW = "2026-10-23T12:00:00.000Z";

export interface RealtimeHarness {
  url: string;
  app: ReturnType<typeof createRealtimeServer>["app"];
  io: ReturnType<typeof createRealtimeServer>["io"];
  clock: FakeClock;
  /** Conecta como visitante ou, com token, como o usuário; só resolve depois do `connect`. */
  open(token?: string): Promise<Socket>;
  close(): Promise<void>;
}

/** Express + Socket.IO reais numa porta efêmera, com `FakeClock` e o banco de teste. */
export async function startRealtime(
  prisma: PrismaClient,
  external: AppDeps["external"] = { timeoutMs: 300 },
): Promise<RealtimeHarness> {
  const clock = new FakeClock(NOW);
  const { httpServer, io, app } = createRealtimeServer({
    env: testEnv,
    db: prisma,
    logger: createLogger("silent"),
    clock,
    external,
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  const sockets: Socket[] = [];

  return {
    url,
    app,
    io,
    clock,
    async open(token) {
      const socket = connect(url, { auth: token === undefined ? {} : { token }, transports: ["websocket"], reconnection: false });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.on("connect", resolve);
        socket.on("connect_error", reject);
      });
      // O handler de connection já entrou na sala do usuário; um respiro garante a ordem.
      await tick(20);
      return socket;
    },
    async close() {
      for (const socket of sockets) socket.disconnect();
      await io.close();
    },
  };
}

export const tick = (ms = 120) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface Received {
  name: string;
  payload: Record<string, unknown>;
}

/** Guarda tudo que o socket receber dos eventos pedidos, na ordem de chegada. */
export function record(socket: Socket, names: string[]): Received[] {
  const received: Received[] = [];
  for (const name of names) socket.on(name, (payload: Record<string, unknown>) => received.push({ name, payload }));
  return received;
}

export const named = (received: Received[], name: string) => received.filter((event) => event.name === name);

export function joinLot(socket: Socket, lotId: string): Promise<LotJoinAck> {
  return new Promise((resolve) => socket.emit("lot:join", { lotId }, resolve));
}

export const ISO_UTC_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
