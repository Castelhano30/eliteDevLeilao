"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { formatBrasiliaClock, showcaseGroup, type LotCard as LotCardDto, type LotListResponse, type ShowcaseGroup } from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Canhoto } from "@/components/lots/canhoto";
import { LotCard } from "@/components/lots/lot-card";
import { apiGet } from "@/lib/api-client";
import { lotCountLabel } from "@/lib/lots";
import { useOnReach, useServerNow } from "@/lib/use-server-clock";
import { DEFAULT_FILTERS, lotsKey, lotsPath, type VitrineFilters, type VitrineTab } from "@/lib/vitrine-query";

async function fetchLots(filters: VitrineFilters, signal?: AbortSignal): Promise<LotListResponse> {
  const result = await apiGet<LotListResponse>(lotsPath(filters), { signal });
  if (!result.ok) throw new Error("Não consegui trazer os lotes.");
  return result.data;
}

const TABS: { value: VitrineTab; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "LIVE", label: "Ao vivo" },
  { value: "SCHEDULED", label: "Agendados" },
  { value: "ENDED", label: "Encerrados" },
];

const SECTIONS: { group: ShowcaseGroup; title: string; subtitle: string }[] = [
  { group: "LIVE", title: "Ao vivo", subtitle: "Lance nos 2 min finais estica o prazo em +2 min" },
  { group: "SCHEDULED", title: "Agendados", subtitle: "Dá para olhar. Lance, só na abertura." },
  { group: "ENDED", title: "Encerrados", subtitle: "Todo histórico é auditável. Sem login." },
];

const STEPS = [
  { title: "Crie a conta e deposite", text: "Escolha ser licitante, deposite saldo de mentira (até R$ 10 milhões por vez) e fique com o dinheiro à mão." },
  { title: "Dê o seu lance", text: "Cada lote tem lance inicial e incremento mínimo. Lance nos 2 minutos finais estica o relógio em +2 min." },
  { title: "Leve e confira", text: "Maior lance quando o martelo bate leva o carro e ganha um comprovante com link. Qualquer pessoa audita o histórico, sem login." },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Refaz o GET uma vez, 1 s depois que o primeiro cronômetro da lista chega a zero (§9.1). */
function useRefetchAtNextDeadline(lots: LotCardDto[], now: number, refetch: () => void) {
  const targets = lots
    .map((lot) => (lot.status === "SCHEDULED" ? Date.parse(lot.startsAt) : lot.status === "LIVE" ? Date.parse(lot.endsAt) : Number.NaN))
    // O prazo fica na lista até o alvo (prazo + 1 s) passar, para o alvo não mudar antes de disparar.
    .filter((t) => Number.isFinite(t) && t + 1_000 > now);
  const next = targets.length > 0 ? Math.min(...targets) + 1_000 : null;
  useOnReach(next, now, refetch);
}

/** Vitrine (§9.1): barra "Pátio aberto", hero, "Como funciona", filtros e seções. SSR + hidratação. */
export function Vitrine({ initialServerTime }: { initialServerTime?: string }) {
  const [filters, setFilters] = useState<VitrineFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const searchId = useId();
  const brandId = useId();

  // Busca com debounce de 250 ms; marca e aba aplicam na hora.
  useEffect(() => {
    const handle = setTimeout(() => setFilters((current) => (current.q === search ? current : { ...current, q: search })), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const query = useQuery({
    queryKey: lotsKey(filters),
    queryFn: ({ signal }) => fetchLots(filters, signal),
    placeholderData: keepPreviousData,
    retry: 1,
    // API caída (inclusive no SSR): tenta de novo sozinha até voltar, sem recarregar à mão (AC-2.35).
    refetchInterval: (q) => (q.state.status === "error" ? 10_000 : false),
  });
  const data = query.data;
  const serverTime = data?.serverTime ?? initialServerTime;
  const now = useServerNow(serverTime);
  useRefetchAtNextDeadline(data?.lots ?? [], now, () => void query.refetch());

  const filtered = filters.q.trim() !== "" || filters.brand !== "" || filters.status !== "ALL";
  const clear = () => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
  };
  const counts = data?.counts;
  const nothingPublished = counts !== undefined && counts.live + counts.scheduled + counts.ended === 0;

  return (
    <div className="mx-auto pb-16" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
      <p className="t-mono-rotulo flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-dashed border-tracejado py-3">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-circulo bg-ferrugem" style={{ animation: "la-pulsa 1.2s infinite" }} />
          Pátio aberto
        </span>
        {counts ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{plural(counts.live, "lote ao vivo", "lotes ao vivo")}</span>
            <span aria-hidden="true">·</span>
            <span>{plural(counts.scheduled, "agendado", "agendados")}</span>
          </>
        ) : null}
        {now > 0 ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{formatBrasiliaClock(now)}</span>
          </>
        ) : null}
      </p>

      <section className="py-12" aria-labelledby={`${searchId}-hero`}>
        <h1 id={`${searchId}-hero`} className="t-display-hero">
          Quem dá mais, leva.
        </h1>
        <p className="t-body mt-4">Quem hesita, assiste.</p>
        <p className="t-body-lead mt-6 max-w-[760px]">
          Lotes montados a partir da Tabela FIPE, lances ao vivo com saldo de mentira e um comprovante que qualquer pessoa confere. Até quem não tem conta.
        </p>
        <p className="t-body-nota mt-3">Referência: Tabela FIPE. Nenhum carro de verdade troca de dono aqui.</p>
      </section>

      <section id="como-funciona" className="scroll-mt-6 pb-12" aria-labelledby="como-funciona-titulo">
        <h2 id="como-funciona-titulo" className="t-display-secao">
          Como funciona
        </h2>
        <p className="t-body-nota mb-6 mt-2">3 passos, nenhum formulário de 12 páginas</p>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
          {STEPS.map((step, index) => (
            <Canhoto key={step.title} number={index + 1} title={step.title}>
              {step.text}
            </Canhoto>
          ))}
        </div>
      </section>

      <section aria-label="Filtros" className="flex flex-wrap items-end gap-4 pb-8">
        <div className="min-w-[min(100%,260px)] flex-1">
          <label htmlFor={searchId} className="t-mono-rotulo mb-2 block">
            Buscar
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Marca, modelo, ano…"
            className="h-12 w-full rounded-nenhum border-[3px] border-linha bg-fundo px-3 font-serif text-[19px] text-tinta placeholder:text-tinta2"
          />
        </div>
        <div className="min-w-[min(100%,200px)]">
          <label htmlFor={brandId} className="t-mono-rotulo mb-2 block">
            Marca
          </label>
          <select
            id={brandId}
            value={filters.brand}
            onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))}
            className="h-12 w-full rounded-nenhum border-[3px] border-linha bg-fundo px-3 font-serif text-[19px] text-tinta"
          >
            <option value="">Todas</option>
            {(data?.brands ?? []).map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
        <FilterTabs label="Status" tabs={TABS} value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status }))} />
      </section>

      <div aria-busy={query.isFetching ? "true" : undefined}>
        {!data && query.isPending ? (
          <FeedbackState variant="carregando" className="min-h-[200px]" />
        ) : !data ? (
          <FeedbackState variant="erro" onRetry={() => void query.refetch()}>
            Não consegui trazer os lotes.
          </FeedbackState>
        ) : (
          <>
            {query.isError ? (
              <FeedbackState variant="erro" onRetry={() => void query.refetch()} className="mb-6">
                Não consegui trazer os lotes. Os dados abaixo estão desatualizados.
              </FeedbackState>
            ) : null}
            {nothingPublished && !filtered ? (
              <FeedbackState variant="vazio">
                <strong className="block">O pátio está vazio.</strong>
                Nenhum lote publicado por enquanto.
              </FeedbackState>
            ) : data.lots.length === 0 ? (
              <div className="t-body border-[3px] border-dashed border-tracejado bg-papel p-6 text-tinta2" role="status">
                <p className="t-cartaz-subtitulo text-tinta">Pátio vazio</p>
                <p className="mt-2">Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar.</p>
                <div className="mt-4">
                  <Button onClick={clear}>Limpar filtros</Button>
                </div>
              </div>
            ) : (
              SECTIONS.map(({ group, title, subtitle }) => {
                const lots = data.lots.filter((lot) => showcaseGroup(lot.status) === group);
                if (lots.length === 0) return null;
                return (
                  <section key={group} aria-labelledby={`secao-${group}`} className="mb-16">
                    <div className="mb-14 flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-linha pb-3">
                      <div>
                        <h2 id={`secao-${group}`} className="t-display-secao">
                          {title}
                        </h2>
                        <p className="t-body-nota mt-1">{subtitle}</p>
                      </div>
                      <p className="t-mono-dado">{lotCountLabel(lots.length)}</p>
                    </div>
                    <div className="grid gap-x-8 gap-y-10" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 330px), 1fr))" }}>
                      {lots.map((lot) => (
                        <LotCard key={lot.id} card={lot} serverTime={serverTime} />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>

      <footer className="t-body-nota mt-8 border-t-2 border-dashed border-tracejado pt-6">
        <p>Lotes cancelados não aparecem aqui. Nem em sonho.</p>
        <p className="t-mono-rotulo mt-2">Preços de referência: Tabela FIPE · saldo 100% simulado</p>
      </footer>
    </div>
  );
}
