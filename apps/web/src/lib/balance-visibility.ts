export const BALANCE_VISIBILITY_KEY = "lanceauto-saldo-oculto";
let memoryHidden = false;
let memoryOnly = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function readBalanceHidden(): boolean {
  if (memoryOnly) return memoryHidden;
  try {
    return localStorage.getItem(BALANCE_VISIBILITY_KEY) === "true";
  } catch {
    return memoryHidden;
  }
}

export function setBalanceHidden(hidden: boolean): void {
  memoryHidden = hidden;
  try {
    localStorage.setItem(BALANCE_VISIBILITY_KEY, String(hidden));
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  notify();
}

export function syncBalanceStorage(key: string | null, value: string | null): void {
  if (key !== null && key !== BALANCE_VISIBILITY_KEY) return;
  memoryHidden = key !== null && value === "true";
  memoryOnly = false;
  notify();
}

export function subscribeBalanceVisibility(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => syncBalanceStorage(event.key, event.newValue);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
