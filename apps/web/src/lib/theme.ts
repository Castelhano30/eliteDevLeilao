export const THEME_STORAGE_KEY = "lanceauto-tema";

export type ThemeChoice = "sistema" | "claro" | "noite";

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
  try {
    return parseStoredTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? "sistema";
  } catch {
    return "sistema";
  }
}

/** Aplica e grava a escolha. "sistema" remove a chave e o atributo. */
export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "sistema") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = choice;
  }
  try {
    if (choice === "sistema") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // sem localStorage: a escolha vale só até recarregar
  }
}
