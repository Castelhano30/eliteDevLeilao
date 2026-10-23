import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { attachSocket } from "./socket";

let httpServer: HttpServer;

afterEach(() => {
  httpServer.closeAllConnections();
  httpServer.close();
});

describe("Socket.IO", () => {
  it("aceita conexão com e sem token (que ainda não é validado)", async () => {
    httpServer = createServer();
    const io = attachSocket(httpServer, "http://localhost:3000");
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;

    for (const auth of [{}, { token: "qualquer" }]) {
      const client = connect(url, { auth, transports: ["websocket"] });
      await new Promise<void>((resolve, reject) => {
        client.on("connect", resolve);
        client.on("connect_error", reject);
      });
      expect(client.connected).toBe(true);
      client.disconnect();
    }
    await io.close();
  });
});
