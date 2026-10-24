import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyForeignStorage, clearToken, getToken, setToken, subscribeForeignToken, subscribeToken } from "./token";

describe("token entre abas", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    clearToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("outra aba trocou o usuário: o token novo vale e a sessão velha é avisada antes de quem lê o token", () => {
    setToken("token-da-ana");
    const order: string[] = [];
    const offForeign = subscribeForeignToken(() => order.push(`descartar com ${getToken()}`));
    const offToken = subscribeToken(() => order.push("leitores do token"));

    store.set("lanceauto-token", "token-do-bruno");
    applyForeignStorage("lanceauto-token", "token-do-bruno");

    expect(getToken()).toBe("token-do-bruno");
    expect(order).toEqual(["descartar com token-do-bruno", "leitores do token"]);
    offForeign();
    offToken();
  });

  it("outra aba saiu: a memória não devolve o token velho depois que o localStorage esvaziou", () => {
    setToken("token-da-ana");
    store.delete("lanceauto-token");
    applyForeignStorage("lanceauto-token", null);
    expect(getToken()).toBeNull();
  });

  it("localStorage.clear() em outra aba (chave nula) também derruba a sessão", () => {
    setToken("token-da-ana");
    store.clear();
    applyForeignStorage(null, null);
    expect(getToken()).toBeNull();
  });

  it("chave de outro assunto (tema) é ignorada", () => {
    setToken("token-da-ana");
    const listener = vi.fn();
    const off = subscribeForeignToken(listener);
    applyForeignStorage("lanceauto-tema", "noite");
    expect(listener).not.toHaveBeenCalled();
    expect(getToken()).toBe("token-da-ana");
    off();
  });
});
