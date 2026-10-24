"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { AuthResponse, LoginInput, MeResponse, RegisterInput, UserDto } from "@lanceauto/shared";
import { apiGet, apiPost, setUnauthenticatedHandler, type ApiResult } from "@/lib/api-client";
import { reconnectSocket } from "@/lib/socket";
import { clearToken, getToken, setToken, subscribeForeignToken, subscribeToken } from "@/lib/token";

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
  const pathname = usePathname();
  const leaving = useRef(false);
  // O token vive no localStorage, que o servidor não vê: até hidratar, o estado é "loading".
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // O próprio token (não só "tem ou não tem") é o snapshot: trocar de usuário em outra aba muda a identidade e re-renderiza.
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const hasToken = token !== null;

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

  // Outra aba entrou, saiu ou trocou de usuário: o token é compartilhado, então esta aba descarta o que sabia do
  // usuário anterior (senão mostraria um e agiria como outro) e reconecta o socket com o token novo.
  useEffect(
    () =>
      subscribeForeignToken(() => {
        queryClient.clear();
        reconnectSocket();
      }),
    [queryClient],
  );

  // "Sair": primeiro vai à vitrine, depois descarta a sessão. Se fosse na ordem inversa, a guarda da rota privada
  // veria o visitante e mandaria para /entrar antes de o push chegar.
  useEffect(() => {
    if (leaving.current && pathname === "/") {
      leaving.current = false;
      endSession();
    }
  }, [pathname, endSession]);

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
        if (pathname === "/") {
          endSession();
          return;
        }
        leaving.current = true;
        router.push("/");
      },
    };
  }, [hydrated, hasToken, me.data, startSession, endSession, router, pathname]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
