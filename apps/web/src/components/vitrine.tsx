"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { formatBrasiliaClock, showcaseGroup, type BrandListResponse, type LotCard as LotCardDto, type LotListResponse, type ShowcaseGroup, GLOBAL_TEXT } from "@lanceauto/shared";
import { CarrosselDestaques } from "@/components/carrossel-destaques";
import { ConnectionBanner } from "@/components/connection-banner";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { SearchField } from "@/components/ui/search-field";
import { SelectField } from "@/components/ui/select-field";
import { Canhoto } from "@/components/lots/canhoto";
import { LotCard } from "@/components/lots/lot-card";
import { LOT_GRID_COLUMNS } from "@/components/lots/lot-card-shell";
import { LotCardSkeletons } from "@/components/lots/lot-card-skeleton";
import { apiGet } from "@/lib/api-client";
import { lotCountLabel } from "@/lib/lots";
import { useConnectionBanner, useConnectionStatus } from "@/lib/realtime/connection-status";
import { INITIAL_OPENING_CHECKS } from "@/lib/lot-state";
import { cardStatusAt, checksForFilter, showcaseRefetchInterval } from "@/lib/realtime/showcase-cache";
import { SHOWCASE_LISTS_KEY, useShowcaseLive } from "@/lib/realtime/use-showcase-live";
import { serverNow } from "@/lib/server-clock";
import { useOnReach, useServerNow } from "@/lib/use-server-clock";
import { BRANDS_KEY, brandOptions, DEFAULT_FILTERS, lotsKey, lotsPath, type VitrineFilters, type VitrineTab } from "@/lib/vitrine-query";

async function fetchLots(filters: VitrineFilters, signal?: AbortSignal): Promise<LotListResponse> {
  const result = await apiGet<LotListResponse>(lotsPath(filters), { signal });
  if (!result.ok) throw new Error("Não consegui trazer os lotes.");
  return result.data;
}

async function fetchBrands(signal?: AbortSignal): Promise<BrandListResponse> {
  const result = await apiGet<BrandListResponse>("/brands", { signal });
  if (!result.ok) throw new Error("Não consegui trazer as marcas.");
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

/** Vitrine (§9.1): carrossel de destaques, "Como funciona", barra "Pátio aberto", filtros e seções. SSR + hidratação. */
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

  const filterKey = lotsPath(filters);
  const closingChecks = useRef({ key: filterKey, checks: INITIAL_OPENING_CHECKS });
  const query = useQuery({
    queryKey: lotsKey(filters),
    queryFn: ({ signal }) => fetchLots(filters, signal),
    placeholderData: keepPreviousData,
    retry: 1,
    // API caída (inclusive no SSR): tenta de novo sozinha até voltar, sem recarregar à mão (AC-2.35).
    // Cartão apurando (fim passou e o servidor ainda não encerrou): olha a cada 3 s até o servidor decidir (§9.2),
    // com teto de respostas novas; o showcase:lot do fechamento zera a conta.
    refetchInterval: (q) => {
      const scoped = checksForFilter(closingChecks.current, filterKey);
      const step = showcaseRefetchInterval({
        failed: q.state.status === "error",
        lots: q.state.data?.lots,
        now: serverNow(),
        checks: scoped.checks,
        dataUpdatedAt: q.state.dataUpdatedAt,
      });
      closingChecks.current = { key: filterKey, checks: step.checks };
      return step.interval;
    },
  });
  // Marcas do seletor: todas as da FIPE. Se a consulta falha ou demora, o seletor segue com as marcas dos lotes.
  const brandsQuery = useQuery({ queryKey: BRANDS_KEY, queryFn: ({ signal }) => fetchBrands(signal), staleTime: 60 * 60 * 1000, retry: 1 });
  // Sala showcase: lance, prorrogação e lote novo chegam sozinhos; reconectar refaz a consulta.
  useShowcaseLive(SHOWCASE_LISTS_KEY);
  const connection = useConnectionStatus();
  const banner = useConnectionBanner(connection);
  const data = query.data;
  const serverTime = data?.serverTime ?? initialServerTime;
  const now = useServerNow(serverTime);
  useRefetchAtNextDeadline(data?.lots ?? [], now, () => void query.refetch());
  // O agendado passa a ao vivo em startsAt pelo relógio do servidor, sem evento (AC-4.24); o GET confirma.
  const shownLots = (data?.lots ?? []).map((lot) => ({ ...lot, status: cardStatusAt(lot, now) }));

  const filtered = filters.q.trim() !== "" || filters.brand !== "" || filters.status !== "ALL";
  const clear = () => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
  };
  const counts = data?.counts;
  const nothingPublished = counts !== undefined && counts.live + counts.scheduled + counts.ended === 0;

  return (
    <div className="mx-auto pb-8" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
      <div className="pt-6">
        <ConnectionBanner view={banner} lastSyncedAt={connection.lastSyncedAt} />
      </div>

      <CarrosselDestaques />

      <section className="sr-only" aria-labelledby={`${searchId}-hero`}>
        <h1 id={`${searchId}-hero`}>
          Quem dá mais, leva.
        </h1>
        <p>Quem hesita, assiste.</p>
        <p>
          Lotes montados a partir da Tabela FIPE, lances ao vivo com saldo de mentira e um comprovante que qualquer pessoa confere. Até quem não tem conta.
        </p>
        <p>Referência: Tabela FIPE. Nenhum carro de verdade troca de dono aqui.</p>
      </section>

      <section id="como-funciona" className="scroll-mt-6 py-6" aria-labelledby="como-funciona-titulo">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="como-funciona-titulo" className="text-[18px] font-extrabold uppercase leading-none">
            Como funciona
          </h2>
          <p className="t-body-legenda text-tinta2">3 passos, nenhum formulário de 12 páginas</p>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          {STEPS.map((step, index) => (
            <Canhoto key={step.title} number={index + 1} title={step.title}>
              {step.text}
            </Canhoto>
          ))}
        </div>
      </section>

      <p className="t-mono-rotulo flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 border-b border-borda pb-3">
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

      {/* Contêiner para o trilho de status ganhar a linha própria quando os três controles não cabem lado a lado. */}
      <section aria-label="Filtros" className="@container flex flex-wrap items-end gap-x-4 gap-y-3 pb-6">
        <SearchField
          id={searchId}
          label="Buscar"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Marca, modelo, ano…"
          className="min-w-[min(100%,260px)] flex-[1_1_260px]"
        />
        <SelectField
          id={brandId}
          label="Marca"
          value={filters.brand}
          onChange={(event) => setFilters((current) => ({ ...current, brand: event.target.value }))}
          className="min-w-[min(100%,200px)] flex-[0_1_200px]"
        >
          <option value="">Todas</option>
          {brandOptions(brandsQuery.data?.brands, data?.brands, filters.brand).map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </SelectField>
        <FilterTabs
          label="Status"
          tabs={TABS}
          value={filters.status}
          onChange={(status) => setFilters((current) => ({ ...current, status }))}
          className="flex-[0_1_auto] @max-[55rem]:w-full"
        />
      </section>

      <div aria-busy={query.isFetching ? "true" : undefined}>
        {!data && query.isPending ? (
          <LotCardSkeletons />
        ) : !data ? (
          <FeedbackState variant="erro" onRetry={() => void query.refetch()}>
            {GLOBAL_TEXT.loadError}
          </FeedbackState>
        ) : (
          <>
            {query.isError ? (
              <FeedbackState variant="erro" onRetry={() => void query.refetch()} className="mb-6">
                {GLOBAL_TEXT.staleError}
              </FeedbackState>
            ) : null}
            {nothingPublished && !filtered ? (
              <FeedbackState variant="vazio">
                <strong className="block">O pátio está vazio.</strong>
                Nenhum lote publicado por enquanto.
              </FeedbackState>
            ) : data.lots.length === 0 ? (
              <div className="t-body border-2 border-dashed border-tracejado bg-papel p-6 text-tinta2" role="status">
                <p className="t-cartaz-subtitulo text-tinta">Pátio vazio</p>
                <p className="mt-2">Nada com esse filtro. Afrouxe a busca ou volte quando o leiloeiro acordar.</p>
                <div className="mt-4">
                  <Button onClick={clear}>Limpar filtros</Button>
                </div>
              </div>
            ) : (
              SECTIONS.map(({ group, title, subtitle }) => {
                const lots = shownLots.filter((lot) => showcaseGroup(lot.status) === group);
                if (lots.length === 0) return null;
                return (
                  <section key={group} aria-labelledby={`secao-${group}`} className="mb-8">
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-[3px] border-linha pb-3">
                      <div>
                        <h2 id={`secao-${group}`} className="text-[length:clamp(24px,3vw,36px)] font-extrabold uppercase leading-none">
                          {title}
                        </h2>
                        <p className="t-body-nota mt-1">{subtitle}</p>
                      </div>
                      <p className="t-mono-dado">{lotCountLabel(lots.length)}</p>
                    </div>
                    <div className="grid gap-6" style={{ gridTemplateColumns: LOT_GRID_COLUMNS }}>
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
