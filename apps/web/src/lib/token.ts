const KEY = "lanceauto-token";

/** Se o `localStorage` estiver bloqueado, a sessão vale só nesta aba (memória). */
let memoryToken: string | null = null;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Para `useSyncExternalStore`: avisa quem lê o token quando ele muda (login, logout, sessão expirada). */
export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // sem localStorage: fica só na memória
  }
  notify();
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nada a limpar
  }
  notify();
}
