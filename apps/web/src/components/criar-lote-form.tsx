"use client";

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import {
  CATALOG_TEXT,
  LOT_TEXT,
  brasiliaLocalToUtcIso,
  formatBRL,
  formatReferenceMonth,
  isHttpUrl,
  parseReais,
  validateCreateLot,
  type CatalogListResponse,
  type CatalogPreviewResponse,
  type CreateLotResponse,
  type LotCard as LotCardDto,
} from "@lanceauto/shared";
import { LotCard } from "@/components/lots/lot-card";
import { LotPhotosField } from "@/components/lot-photos-field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FeedbackState } from "@/components/ui/feedback-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Notice } from "@/components/ui/notice";
import { Field } from "@/components/ui/field";
import { LotTag } from "@/components/ui/lot-tag";
import { PageShell } from "@/components/ui/page-shell";
import { apiGet, apiPost, apiPostForm } from "@/lib/api-client";
import { formatWhen } from "@/lib/format";
import { buildLotForm, imageBodyFields, needsDiscardConfirmation, planImageSubmit, type ImageMode } from "@/lib/lot-photos";
import { useLotPhotos } from "@/lib/use-lot-photos";
import { serverNow } from "@/lib/server-clock";
import { MoneyField } from "./money-field";
import { MY_LOTS_KEY } from "@/lib/lot-query";

/** Falha do catálogo: `fipe` = 503 ou sem resposta (a FIPE ou a rede caiu). */
class CatalogError extends Error {
  constructor(readonly kind: "fipe" | "notfound" | "other", message: string) {
    super(message);
  }
}

async function catalogGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const result = await apiGet<T>(path, { signal });
  if (result.ok) return result.data;
  if (result.status === null || result.status === 503) throw new CatalogError("fipe", CATALOG_TEXT.fipeUnavailable);
  if (result.status === 404) throw new CatalogError("notfound", result.error?.message ?? CATALOG_TEXT.notFound);
  throw new CatalogError("other", result.error?.message ?? "Não deu para consultar o catálogo.");
}

// FIPE tem cota diária: nada de repetir sozinho nem de recarregar ao voltar o foco.
const CATALOG_QUERY = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false } as const;
const seg = encodeURIComponent;

/** Ordem do foco ao validar e o id de cada campo. */
const FIELD_ORDER = [
  ["brandId", "cl-marca"],
  ["modelId", "cl-modelo"],
  ["yearId", "cl-ano"],
  ["title", "cl-titulo"],
  ["startingBidCents", "cl-inicial"],
  ["minIncrementCents", "cl-incremento"],
  ["startsAt", "cl-inicio"],
  ["endsAt", "cl-fim"],
  ["imageUrl", "cl-url"],
  ["imageCredit", "cl-credito"],
  ["imageCreditUrl", "cl-credito"],
  ["images", "cl-fotos"],
] as const;

type Errors = Partial<Record<(typeof FIELD_ORDER)[number][0], string>>;

function Group({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <fieldset aria-labelledby={id} className="min-w-0 rounded-2xl border border-borda bg-papel p-5 shadow-cartao">
      <legend className="sr-only">{`${number} ${title}`}</legend>
      <h2 id={id} className="mb-5 flex items-baseline gap-3 text-[20px] font-extrabold leading-tight">
        <span className="text-[14px] font-bold tabular-nums text-tinta2">{number}</span>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

interface SelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[] | undefined;
  disabled: boolean;
  down: boolean;
  placeholder: string;
  error?: string;
}

function CatalogSelect({ id, label, value, onChange, options, disabled, down, placeholder, error }: SelectProps) {
  return (
    <div>
      <label htmlFor={id} className="t-mono-rotulo mb-2 block">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          required
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erro` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-12 w-full appearance-none rounded-xl border bg-papel px-3 pr-10 text-[16px] text-tinta transition-[border-color] duration-150 ease-out hover:border-tinta2 focus-visible:border-foco disabled:cursor-not-allowed disabled:border-borda disabled:bg-suave disabled:text-tinta2 ${
            error ? "border-ferrugem shadow-[0_0_0_1px_var(--c-ferrugem)]" : "border-linha"
          } ${down ? "opacity-50" : ""}`}
        >
          <option value="">{placeholder}</option>
          {(options ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-tinta2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {error ? (
        <p id={`${id}-erro`} className="t-body-nota mt-2 !text-ferrugem">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Criar lote (§9.3): carro da FIPE, imagem sugerida e regras; nada digitado se perde quando a FIPE cai. */
export function CriarLoteForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [yearId, setYearId] = useState("");
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [startingBid, setStartingBid] = useState("");
  const [increment, setIncrement] = useState("");
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [urlInput, setUrlInput] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState<string | null>(null);
  const [noPhoto, setNoPhoto] = useState(false);
  const [mode, setMode] = useState<ImageMode>("url");
  /** Troca de modo à espera do "sim" do diálogo (há fotos que seriam descartadas). */
  const [pendingMode, setPendingMode] = useState<ImageMode | null>(null);
  /** "Tem certeza?" antes de agendar: guarda título e início do que foi conferido. */
  const [confirming, setConfirming] = useState<{ title: string; startsAt: string } | null>(null);
  const lotPhotos = useLotPhotos();
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailure, setSubmitFailure] = useState<"fipe" | "other" | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const brands = useQuery({ queryKey: ["catalog", "brands"], queryFn: ({ signal }) => catalogGet<CatalogListResponse>("/catalog/brands", signal), ...CATALOG_QUERY });
  const models = useQuery({
    queryKey: ["catalog", "models", brandId],
    queryFn: ({ signal }) => catalogGet<CatalogListResponse>(`/catalog/brands/${seg(brandId)}/models`, signal),
    enabled: brandId !== "",
    ...CATALOG_QUERY,
  });
  const years = useQuery({
    queryKey: ["catalog", "years", brandId, modelId],
    queryFn: ({ signal }) => catalogGet<CatalogListResponse>(`/catalog/brands/${seg(brandId)}/models/${seg(modelId)}/years`, signal),
    enabled: brandId !== "" && modelId !== "",
    ...CATALOG_QUERY,
  });
  // A chave inclui os três ids: resposta atrasada de uma seleção antiga nunca preenche o carro atual.
  const preview = useQuery({
    queryKey: ["catalog", "preview", brandId, modelId, yearId],
    queryFn: ({ signal }) =>
      catalogGet<CatalogPreviewResponse>(`/catalog/preview?brandId=${seg(brandId)}&modelId=${seg(modelId)}&yearId=${seg(yearId)}`, signal),
    enabled: brandId !== "" && modelId !== "" && yearId !== "",
    ...CATALOG_QUERY,
  });

  const catalogQueries: UseQueryResult<unknown>[] = [brands, models, years, preview];
  const fipeErrored = catalogQueries.some((q) => q.isError && q.error instanceof CatalogError && q.error.kind === "fipe");
  const consulting = catalogQueries.some((q) => q.isFetching);
  const fipeDown = (fipeErrored && !consulting) || (submitFailure === "fipe" && !consulting);
  const catalogNotFound = catalogQueries.find((q) => q.error instanceof CatalogError && q.error.kind === "notfound")?.error?.message;

  const retryFailed = () => {
    setSubmitFailure(null);
    for (const q of catalogQueries) if (q.isError) void q.refetch();
  };

  // Valores derivados: a sugestão preenche só enquanto o usuário não editou.
  const model = models.data?.items.find((m) => m.id === modelId);
  const year = years.data?.items.find((y) => y.id === yearId);
  const car = preview.data?.car;
  const defaultTitle = model && year ? `${model.name} ${Number.parseInt(year.id, 10)}` : "";
  const title = titleInput ?? defaultTitle;
  const suggestion = preview.data?.suggestedImage;
  // Sem foto sugerida e sem URL digitada: avisa junto ao campo, em vez de deixá-lo vazio sem explicação.
  const suggestionMissing = mode === "url" && !noPhoto && urlInput === null && !!preview.data && preview.data.imageStatus !== "FOUND";
  const imageUrl = urlInput ?? suggestion?.url ?? "";
  const credit = creditInput ?? (urlInput === null ? (suggestion?.credit ?? "") : "");
  const creditUrl = urlInput === null && creditInput === null ? suggestion?.creditUrl : undefined;

  /** Mexeu no campo: o erro dele sai (o resto fica até o próximo envio). */
  const clear = (...keys: (keyof Errors)[]) =>
    setErrors((current) => {
      if (!keys.some((key) => current[key])) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });

  const chooseBrand = (value: string) => {
    clear("brandId", "modelId", "yearId");
    setBrandId(value);
    setModelId("");
    setYearId("");
  };
  const chooseModel = (value: string) => {
    clear("brandId", "modelId", "yearId");
    setModelId(value);
    setYearId("");
  };
  // Editar a URL apaga o crédito sugerido (evita atribuir à Wikipedia uma foto que não é dela).
  const editUrl = (value: string) => {
    clear("imageUrl", "imageCredit", "imageCreditUrl");
    setUrlInput(value);
    if (creditInput === null) setCreditInput("");
  };

  /** Troca URL por fotos (e vice-versa): o lado que sai é descartado; voltar à URL restaura a sugestão automática. */
  function switchMode(next: ImageMode) {
    if (next === mode) return;
    if (needsDiscardConfirmation(mode, next, lotPhotos.photos.length)) {
      setPendingMode(next);
      return;
    }
    applyMode(next);
  }
  function applyMode(next: ImageMode) {
    clear("imageUrl", "imageCredit", "imageCreditUrl", "images");
    if (next === "upload") {
      setUrlInput(null);
      setCreditInput(null);
    } else {
      lotPhotos.clear();
    }
    setMode(next);
  }

  function buildBody() {
    const startsAt = startsLocal ? (brasiliaLocalToUtcIso(startsLocal) ?? startsLocal) : undefined;
    const endsAt = endsLocal ? (brasiliaLocalToUtcIso(endsLocal) ?? endsLocal) : undefined;
    return {
      brandId,
      modelId,
      yearId,
      title,
      startingBidCents: parseReais(startingBid) ?? undefined,
      minIncrementCents: parseReais(increment) ?? undefined,
      startsAt,
      endsAt,
      ...imageBodyFields(mode, noPhoto, {
        imageUrl: imageUrl.trim() || undefined,
        imageCredit: credit.trim() || undefined,
        imageCreditUrl: imageUrl.trim() ? creditUrl : undefined,
      }),
    };
  }

  function focusFirst(fields: Errors) {
    const first = FIELD_ORDER.find(([key]) => fields[key]);
    if (first) requestAnimationFrame(() => document.getElementById(first[1])?.focus());
  }

  /** `confirmed`: o leiloeiro já respondeu "Sim, agendar" (ou é a nova tentativa depois de uma falha). */
  async function submit(event?: FormEvent, confirmed = false) {
    event?.preventDefault();
    // Fotos ainda sendo reduzidas: esperar, senão iria menos foto do que a escolhida (ou "escolha ao menos uma").
    if (submitting || lotPhotos.busy) return;
    setSubmitFailure(null);
    setSubmitMessage(null);
    const body = buildBody();
    const check = validateCreateLot(body, serverNow());
    const plan = planImageSubmit(mode, noPhoto, lotPhotos.photos.length);
    if (!check.ok || plan.kind === "missing") {
      const fields = { ...(check.ok ? {} : check.fields), ...(plan.kind === "missing" ? { images: plan.error } : {}) } as Errors;
      setErrors(fields);
      focusFirst(fields);
      return;
    }
    setErrors({});
    if (!confirmed) {
      setConfirming({ title: check.data.title, startsAt: check.data.startsAt });
      return;
    }
    setSubmitting(true);
    const result = plan.kind === "multipart"
      ? await apiPostForm<CreateLotResponse>("/lots", buildLotForm(check.data, lotPhotos.photos))
      : await apiPost<CreateLotResponse>("/lots", check.data);
    setSubmitting(false);
    if (result.ok) {
      void queryClient.invalidateQueries({ queryKey: MY_LOTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["lots"] });
      const failed = result.data.imageStatus === "FAILED" ? "&imagem=falhou" : "";
      router.push(`/painel?criado=${result.data.lot.number}${failed}`);
      return;
    }
    const code = result.error?.code;
    const fields = (result.error?.details as { fields?: Errors } | undefined)?.fields;
    if (code === "VALIDATION" && fields) {
      setErrors(fields);
      focusFirst(fields);
    } else if (code === "EXTERNAL_UNAVAILABLE") {
      setSubmitFailure("fipe");
    } else if (code === "NOT_FOUND") {
      setErrors({ brandId: result.error?.message ?? CATALOG_TEXT.notFound });
      focusFirst({ brandId: "x" });
    } else if (result.status !== null && result.status < 500 && result.error) {
      setSubmitMessage(result.error.message);
    } else {
      setSubmitFailure("other");
    }
  }

  const errorCount = Object.keys(errors).length;
  const carError = errors.brandId ?? errors.modelId ?? errors.yearId;
  const fipeLabel = consulting ? "CONSULTANDO A FIPE…" : fipeDown ? "FIPE FORA DO AR" : "TABELA FIPE CONECTADA";
  const fipeColor = consulting ? "var(--c-tinta2)" : fipeDown ? "var(--c-ferrugem)" : "var(--c-verde)";
  const hasCar = Boolean(car) && !fipeDown;
  const startsIso = startsLocal ? brasiliaLocalToUtcIso(startsLocal) : null;
  // Prévia: a capa escolhida no aparelho (blob:) ou a URL digitada, a que valer no modo de agora.
  const previewImage = noPhoto ? null : mode === "upload" ? (lotPhotos.photos[0]?.previewUrl ?? null) : isHttpUrl(imageUrl) ? imageUrl : null;

  const previewCard: LotCardDto = {
    id: "previa",
    number: 0,
    title: hasCar ? title || defaultTitle || "Lote sem título" : "Carro a definir",
    brand: car?.brand ?? "",
    model: car?.model ?? "",
    year: hasCar && car ? car.year : 0,
    fuel: car?.fuel ?? "",
    status: "SCHEDULED",
    currentBidCents: null,
    startingBidCents: parseReais(startingBid) ?? 0,
    minIncrementCents: parseReais(increment) ?? 0,
    referencePriceCents: car?.referencePriceCents ?? 0,
    bidCount: 0,
    version: 0,
    startsAt: startsIso ?? "",
    endsAt: "",
    originalEndsAt: "",
    cancelledAt: null,
    imageUrl: previewImage,
  };

  return (
    <PageShell>
      <p className="t-mono-rotulo">
        <Link href="/painel" className="inline-flex min-h-alvo items-center">PAINEL</Link> / CRIAR LOTE
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <h1 className="t-display-titulo">Criar lote</h1>
        <LotTag number="NOVO" rotate={3} />
      </div>
      <p className="t-body-lead mt-4">Escolha o carro na Tabela FIPE, ajuste as regras e solte no pátio.</p>

      {fipeDown ? (
        <Notice
          kind="erro"
          className="mt-8"
          footer={
            <Button
              loading={consulting}
              loadingText="Consultando…"
              onClick={() => (submitFailure === "fipe" && !fipeErrored ? void submit(undefined, true) : retryFailed())}
            >
              Tentar de novo
            </Button>
          }
        >
          <p className="font-extrabold">{CATALOG_TEXT.fipeUnavailable}</p>
          <p className="mt-1">{CATALOG_TEXT.fipeUnavailableBody}</p>
        </Notice>
      ) : null}

      {errorCount > 1 ? (
        <Notice kind="erro" className="mt-8">
          Corrija os campos marcados.
        </Notice>
      ) : null}

      <div className="mt-8 flex flex-wrap items-start gap-8">
        <form noValidate onSubmit={(event) => void submit(event)} className="min-w-0 space-y-6" style={{ flex: "1 1 560px" }}>
          <Group number="01" title="O carro">
            <p role="status" aria-live="polite" className="t-mono-rotulo inline-flex items-center gap-2" style={{ color: fipeColor }}>
              <span
                aria-hidden="true"
                className="inline-block h-[10px] w-[10px] rounded-circulo"
                style={{ background: fipeColor, animation: consulting || fipeDown ? "la-pulsa 1.2s infinite" : undefined }}
              />
              {fipeLabel}
            </p>
            <CatalogSelect
              id="cl-marca"
              label="1 · MARCA"
              value={brandId}
              onChange={chooseBrand}
              options={brands.data?.items}
              disabled={fipeDown || !brands.data}
              down={fipeDown}
              placeholder={brands.isFetching ? "Carregando marcas…" : "Escolha a marca"}
              error={carError}
            />
            <CatalogSelect
              id="cl-modelo"
              label="2 · MODELO"
              value={modelId}
              onChange={chooseModel}
              options={models.data?.items}
              disabled={fipeDown || !brandId || !models.data}
              down={fipeDown}
              placeholder={models.isFetching ? "Carregando modelos…" : "Escolha o modelo"}
            />
            <CatalogSelect
              id="cl-ano"
              label="3 · ANO / COMBUSTÍVEL"
              value={yearId}
              onChange={(value) => {
                clear("brandId", "modelId", "yearId");
                setYearId(value);
              }}
              options={years.data?.items}
              disabled={fipeDown || !modelId || !years.data}
              down={fipeDown}
              placeholder={years.isFetching ? "Carregando anos…" : "Escolha o ano"}
            />
            {catalogNotFound && !fipeDown ? <FeedbackState variant="vazio">{catalogNotFound}</FeedbackState> : null}
            {hasCar && car ? (
              <div className="rounded-xl border border-borda bg-suave p-4">
                <p className="t-mono-rotulo">REFERÊNCIA FIPE · {formatReferenceMonth(car.referenceMonth)}</p>
                <p className="mt-1 text-[24px] font-extrabold">{formatBRL(car.referencePriceCents)}</p>
                <p className="t-mono mt-1 text-tinta2">
                  {car.brand} · {car.model} · {car.year} · {car.fuel}
                </p>
              </div>
            ) : null}
          </Group>

          <Group number="02" title="A imagem">
            {/* O FilterTabs tem margem negativa (folga do anel de foco); sozinho ele anula o espaço do grupo e cola no campo de baixo. */}
            <div>
              <FilterTabs
                label="Como mandar a imagem"
                tabs={[
                  { value: "url", label: "URL" },
                  { value: "upload", label: "Enviar fotos" },
                ]}
                value={mode}
                onChange={switchMode}
              />
            </div>
            {mode === "url" ? (
              <>
                <Field
                  id="cl-url"
                  label="URL DA IMAGEM · SUGERIDA AUTOMATICAMENTE"
                  type="url"
                  inputMode="url"
                  value={noPhoto ? "" : imageUrl}
                  onChange={(event) => editUrl(event.target.value)}
                  disabled={noPhoto}
                  error={errors.imageUrl}
                  help={preview.isFetching ? "Buscando imagem…" : undefined}
                  className={noPhoto ? "opacity-50" : undefined}
                />
                {suggestionMissing ? (
                  <Notice kind="alerta">{preview.data?.imageStatus === "UNAVAILABLE" ? LOT_TEXT.imageUnavailable : LOT_TEXT.imageNotFound}</Notice>
                ) : null}
                <Field
                  id="cl-credito"
                  label="CRÉDITO DA IMAGEM"
                  value={noPhoto ? "" : credit}
                  onChange={(event) => {
                    clear("imageCredit", "imageCreditUrl");
                    setCreditInput(event.target.value);
                  }}
                  disabled={noPhoto}
                  error={errors.imageCredit ?? errors.imageCreditUrl}
                  className={noPhoto ? "opacity-50" : undefined}
                />
              </>
            ) : (
              <LotPhotosField
                id="cl-fotos"
                photos={lotPhotos.photos}
                busy={lotPhotos.busy}
                messages={lotPhotos.messages}
                disabled={noPhoto}
                error={errors.images}
                onAdd={(files) => {
                  clear("images");
                  void lotPhotos.add(files);
                }}
                onMakeCover={lotPhotos.makeCover}
                onRemove={lotPhotos.remove}
              />
            )}
            <label className="t-body flex min-h-alvo cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-6 w-6" checked={noPhoto} onChange={(event) => setNoPhoto(event.target.checked)} />
              Sem foto. Usar a ilustração padrão do pátio.
            </label>
          </Group>

          <Group number="03" title="As regras">
            <Field
              id="cl-titulo"
              label="TÍTULO DO LOTE"
              value={title}
              onChange={(event) => {
                clear("title");
                setTitleInput(event.target.value);
              }}
              maxLength={160}
              required
              error={errors.title}
            />
            <div className="flex flex-wrap gap-5">
              <div className="min-w-[min(100%,240px)] flex-1">
                <MoneyField id="cl-inicial" label="LANCE INICIAL · R$" value={startingBid} onChange={(value) => {
                    clear("startingBidCents");
                    setStartingBid(value);
                  }} error={errors.startingBidCents} required />
              </div>
              <div className="min-w-[min(100%,240px)] flex-1">
                <MoneyField id="cl-incremento" label="INCREMENTO MÍNIMO · R$" value={increment} onChange={(value) => {
                    clear("minIncrementCents");
                    setIncrement(value);
                  }} error={errors.minIncrementCents} required />
              </div>
            </div>
            <div className="flex flex-wrap gap-5">
              <Field
                id="cl-inicio"
                label="INÍCIO (horário de Brasília)"
                type="datetime-local"
                value={startsLocal}
                onChange={(event) => {
                  clear("startsAt", "endsAt");
                  setStartsLocal(event.target.value);
                }}
                required
                error={errors.startsAt}
                className="min-w-[min(100%,240px)] flex-1"
              />
              <Field
                id="cl-fim"
                label="FIM (horário de Brasília)"
                type="datetime-local"
                value={endsLocal}
                onChange={(event) => {
                  clear("endsAt");
                  setEndsLocal(event.target.value);
                }}
                required
                error={errors.endsAt}
                className="min-w-[min(100%,240px)] flex-1"
              />
            </div>
            <p className="t-body-nota">Lance nos 2 minutos finais estica o fim em +2 min.</p>
          </Group>

          {submitFailure === "other" ? (
            <FeedbackState variant="erro" onRetry={() => void submit(undefined, true)}>
              Não deu para agendar agora.
            </FeedbackState>
          ) : null}
          {submitMessage ? <FeedbackState variant="erro">{submitMessage}</FeedbackState> : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-6">
              {fipeDown ? (
                <Button variant="desabilitado">Agendar lote</Button>
              ) : (
                <Button type="submit" variant="primario" loading={submitting || lotPhotos.busy} loadingText={lotPhotos.busy ? "Reduzindo as fotos…" : "Agendando…"}>
                  Agendar lote
                </Button>
              )}
              <Link href="/painel" className="t-body inline-flex min-h-alvo items-center">
                Voltar ao painel sem salvar
              </Link>
            </div>
            {fipeDown ? (
              <p className="t-body-nota">Sem marca, modelo e ano não tem lote. O resto já está guardado.</p>
            ) : (
              <p className="t-body-nota">Ele aparece em “Agendados” e abre sozinho no horário marcado.</p>
            )}
          </div>
        </form>

        <aside aria-label="Assim ele aparece na Vitrine" className="min-w-0 pt-6" style={{ flex: "1 1 340px", maxWidth: 440 }}>
          <p className="t-mono-rotulo mb-10">ASSIM ELE APARECE NA VITRINE</p>
          <LotCard card={previewCard} preview emptyNote={hasCar ? undefined : "Sem carro escolhido. A FIPE está de folga."} />
          {!noPhoto && mode === "url" && previewImage && credit ? <p className="t-body-legenda mt-3 text-tinta2">{credit}</p> : null}
        </aside>
      </div>
      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={LOT_TEXT.scheduleConfirmTitle}
        cancelLabel={LOT_TEXT.scheduleConfirmBack}
        confirm={{
          label: LOT_TEXT.scheduleConfirmYes,
          onConfirm: () => {
            setConfirming(null);
            void submit(undefined, true);
          },
        }}
      >
        {confirming ? <p>{LOT_TEXT.scheduleConfirmBody(confirming.title, formatWhen(confirming.startsAt))}</p> : null}
      </Dialog>
      <Dialog
        open={pendingMode !== null}
        onClose={() => setPendingMode(null)}
        title={LOT_TEXT.discardPhotosTitle(lotPhotos.photos.length)}
        cancelLabel={LOT_TEXT.discardPhotosKeep}
        confirm={{
          label: LOT_TEXT.discardPhotosConfirm,
          destrutivo: true,
          onConfirm: () => {
            if (pendingMode) applyMode(pendingMode);
            setPendingMode(null);
          },
        }}
      >
        <p>{LOT_TEXT.discardPhotosBody}</p>
      </Dialog>
    </PageShell>
  );
}
