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

const foreignListeners = new Set<() => void>();

/**
 * Mudança do token feita por OUTRA aba (o `storage` só dispara nas outras). Sincroniza a memória, para o fallback
 * não devolver o token velho, avisa quem precisa descartar a sessão e depois quem lê o token. `key` nulo é `clear()`.
 */
export function applyForeignStorage(key: string | null, newValue: string | null): void {
  if (key !== null && key !== KEY) return;
  memoryToken = key === null ? null : newValue;
  foreignListeners.forEach((listener) => listener());
  notify();
}

const onStorage = (event: StorageEvent) => applyForeignStorage(event.key, event.newValue);

/**
 * Avisa quando o token muda em outra aba (login, logout ou troca de usuário). Sem isso a aba antiga segue
 * mostrando o usuário anterior enquanto as requisições já saem com o token novo.
 */
export function subscribeForeignToken(listener: () => void): () => void {
  if (foreignListeners.size === 0) window.addEventListener("storage", onStorage);
  foreignListeners.add(listener);
  return () => {
    foreignListeners.delete(listener);
    if (foreignListeners.size === 0) window.removeEventListener("storage", onStorage);
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
