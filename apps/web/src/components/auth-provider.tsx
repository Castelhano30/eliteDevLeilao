"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { AuthResponse, LoginInput, MeResponse, RegisterInput, UserDto } from "@lanceauto/shared";
import { apiGet, apiPost, setUnauthenticatedHandler, type ApiResult } from "@/lib/api-client";
import { reconnectSocket } from "@/lib/socket";
import { clearToken, getToken, setToken, subscribeToken } from "@/lib/token";

export type AuthStatus = "loading" | "anon" | "auth";

interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  login(input: LoginInput): Promise<ApiResult<AuthResponse>>;
  register(input: RegisterInput): Promise<ApiResult<AuthResponse>>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth fora do AuthProvider");
  return value;
}

export const ME_KEY = ["me"] as const;
export const WALLET_SUMMARY_KEY = ["wallet", "summary"] as const;
export const WALLET_LEDGER_KEY = ["wallet", "ledger"] as const;

export async function fetchMe(): Promise<MeResponse> {
  const result = await apiGet<MeResponse>("/me");
  if (!result.ok) throw new Error(result.error?.message ?? "Não deu para carregar a sessão.");
  return result.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  // O token vive no localStorage, que o servidor não vê: até hidratar, o estado é "loading".
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const hasToken = useSyncExternalStore(subscribeToken, () => getToken() !== null, () => false);

  const me = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, enabled: hasToken, retry: 3 });

  // O chip de saldo lê ["wallet","summary"]; o GET /me o semeia (T7).
  useEffect(() => {
    if (me.data) queryClient.setQueryData(WALLET_SUMMARY_KEY, me.data.wallet);
  }, [me.data, queryClient]);

  const endSession = useCallback(() => {
    clearToken();
    queryClient.clear();
    reconnectSocket();
  }, [queryClient]);

  // Token expirado ou de usuário que não existe mais: descarta, limpa o cache e as guardas mandam ao login.
  useEffect(() => {
    setUnauthenticatedHandler(endSession);
    return () => setUnauthenticatedHandler(null);
  }, [endSession]);

  const startSession = useCallback(
    (result: ApiResult<AuthResponse>) => {
      if (result.ok) {
        setToken(result.data.token);
        reconnectSocket();
      }
      return result;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = !hydrated ? "loading" : !hasToken ? "anon" : me.data ? "auth" : "loading";
    return {
      user: hasToken ? (me.data?.user ?? null) : null,
      status,
      login: async (input) => startSession(await apiPost<AuthResponse>("/auth/login", input)),
      register: async (input) => startSession(await apiPost<AuthResponse>("/auth/register", input)),
      logout: () => {
        endSession();
        router.push("/");
      },
    };
  }, [hydrated, hasToken, me.data, startSession, endSession, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
