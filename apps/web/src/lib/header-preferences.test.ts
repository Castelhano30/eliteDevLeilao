import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("preferências do cabeçalho", () => {
  const store = new Map<string, string>();
  let dark = false;
  let storageHandler: (event: { key: string | null; newValue: string | null }) => void;
  let mediaHandler: () => void;

  beforeEach(() => {
    vi.resetModules();
    store.clear();
    dark = false;
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: dark, addEventListener: (_: string, listener: () => void) => { mediaHandler = listener; }, removeEventListener: vi.fn() }),
      addEventListener: (_: string, listener: typeof storageHandler) => { storageHandler = listener; },
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reflete sistema, persiste a primeira escolha e sincroniza tema e atributo entre abas", async () => {
    const theme = await import("./theme");
    const notify = vi.fn();
    const off = theme.subscribeTheme(notify);
    expect(theme.readDarkTheme()).toBe(false);
    dark = true;
    mediaHandler();
    expect(theme.readDarkTheme()).toBe(true);
    expect(notify).toHaveBeenCalled();
    theme.applyThemeChoice("claro");
    expect(theme.readDarkTheme()).toBe(false);
    expect(store.get(theme.THEME_STORAGE_KEY)).toBe("claro");
    store.set(theme.THEME_STORAGE_KEY, "noite");
    storageHandler({ key: theme.THEME_STORAGE_KEY, newValue: "noite" });
    expect(document.documentElement.dataset.theme).toBe("noite");
    expect(theme.readDarkTheme()).toBe(true);
    store.clear();
    storageHandler({ key: null, newValue: null });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(theme.readThemeChoice()).toBe("sistema");
    off();
  });

  it("mantém escolhas em memória mesmo se gravação for bloqueada e leitura devolver valor antigo", async () => {
    const theme = await import("./theme");
    const balance = await import("./balance-visibility");
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("bloqueado"); } });
    theme.applyThemeChoice("noite");
    balance.setBalanceHidden(true);
    expect(theme.readDarkTheme()).toBe(true);
    expect(balance.readBalanceHidden()).toBe(true);
    theme.applyThemeChoice("claro");
    balance.setBalanceHidden(false);
    expect(theme.readDarkTheme()).toBe(false);
    expect(balance.readBalanceHidden()).toBe(false);
  });

  it("preserva saldo oculto após recarga e logout; outra aba pode mostrar explicitamente", async () => {
    let balance = await import("./balance-visibility");
    balance.setBalanceHidden(true);
    vi.resetModules();
    balance = await import("./balance-visibility");
    expect(balance.readBalanceHidden()).toBe(true);
    const notify = vi.fn();
    const off = balance.subscribeBalanceVisibility(notify);
    storageHandler({ key: "lanceauto-token", newValue: null });
    expect(balance.readBalanceHidden()).toBe(true);
    expect(notify).not.toHaveBeenCalled();
    store.set(balance.BALANCE_VISIBILITY_KEY, "false");
    storageHandler({ key: balance.BALANCE_VISIBILITY_KEY, newValue: "false" });
    expect(balance.readBalanceHidden()).toBe(false);
    expect(notify).toHaveBeenCalledOnce();
    off();
  });
});
