"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import { serverNow } from "../server-clock";

export type ConnectionStatus = "connecting" | "live" | "reconnecting";

/** Na primeira conexão: banner só depois de 3 s; passados 10 s o lance destrava (R-4.9, o servidor valida tudo). */
export const CONNECTING_BANNER_MS = 3_000;
export const CONNECTING_UNBLOCK_MS = 10_000;
/** "De volta ao pátio" fica na tela por 4 s. */
export const BACK_BANNER_MS = 4_000;

export type ConnectingPhase = "quiet" | "banner" | "unblocked";

export interface ConnectionFacts {
  /** O socket compartilhado está conectado agora. */
  connected: boolean;
  /** Join na sala e snapshot HTTP da página aplicados depois da última conexão. */
  synced: boolean;
  /** Já houve um `synced` alguma vez (distingue a primeira conexão de uma queda). */
  everLive: boolean;
}

/**
 * `live` só com o socket conectado e o snapshot aplicado: reconectar não basta, o estado pode estar velho.
 * Quem já esteve `live` e perdeu isso está `reconnecting`; quem nunca esteve, `connecting`.
 */
export function deriveConnectionStatus({ connected, synced, everLive }: ConnectionFacts): ConnectionStatus {
  if (connected && synced) return "live";
  return everLive ? "reconnecting" : "connecting";
}

/** Quanto tempo a primeira conexão já levou, em fases. */
export function connectingPhase(elapsedMs: number): ConnectingPhase {
  if (elapsedMs >= CONNECTING_UNBLOCK_MS) return "unblocked";
  if (elapsedMs >= CONNECTING_BANNER_MS) return "banner";
  return "quiet";
}

export type BidBlockReason = "connection" | "stale";

/**
 * Por que o botão "Dar lance" fica inerte (R-4.9). `reconnecting` bloqueia sempre. `connecting` bloqueia só até a
 * fase `unblocked`. `stale` é o refetch por salto de `version`: bloqueia sem banner nem texto de conexão.
 */
export function bidBlockReason({
  status,
  phase,
  stale,
}: {
  status: ConnectionStatus;
  phase: ConnectingPhase;
  stale: boolean;
}): BidBlockReason | null {
  if (status === "reconnecting") return "connection";
  if (status === "connecting" && phase !== "unblocked") return "connection";
  return stale ? "stale" : null;
}

export type BannerView = "hidden" | "offline" | "back";

/** O que o banner deve dizer agora, sem o "De volta" (que depende do que ele mostrou antes). */
export function bannerTarget(status: ConnectionStatus, phase: ConnectingPhase): "offline" | "none" {
  if (status === "reconnecting") return "offline";
  if (status === "connecting" && phase !== "quiet") return "offline";
  return "none";
}

/** Do aviso "sem sinal" para o "De volta ao pátio" e de volta ao nada; o `back` expira por timer (4 s) fora daqui. */
export function bannerStep(view: BannerView, target: "offline" | "none"): BannerView {
  if (target === "offline") return "offline";
  return view === "offline" ? "back" : view;
}

// ---------------------------------------------------------------- store compartilhado

interface Snapshot extends ConnectionFacts {
  /** Relógio do servidor (ms) no último snapshot aplicado; mostra "Última atualização às hh:mm:ss". */
  lastSyncedAt: number | null;
}

const INITIAL: Snapshot = { connected: false, synced: false, everLive: false, lastSyncedAt: null };
let snapshot: Snapshot = INITIAL;
const listeners = new Set<() => void>();

function update(patch: Partial<Snapshot>) {
  const next = { ...snapshot, ...patch };
  if (next.connected === snapshot.connected && next.synced === snapshot.synced && next.everLive === snapshot.everLive && next.lastSyncedAt === snapshot.lastSyncedAt) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/** A página (Sala, Vitrine, Painel) aplicou o snapshot depois de entrar na sala: a conexão passa a valer. */
export function markSynced(): void {
  update({ synced: true, everLive: true, lastSyncedAt: serverNow() });
}

/** Alimenta o store com o socket compartilhado; devolve a limpeza. A queda invalida o snapshot da página. */
export function trackSocketConnection(socket: Socket): () => void {
  update({ connected: socket.connected });
  const onConnect = () => update({ connected: true });
  const onDisconnect = () => update({ connected: false, synced: false });
  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);
  return () => {
    socket.off("connect", onConnect);
    socket.off("disconnect", onDisconnect);
  };
}

/** Só para testes. */
export function resetConnectionStatus(): void {
  snapshot = INITIAL;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export interface ConnectionView {
  status: ConnectionStatus;
  phase: ConnectingPhase;
  lastSyncedAt: number | null;
}

/**
 * Fonte única do banner e do botão de lance. No servidor e na hidratação vale o estado inicial (`connecting`,
 * fase quieta), então o HTML não afirma nada sobre a conexão que o navegador ainda não conhece.
 */
export function useConnectionStatus(): ConnectionView {
  const facts = useSyncExternalStore(subscribe, () => snapshot, () => INITIAL);
  const status = deriveConnectionStatus(facts);
  const [reached, setReached] = useState<ConnectingPhase>("quiet");

  // Os timers só correm enquanto conecta pela primeira vez; fora disso a fase é sempre quieta (derivada, sem setState em efeito).
  useEffect(() => {
    if (status !== "connecting") return;
    const banner = setTimeout(() => setReached("banner"), CONNECTING_BANNER_MS);
    const unblock = setTimeout(() => setReached("unblocked"), CONNECTING_UNBLOCK_MS);
    return () => {
      clearTimeout(banner);
      clearTimeout(unblock);
    };
  }, [status]);
  const phase = status === "connecting" ? reached : "quiet";

  return { status, phase, lastSyncedAt: facts.lastSyncedAt };
}

/**
 * Banner da página: "Sem sinal…" enquanto cai ou conecta devagar e, ao voltar, "De volta ao pátio…" por 4 s.
 * Só mostra "De volta" se antes mostrou "Sem sinal" (uma conexão rápida não avisa nada).
 */
export function useConnectionBanner({ status, phase }: ConnectionView): BannerView {
  const target = bannerTarget(status, phase);
  const [view, setView] = useState<BannerView>("hidden");

  // Estado derivado no render (idempotente): "sem sinal" que passa vira "de volta"; o timer abaixo o apaga.
  const next = bannerStep(view, target);
  if (next !== view) setView(next);

  useEffect(() => {
    if (view !== "back") return;
    const timer = setTimeout(() => setView("hidden"), BACK_BANNER_MS);
    return () => clearTimeout(timer);
  }, [view]);

  return view;
}
