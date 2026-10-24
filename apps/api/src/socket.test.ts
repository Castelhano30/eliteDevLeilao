import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { io as connect, type Socket } from "socket.io-client";
import type { Server } from "socket.io";
import { afterEach, describe, expect, it } from "vitest";
import type { LotJoinAck, LotState } from "@lanceauto/shared";
import { signToken } from "./auth/token";
import { AppError } from "./errors";
import { createLogger } from "./infra/logger";
import {
  PING_INTERVAL_MS,
  PING_TIMEOUT_MS,
  SHOWCASE_ROOM,
  createSocketServer,
  lotRoom,
  registerSocketHandlers,
  userRoom,
  type SocketDeps,
} from "./socket";

const SECRET = "s".repeat(32);

let httpServer: HttpServer;
let io: Server;
const clients: Socket[] = [];

const stateOf = (id: string) => ({ lot: { id } }) as unknown as LotState;

/** `lots` falso: `L1` existe; `BOOM` falha por dentro; o resto é 404. */
const lots: SocketDeps["lots"] = {
  async getLotState(id, viewer) {
    if (id === "BOOM") throw new Error("banco fora");
    if (id !== "L1") throw new AppError("NOT_FOUND");
    // O snapshot só é montado com o socket já na sala (R-4.8).
    const rooms = io.sockets.adapter.rooms.get(lotRoom(id));
    expect(rooms?.size ?? 0).toBeGreaterThan(0);
    return { ...stateOf(id), serverTime: viewer?.id ?? "visitante" };
  },
};

async function start() {
  io = createSocketServer({ webOrigin: "http://localhost:3000" });
  registerSocketHandlers(io, { jwtSecret: SECRET, lots, logger: createLogger("silent") });
  httpServer = createServer();
  io.attach(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  return `http://localhost:${(httpServer.address() as AddressInfo).port}`;
}

async function open(url: string, token?: string) {
  const client = connect(url, { auth: token === undefined ? {} : { token }, transports: ["websocket"] });
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.on("connect", resolve);
    client.on("connect_error", reject);
  });
  // O join da sala roda no handler de connection; um round-trip garante que já terminou.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return client;
}

const roomsOf = (client: Socket) => [...(io.sockets.sockets.get(client.id!)?.rooms ?? [])];
const join = (client: Socket, payload: unknown) =>
  new Promise<LotJoinAck>((resolve) => client.emit("lot:join", payload, resolve));
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await io.close();
});

describe("Socket.IO (AC-1.35)", () => {
  it("token válido entra na sala user:{id}", async () => {
    const url = await start();
    const client = await open(url, signToken(SECRET, { id: "u1", role: "BIDDER" }));
    expect(roomsOf(client)).toContain(userRoom("u1"));
  });

  it("token inválido, forjado ou ausente conecta sem sala de usuário e sem erro", async () => {
    const url = await start();
    const forged = jwt.sign({ role: "BIDDER" }, "x".repeat(32), { algorithm: "HS256", subject: "u1" });
    for (const token of [undefined, "qualquer", forged]) {
      const client = await open(url, token);
      expect(client.connected).toBe(true);
      expect(roomsOf(client).some((room) => room.startsWith("user:"))).toBe(false);
    }
  });
});

describe("reconexão pelo token atual (AC-1.41)", () => {
  it("com `auth` em função, a conexão após login entra na sala e a seguinte, após logout, não", async () => {
    const url = await start();
    let token: string | undefined;
    const client = connect(url, {
      autoConnect: false,
      transports: ["websocket"],
      auth: (cb) => cb({ token }),
    });
    clients.push(client);
    const connectOnce = async () => {
      await new Promise<void>((resolve) => {
        client.once("connect", () => resolve());
        client.connect();
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
    };

    token = signToken(SECRET, { id: "u1", role: "BIDDER" });
    await connectOnce();
    expect(roomsOf(client)).toContain(userRoom("u1"));

    token = undefined;
    client.disconnect();
    await connectOnce();
    expect(roomsOf(client).some((room) => room.startsWith("user:"))).toBe(false);
  });
});

describe("salas (R-4.4)", () => {
  it("detecta a queda em até ~20 s: pingInterval e pingTimeout de 10 s", async () => {
    await start();
    expect([PING_INTERVAL_MS, PING_TIMEOUT_MS]).toEqual([10_000, 10_000]);
    expect(io.engine.opts.pingInterval).toBe(10_000);
    expect(io.engine.opts.pingTimeout).toBe(10_000);
  });

  it("lot:join entra na sala do lote antes do snapshot e devolve o ack; lot:leave sai", async () => {
    const url = await start();
    const client = await open(url);
    const ack = await join(client, { lotId: "L1" });
    expect(ack).toMatchObject({ ok: true, lot: { lot: { id: "L1" } } });
    expect(roomsOf(client)).toContain(lotRoom("L1"));

    client.emit("lot:leave", { lotId: "L1" });
    await settle();
    expect(roomsOf(client)).not.toContain(lotRoom("L1"));
  });

  it("o snapshot é do viewer do token; visitante não tem viewer", async () => {
    const url = await start();
    const bidder = await open(url, signToken(SECRET, { id: "u7", role: "BIDDER" }));
    const visitor = await open(url);
    expect(await join(bidder, { lotId: "L1" })).toMatchObject({ ok: true, lot: { serverTime: "u7" } });
    expect(await join(visitor, { lotId: "L1" })).toMatchObject({ ok: true, lot: { serverTime: "visitante" } });
  });

  it("lote inexistente ou lotId inválido: NOT_FOUND e nenhuma sala", async () => {
    const url = await start();
    const client = await open(url, signToken(SECRET, { id: "u1", role: "BIDDER" }));
    const before = roomsOf(client);
    for (const payload of [{ lotId: "nao-existe" }, { lotId: "" }, { lotId: 7 }, { lotId: "user:u1" }, {}, null, "L1"]) {
      expect(await join(client, payload)).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    }
    expect(roomsOf(client).sort()).toEqual(before.sort());
  });

  it("falha por dentro do snapshot responde INTERNAL, sem derrubar o socket", async () => {
    const url = await start();
    const client = await open(url);
    expect(await join(client, { lotId: "BOOM" })).toEqual({ ok: false, error: { code: "INTERNAL" } });
    expect(client.connected).toBe(true);
  });

  it("showcase:join entra na sala pública; o ack é opcional", async () => {
    const url = await start();
    const client = await open(url);
    client.emit("showcase:join");
    client.emit("lot:join", { lotId: "L1" });
    await settle();
    expect(roomsOf(client)).toEqual(expect.arrayContaining([SHOWCASE_ROOM, lotRoom("L1")]));
  });

  it("o cliente não consegue entrar em user:*, nem por join, nem por evento inventado", async () => {
    const url = await start();
    const client = await open(url);
    await join(client, { lotId: "u1" });
    client.emit("user:join", { userId: "u1" });
    client.emit("join", "user:u1");
    client.emit("lot:join", { lotId: "../user:u1" });
    await settle();
    expect(roomsOf(client).some((room) => room.startsWith("user:"))).toBe(false);
  });
});
