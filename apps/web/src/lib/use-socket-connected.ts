"use client";

import { useSyncExternalStore } from "react";
import { getSocket } from "./socket";

function subscribe(onChange: () => void) {
  const socket = getSocket();
  socket.on("connect", onChange);
  socket.on("disconnect", onChange);
  return () => {
    socket.off("connect", onChange);
    socket.off("disconnect", onChange);
  };
}

/** `true` enquanto o socket compartilhado está conectado. */
export function useSocketConnected(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getSocket().connected,
    () => false,
  );
}
