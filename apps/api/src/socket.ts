import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

/**
 * Socket.IO no mesmo servidor HTTP do Express. Só transmite (INV-4).
 * O `auth.token` é aceito mas ainda não validado: a S01 valida e coloca o socket em `user:{id}`.
 */
export function attachSocket(httpServer: HttpServer, webOrigin: string): Server {
  return new Server(httpServer, {
    cors: { origin: webOrigin },
  });
}
