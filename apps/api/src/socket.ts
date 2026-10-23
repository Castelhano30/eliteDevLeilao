import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken } from "./auth/token";

/** Sala privada do usuário; a S04 emite `wallet:updated` nela. */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Socket.IO no mesmo servidor HTTP do Express. Só transmite (INV-4).
 * Token válido no handshake coloca o socket em `user:{id}`; ausente ou inválido segue anônimo, sem erro (R-1.12).
 */
export function attachSocket(httpServer: HttpServer, webOrigin: string, jwtSecret: string): Server {
  const io = new Server(httpServer, { cors: { origin: webOrigin } });
  io.on("connection", (socket) => {
    const user = verifyToken(jwtSecret, (socket.handshake.auth as { token?: unknown } | undefined)?.token);
    if (user) void socket.join(userRoom(user.id));
  });
  return io;
}
