"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api-client";

let socket: Socket | null = null;

/** Hoje ninguém guarda token; a S01 passa a devolver o token da sessão. */
function getToken(): string | undefined {
  return undefined;
}

/**
 * Socket único da aplicação. `auth` é função para o handshake sempre levar o token atual.
 * Login e logout (S01) fazem `socket.disconnect(); socket.connect()`.
 */
export function getSocket(): Socket {
  socket ??= io(API_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: getToken() }),
  });
  return socket;
}
