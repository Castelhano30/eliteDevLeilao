"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { getSocket } from "@/lib/socket";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Conecta ao montar; sem salas por enquanto. O socket é singleton, então não desconecta ao desmontar.
  useEffect(() => {
    const socket = getSocket();
    if (!socket.connected) socket.connect();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
