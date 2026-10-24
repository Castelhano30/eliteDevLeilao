"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { trackSocketConnection } from "@/lib/realtime/connection-status";
import { useWalletLive } from "@/lib/realtime/use-wallet-live";
import { getSocket } from "@/lib/socket";

/** Tempo real que vale para o app todo: o saldo do chip e o estado da conexão. As salas de cada página ficam nelas. */
function RealtimeBridge() {
  useWalletLive();
  useEffect(() => trackSocketConnection(getSocket()), []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Conecta ao montar. O socket é singleton, então não desconecta ao desmontar; as salas entram pelas páginas.
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
