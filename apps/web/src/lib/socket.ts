"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api-client";
import { getToken } from "./token";

let socket: Socket | null = null;

/**
 * Socket único da aplicação. `auth` é função para o handshake sempre levar o token atual.
 */
export function getSocket(): Socket {
  socket ??= io(API_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: getToken() ?? undefined }),
  });
  return socket;
}

/** Login e logout: reconecta para o handshake levar o token novo (ou nenhum) e a sala `user:*` certa. */
export function reconnectSocket(): void {
  const current = getSocket();
  current.disconnect();
  current.connect();
}
