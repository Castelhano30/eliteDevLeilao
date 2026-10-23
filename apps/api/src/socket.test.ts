import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { io as connect, type Socket } from "socket.io-client";
import type { Server } from "socket.io";
import { afterEach, describe, expect, it } from "vitest";
import { signToken } from "./auth/token";
import { attachSocket, userRoom } from "./socket";

const SECRET = "s".repeat(32);

let httpServer: HttpServer;
let io: Server;
const clients: Socket[] = [];

async function start() {
  httpServer = createServer();
  io = attachSocket(httpServer, "http://localhost:3000", SECRET);
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
