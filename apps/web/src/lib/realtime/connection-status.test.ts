import { afterEach, describe, expect, it } from "vitest";
import type { Socket } from "socket.io-client";
import {
  CONNECTING_BANNER_MS,
  CONNECTING_UNBLOCK_MS,
  bannerStep,
  bannerTarget,
  bidBlockReason,
  connectingPhase,
  connectionFacts,
  deriveConnectionStatus,
  markSynced,
  resetConnectionStatus,
  trackSocketConnection,
  type BannerView,
  type ConnectingPhase,
  type ConnectionStatus,
} from "./connection-status";

describe("deriveConnectionStatus", () => {
  it("live só com o socket conectado e o snapshot da página aplicado", () => {
    expect(deriveConnectionStatus({ connected: true, synced: true, everLive: true })).toBe("live");
  });

  it("primeira conexão, antes do 1º snapshot: connecting, conectado ou não", () => {
    expect(deriveConnectionStatus({ connected: false, synced: false, everLive: false })).toBe("connecting");
    expect(deriveConnectionStatus({ connected: true, synced: false, everLive: false })).toBe("connecting");
  });

  it("caiu depois de estar live: reconnecting; e reconectar não basta, falta o snapshot", () => {
    expect(deriveConnectionStatus({ connected: false, synced: false, everLive: true })).toBe("reconnecting");
    expect(deriveConnectionStatus({ connected: true, synced: false, everLive: true })).toBe("reconnecting");
  });
});

describe("connectingPhase (AC-4.31)", () => {
  it("quieto até 3 s, banner de 3 a 10 s, destravado a partir de 10 s", () => {
    expect(connectingPhase(0)).toBe("quiet");
    expect(connectingPhase(CONNECTING_BANNER_MS - 1)).toBe("quiet");
    expect(connectingPhase(CONNECTING_BANNER_MS)).toBe("banner");
    expect(connectingPhase(CONNECTING_UNBLOCK_MS - 1)).toBe("banner");
    expect(connectingPhase(CONNECTING_UNBLOCK_MS)).toBe("unblocked");
  });
});

describe("bidBlockReason (R-4.9)", () => {
  const reason = (status: ConnectionStatus, phase: ConnectingPhase, stale = false) => bidBlockReason({ status, phase, stale });

  it("reconnecting bloqueia sempre, em qualquer fase", () => {
    for (const phase of ["quiet", "banner", "unblocked"] as const) expect(reason("reconnecting", phase)).toBe("connection");
  });

  it("connecting bloqueia só até a fase unblocked: depois o servidor valida o lance sem depender do WebSocket", () => {
    expect(reason("connecting", "quiet")).toBe("connection");
    expect(reason("connecting", "banner")).toBe("connection");
    expect(reason("connecting", "unblocked")).toBeNull();
  });

  it("live libera, e refetch por salto de version bloqueia sem a mensagem de conexão", () => {
    expect(reason("live", "quiet")).toBeNull();
    expect(reason("live", "quiet", true)).toBe("stale");
    expect(reason("connecting", "unblocked", true)).toBe("stale");
  });

  it("a conexão pesa mais que o refetch quando as duas coisas valem", () => {
    expect(reason("reconnecting", "quiet", true)).toBe("connection");
  });
});

describe("banner de conexão", () => {
  it("aparece em reconnecting e, na primeira conexão, só depois dos 3 s", () => {
    expect(bannerTarget("reconnecting", "quiet")).toBe("offline");
    expect(bannerTarget("connecting", "quiet")).toBe("none");
    expect(bannerTarget("connecting", "banner")).toBe("offline");
    expect(bannerTarget("connecting", "unblocked")).toBe("offline");
    expect(bannerTarget("live", "quiet")).toBe("none");
  });

  const run = (targets: ("offline" | "none")[]): BannerView[] => {
    const views: BannerView[] = [];
    let view: BannerView = "hidden";
    for (const target of targets) {
      view = bannerStep(view, target);
      views.push(view);
    }
    return views;
  };

  it("sem sinal vira 'De volta' ao conectar; o 'De volta' só existe se o 'sem sinal' apareceu antes", () => {
    expect(run(["offline", "none"])).toEqual(["offline", "back"]);
    expect(run(["none", "none"])).toEqual(["hidden", "hidden"]);
  });

  it("'De volta' espera o timer (4 s) e some; nova queda no meio volta a 'sem sinal'", () => {
    expect(run(["offline", "none", "none"])).toEqual(["offline", "back", "back"]);
    expect(run(["offline", "none", "offline"])).toEqual(["offline", "back", "offline"]);
  });
});

/** Socket de mentira: só `connected`, `on`/`off` e um `fire` para disparar os eventos do cliente. */
function fakeSocket() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const fake = {
    connected: false,
    on(event: string, fn: (...args: unknown[]) => void) {
      handlers.set(event, [...(handlers.get(event) ?? []), fn]);
      return fake;
    },
    off(event: string, fn: (...args: unknown[]) => void) {
      handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== fn));
      return fake;
    },
    fire(event: string, ...args: unknown[]) {
      for (const fn of handlers.get(event) ?? []) fn(...args);
    },
  };
  return fake;
}

describe("store da conexão (trackSocketConnection + markSynced)", () => {
  afterEach(() => resetConnectionStatus());

  const track = () => {
    const socket = fakeSocket();
    const stop = trackSocketConnection(socket as unknown as Socket);
    return { socket, stop };
  };
  const status = () => deriveConnectionStatus(connectionFacts());

  it("o snapshot da página só vale com o socket conectado", () => {
    const { socket, stop } = track();
    markSynced();
    expect(status()).toBe("connecting");
    socket.fire("connect");
    markSynced();
    expect(status()).toBe("live");
    stop();
  });

  it("GET que volta depois da queda não marca a conexão como sincronizada", () => {
    const { socket, stop } = track();
    socket.fire("connect");
    markSynced();
    socket.fire("disconnect", "transport close");
    // O GET do join anterior chega agora, com o socket fora: a sala se perdeu com a queda.
    markSynced();
    socket.fire("connect");
    expect(status()).toBe("reconnecting");
    markSynced();
    expect(status()).toBe("live");
    stop();
  });

  it("login e logout (disconnect do próprio cliente) não contam como queda: sem banner, lance travado até sincronizar", () => {
    const { socket, stop } = track();
    socket.fire("connect");
    markSynced();
    socket.fire("disconnect", "io client disconnect");
    expect(status()).toBe("connecting");
    expect(bannerTarget(status(), "quiet")).toBe("none");
    expect(bidBlockReason({ status: status(), phase: "quiet", stale: false })).toBe("connection");
    socket.fire("connect");
    markSynced();
    expect(status()).toBe("live");
    // Uma queda de verdade, depois disso, volta a avisar.
    socket.fire("disconnect", "transport close");
    expect(status()).toBe("reconnecting");
    stop();
  });
});
