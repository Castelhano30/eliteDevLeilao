import { describe, expect, it } from "vitest";
import {
  CONNECTING_BANNER_MS,
  CONNECTING_UNBLOCK_MS,
  bannerStep,
  bannerTarget,
  bidBlockReason,
  connectingPhase,
  deriveConnectionStatus,
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
