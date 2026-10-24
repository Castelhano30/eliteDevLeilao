import { createServer, type Server as HttpServer } from "node:http";
import type { Express } from "express";
import type { Server } from "socket.io";
import { composeApp, type AppDeps } from "./app";
import { SystemClock } from "./infra/clock";
import { SocketPublisher } from "./infra/publisher";
import { createSocketServer, registerSocketHandlers } from "./socket";

export interface RealtimeServer {
  httpServer: HttpServer;
  io: Server;
  app: Express;
}

/**
 * Express e Socket.IO no mesmo servidor HTTP. O `io` nasce primeiro, sem http, porque o app precisa do
 * `Publisher` dele; só no fim o `io` é preso ao servidor. Quem escuta numa porta é o chamador.
 */
export function createRealtimeServer(deps: Omit<AppDeps, "publisher">): RealtimeServer {
  const clock = deps.clock ?? new SystemClock();
  const io = createSocketServer({ webOrigin: deps.env.WEB_ORIGIN });
  const publisher = new SocketPublisher(io, clock, deps.logger);
  const { app, lots } = composeApp({ ...deps, clock, publisher });
  registerSocketHandlers(io, { jwtSecret: deps.env.JWT_SECRET, lots, logger: deps.logger });
  const httpServer = createServer(app);
  io.attach(httpServer);
  return { httpServer, io, app };
}
