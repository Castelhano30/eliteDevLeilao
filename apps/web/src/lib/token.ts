const KEY = "lanceauto-token";

/** Se o `localStorage` estiver bloqueado, a sessão vale só nesta aba (memória). */
let memoryToken: string | null = null;

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
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nada a limpar
  }
}
