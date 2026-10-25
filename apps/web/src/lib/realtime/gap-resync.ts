export interface GapResyncDeps {
  /** Refaz o `GET` do lote; `true` se aplicou. */
  refetch: () => Promise<boolean>;
  /** O lance fica inerte enquanto `true` (R-4.9 b). */
  onStale: (stale: boolean) => void;
  /** Falhou: tenta de novo agora? (enquanto conectado; ao reconectar, o join + `GET` resolve). */
  canRetry?: () => boolean;
  retryMs?: number;
}

export interface GapResync {
  /** Salto de `version`: o estado está desatualizado até um `GET` aplicar. */
  request(): void;
  /** Um snapshot completo chegou por outro caminho (join + `GET`): não há salto pendente. */
  settle(): void;
  /** Sai da Sala ou troca de lote: nada fica pendurado nem inerte. */
  dispose(): void;
}

/**
 * Refetch por salto de `version` (§9.1 "Desatualizado"): o botão de lance fica inerte até o `GET` aplicar, não só
 * até ele terminar. Falhou, tenta de novo em 3 s; com dois em voo, só o mais recente decide.
 */
export function createGapResync({ refetch, onStale, canRetry = () => true, retryMs = 3_000 }: GapResyncDeps): GapResync {
  let stale = false;
  let generation = 0;
  let disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const set = (next: boolean) => {
    if (next === stale) return;
    stale = next;
    onStale(next);
  };

  function request() {
    if (disposed) return;
    clearTimeout(retry);
    const mine = ++generation;
    set(true);
    void refetch().then((ok) => {
      if (disposed || mine !== generation) return;
      if (ok) set(false);
      else if (canRetry()) retry = setTimeout(request, retryMs);
    });
  }

  return {
    request,
    settle() {
      if (disposed) return;
      generation += 1;
      clearTimeout(retry);
      set(false);
    },
    dispose() {
      disposed = true;
      clearTimeout(retry);
      set(false);
    },
  };
}
