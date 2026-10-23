"use client";

import { useQuery } from "@tanstack/react-query";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";
import { apiGet } from "@/lib/api-client";
import { useSocketConnected } from "@/lib/use-socket-connected";

type Tone = "ok" | "falha" | "neutro";

/** Ponto colorido E texto: a cor nunca está sozinha. Verde só para "ok". */
function StatusRow({ tone, children }: { tone: Tone; children: string }) {
  const color = tone === "ok" ? "bg-verde" : tone === "falha" ? "bg-ferrugem" : "bg-tinta2";
  return (
    <li className="t-mono-dado flex items-center gap-3">
      <span aria-hidden="true" className={`inline-block h-[10px] w-[10px] rounded-circulo ${color}`} />
      {children}
    </li>
  );
}

/** Página diagnóstica provisória: a S02 troca por a Vitrine. */
export default function DiagnosticPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<{ ok: boolean; db: boolean }>("/health", { timeoutMs: 15_000 }),
    retry: false,
  });
  const socketConnected = useSocketConnected();

  const result = health.data;
  const apiUp = result ? result.ok || result.status === 503 : false;
  const dbUp = result?.ok === true && result.data.db;

  return (
    <PageShell title="LanceAuto">
      {health.isPending || health.isFetching ? (
        <FeedbackState variant="carregando">Consultando…</FeedbackState>
      ) : !apiUp ? (
        <FeedbackState variant="erro" onRetry={() => void health.refetch()}>
          Não deu para falar com a API.
        </FeedbackState>
      ) : null}

      {result && !health.isFetching ? (
        <ul className="mt-6 space-y-3" aria-label="Estado dos serviços">
          <StatusRow tone={apiUp ? "ok" : "falha"}>{apiUp ? "API: ok" : "API: fora do ar"}</StatusRow>
          <StatusRow tone={dbUp ? "ok" : apiUp ? "falha" : "neutro"}>
            {dbUp ? "Banco: ok" : apiUp ? "Banco: fora do ar" : "Banco: não verificado"}
          </StatusRow>
          <StatusRow tone={socketConnected ? "ok" : "falha"}>
            {socketConnected ? "Socket: conectado" : "Socket: desconectado"}
          </StatusRow>
        </ul>
      ) : null}
    </PageShell>
  );
}
