/**
 * Relógio do servidor (INV-1): `agora = Date.now() + offset`, com o offset de cada resposta que traz
 * `serverTime`. Um só store e um só `setInterval` de 1 s para a tela toda. O relógio do aparelho nunca
 * decide estado: ao chegar a zero a tela só pede o GET e espera o status do servidor.
 * Único arquivo do web (com os formatadores) que lê `Date.now()` (T6).
 */
let offset = 0;
/** Alguma resposta (ou a carga do SSR) já acertou o relógio? */
let synced = false;
/** Melhor medição de offset (menor latência) ainda fresca, ou `null`. */
let best: OffsetEstimate | null = null;

/** Quando a resposta saiu e quando voltou, em `Date.now()` do aparelho. */
export interface ClockSample {
  sentAt: number;
  receivedAt: number;
}

export interface OffsetEstimate {
  offset: number;
  /** Ida e volta (ms) da medição; quanto menor, mais confiável. */
  rtt: number;
  /** Quando a medição foi feita (`receivedAt`). */
  at: number;
}

/** Uma medição de menor latência perde o posto depois disso, para o relógio do aparelho que desliza não enganar. */
export const OFFSET_TTL_MS = 60_000;

/**
 * R-4.10: o offset vem da medição de **menor latência** observada, assumindo que o servidor carimbou no meio da
 * viagem. O atraso de cada resposta, sozinho, não pode dar saltos no cronômetro. Medição mais velha que
 * `OFFSET_TTL_MS` cede o lugar à nova, mesmo mais lenta.
 */
export function chooseOffset(current: OffsetEstimate | null, serverMs: number, sample: ClockSample): OffsetEstimate {
  const rtt = Math.max(0, sample.receivedAt - sample.sentAt);
  const candidate: OffsetEstimate = { offset: serverMs - (sample.sentAt + rtt / 2), rtt, at: sample.receivedAt };
  if (current === null || candidate.rtt <= current.rtt || candidate.at - current.at > OFFSET_TTL_MS) return candidate;
  return current;
}

/** Instante do aparelho para montar um `ClockSample`; o `apiClient` e os acks não leem `Date.now()` por conta própria. */
export function clockMark(): number {
  return Date.now();
}
let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Agora, pelo relógio do servidor, em ms. */
export function serverNow(): number {
  return Date.now() + offset;
}

/** Já houve um `syncServerTime` válido? */
export function isServerClockSynced(): boolean {
  return synced;
}

/** Offset atual (ms), para testes e diagnóstico. */
export function serverOffset(): number {
  return offset;
}

/**
 * Chamado pelo apiClient em toda resposta com `serverTime` e pelo ack do `lot:join`. **Eventos do Socket.IO não
 * chamam isto** (R-4.10): o atraso de rede de cada um daria saltos no cronômetro. Sem `sample` (a carga do SSR),
 * assume latência zero e a próxima medição de verdade a substitui.
 */
export function syncServerTime(iso: string, sample?: ClockSample): void {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return;
  if (sample) {
    best = chooseOffset(best, parsed, sample);
    offset = best.offset;
  } else {
    best = null;
    offset = parsed - Date.now();
  }
  synced = true;
  current = serverNow();
  emit();
}

/** Só para testes. */
export function resetServerClock(): void {
  offset = 0;
  synced = false;
  best = null;
  current = Date.now();
}

/** Para `useSyncExternalStore`: inscreve e liga o tique de 1 s. */
export function subscribeServerClock(listener: () => void): () => void {
  listeners.add(listener);
  current = serverNow();
  timer ??= setInterval(() => {
    current = serverNow();
    emit();
  }, 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Último tique do relógio (estável entre leituras, como pede o `useSyncExternalStore`). */
export function serverClockSnapshot(): number {
  return current;
}

/** Valor do relógio no primeiro render: o `serverTime` da própria carga, para casar com o HTML do servidor. */
export function hydrationNow(serverTime: string | undefined): number {
  const parsed = serverTime ? Date.parse(serverTime) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

