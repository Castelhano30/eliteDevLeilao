/**
 * Relógio do servidor (INV-1): `agora = Date.now() + offset`, com o offset de cada resposta que traz
 * `serverTime`. Um só store e um só `setInterval` de 1 s para a tela toda. O relógio do aparelho nunca
 * decide estado: ao chegar a zero a tela só pede o GET e espera o status do servidor.
 * Único arquivo do web (com os formatadores) que lê `Date.now()` (T6).
 */
let offset = 0;
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

/** Offset atual (ms), para testes e diagnóstico. */
export function serverOffset(): number {
  return offset;
}

/** Chamado pelo apiClient em toda resposta com `serverTime` (e pela S04 nos eventos). */
export function syncServerTime(iso: string): void {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return;
  offset = parsed - Date.now();
  current = serverNow();
  emit();
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

