import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, parseStoredTheme, themeInitScript } from "./theme";

function runScript(storage: { getItem: (key: string) => string | null }) {
  const documentElement = { dataset: {} as Record<string, string> };
  new Function("localStorage", "document", themeInitScript)(storage, { documentElement });
  return documentElement.dataset;
}

describe("parseStoredTheme", () => {
  it("aceita só claro e noite", () => {
    expect(parseStoredTheme("claro")).toBe("claro");
    expect(parseStoredTheme("noite")).toBe("noite");
    expect(parseStoredTheme("sistema")).toBeNull();
    expect(parseStoredTheme("roxo")).toBeNull();
    expect(parseStoredTheme(null)).toBeNull();
  });
});

describe("themeInitScript (AC-0.9)", () => {
  it("lê a chave certa e fixa data-theme com uma escolha válida", () => {
    const keys: string[] = [];
    const dataset = runScript({
      getItem: (key) => {
        keys.push(key);
        return "noite";
      },
    });
    expect(keys).toEqual([THEME_STORAGE_KEY]);
    expect(dataset.theme).toBe("noite");
  });

  it("não define nada quando a chave está ausente (o sistema decide)", () => {
    expect(runScript({ getItem: () => null }).theme).toBeUndefined();
  });

  it("ignora valor inválido", () => {
    expect(runScript({ getItem: () => "roxo" }).theme).toBeUndefined();
  });

  it("não quebra se o localStorage lançar erro", () => {
    expect(
      runScript({
        getItem: () => {
          throw new Error("bloqueado");
        },
      }).theme,
    ).toBeUndefined();
  });
});
