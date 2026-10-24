export const THEME_STORAGE_KEY = "lanceauto-tema";

export type ThemeChoice = "sistema" | "claro" | "noite";

let memoryChoice: ThemeChoice = "sistema";
let memoryOnly = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Só "claro" e "noite" valem como escolha manual; qualquer outra coisa é "sistema". */
export function parseStoredTheme(value: string | null | undefined): "claro" | "noite" | null {
  return value === "claro" || value === "noite" ? value : null;
}

/**
 * Script inline do `<head>`: roda antes da primeira pintura e fixa `data-theme` quando há escolha manual.
 * Sem escolha (ou sem localStorage), não define nada e o CSS segue o sistema.
 * Fica como texto autocontido de propósito: um bundler não pode reescrevê-lo.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="claro"||t==="noite"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

/** Lê a escolha gravada; sem localStorage (janela privada) cai em "sistema". */
export function readThemeChoice(): ThemeChoice {
  if (memoryOnly) return memoryChoice;
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? "sistema";
  } catch {
    return memoryChoice;
  }
}

export function readDarkTheme(): boolean {
  const choice = readThemeChoice();
  return choice === "noite" || (choice === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function applyAttribute(choice: ThemeChoice) {
  if (choice === "sistema") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}

export function syncThemeStorage(key: string | null, value: string | null): void {
  if (key !== null && key !== THEME_STORAGE_KEY) return;
  memoryChoice = key === null ? "sistema" : parseStoredTheme(value) ?? "sistema";
  memoryOnly = false;
  applyAttribute(memoryChoice);
  notify();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (event: StorageEvent) => syncThemeStorage(event.key, event.newValue);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", listener);
  };
}

/** Aplica e grava a escolha. "sistema" remove a chave e o atributo. */
export function applyThemeChoice(choice: ThemeChoice): void {
  memoryChoice = choice;
  applyAttribute(choice);
  try {
    if (choice === "sistema") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  notify();
}
