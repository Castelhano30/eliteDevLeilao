/** Grafia canônica de marcas, comparada sem caixa (a FIPE escreve "VolksWagen"). */
const CANONICAL_BRANDS: Record<string, string> = {
  volkswagen: "Volkswagen",
};

/**
 * Nome limpo da marca: "VW - VolksWagen" → "Volkswagen", "GM - Chevrolet" → "Chevrolet".
 * Fica a parte depois do último " - " e aplica a grafia canônica; o resto vem como veio.
 */
export function cleanBrand(name: string): string {
  const cut = name.lastIndexOf(" - ");
  const base = (cut >= 0 ? name.slice(cut + 3) : name).trim();
  return CANONICAL_BRANDS[base.toLowerCase()] ?? base;
}

/**
 * Preço da FIPE em centavos: "R$ 45.000,00" → 4500000. Sem vírgula, o número é em reais inteiros
 * ("R$ 45.000" → 4500000). Texto sem dígitos volta `null`.
 */
export function parseBRL(price: string): number | null {
  const cleaned = price.replace(/[^\d,]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const comma = cleaned.lastIndexOf(",");
  if (comma < 0) return Number(cleaned) * 100;
  const reais = cleaned.slice(0, comma).replace(/,/g, "") || "0";
  const cents = (cleaned.slice(comma + 1) + "00").slice(0, 2);
  return Number(reais) * 100 + Number(cents);
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "outubro de 2026" → "2026-10". Formato que não reconhece volta como veio (sem espaços nas pontas). */
export function parseReferenceMonth(text: string): string {
  const match = /^\s*([\p{L}]+)\s+de\s+(\d{4})\s*$/u.exec(text);
  if (match) {
    const index = MONTHS.indexOf((match[1] ?? "").toLowerCase());
    if (index >= 0) return `${match[2]}-${String(index + 1).padStart(2, "0")}`;
  }
  return text.trim();
}

/** "2026-10" → "OUT/2026"; texto cru (formato desconhecido) volta em maiúsculas. */
export function formatReferenceMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const month = match ? MONTH_SHORT[Number(match[2]) - 1] : undefined;
  return match && month ? `${month}/${match[1]}` : value.toUpperCase();
}

/** "018": número do lote com 3 dígitos (mais, se precisar). */
export function formatLotNumber(number: number): string {
  return String(number).padStart(3, "0");
}

/** Tokens de motor e versão que não são nome de modelo. */
const NON_MODEL_TOKENS = new Set(
  [
    "flex",
    "mpi",
    "mpfi",
    "16v",
    "8v",
    "12v",
    "20v",
    "24v",
    "tdi",
    "tsi",
    "tfsi",
    "turbo",
    "aut",
    "aut.",
    "mec",
    "mec.",
    "cvt",
    "gasolina",
    "diesel",
    "alcool",
    "álcool",
    "4x4",
    "4x2",
  ].map((token) => token.toLowerCase()),
);

/**
 * Cilindrada ou motor/versão. Um inteiro puro só conta como motor fora da primeira posição:
 * "208 Active" e "500 Cult" são nomes de modelo; o "200" de "T-Cross 200 TSI" não.
 */
function isEngineToken(token: string, first: boolean): boolean {
  if (/^\d+[.,]\d+$/.test(token) || /^\d\.\d/.test(token) || NON_MODEL_TOKENS.has(token.toLowerCase())) return true;
  return !first && /^\d+$/.test(token);
}

/**
 * Títulos de artigo a tentar na Wikipedia, em ordem: "{marca} {modelo}" e "{modelo}".
 * O modelo é o primeiro token que não é cilindrada nem motor/versão ("Gol 1.0 MPI" → "Gol";
 * "HB20 Comfort" → "HB20"). O candidato só-modelo só vale se o resumo falar de veículo (ver `isVehicleExtract`).
 */
export function wikiTitleCandidates(brand: string, model: string): string[] {
  const cleanName = cleanBrand(brand);
  const token = model
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .find((part, index) => !isEngineToken(part, index === 0));
  // Sem nome de modelo, o verbete da marca traria logo ou sede, não o carro: nenhum candidato (NOT_FOUND).
  if (!token) return [];
  return [`${cleanName} ${token}`, token];
}

/** O resumo fala de carro? Evita "Gol" companhia aérea e "Uno" jogo de cartas. */
export function isVehicleExtract(extract: string | undefined | null): boolean {
  return /automóve(l|is)|veículo|carro|hatch|sedã|picape|utilitário/i.test(extract ?? "");
}

/** Título na URL da Wikipedia: espaços viram `_` e o resto é codificado. */
export function wikiTitlePath(title: string): string {
  return encodeURIComponent(title.replace(/ /g, "_"));
}

/** Opção de select do catálogo (marca, modelo ou ano). */
export interface CatalogOption {
  id: string;
  name: string;
}

export interface CatalogListResponse {
  items: CatalogOption[];
}

export interface CatalogCar {
  brand: string;
  model: string;
  year: number;
  fuel: string;
  referencePriceCents: number;
  /** "YYYY-MM", ou o texto cru da FIPE se o formato for outro. */
  referenceMonth: string;
  codeFipe: string;
}

export type ImageSuggestionStatus = "FOUND" | "NOT_FOUND" | "UNAVAILABLE";

export interface SuggestedImage {
  url: string;
  credit: string;
  creditUrl: string;
}

export interface CatalogPreviewResponse {
  car: CatalogCar;
  suggestedImage?: SuggestedImage;
  imageStatus: ImageSuggestionStatus;
}

export const CATALOG_TEXT = {
  fipeUnavailable: "A tabela FIPE não respondeu.",
  fipeUnavailableBody: "Tente de novo em instantes. O resto do formulário continua aqui, do jeito que você deixou.",
  notFound: "Esse carro não está na tabela FIPE.",
  roleNotAllowed: "Só leiloeiros fazem isso.",
} as const;

/** Crédito sugerido para a foto da Wikipedia (o resumo não traz autor nem licença do arquivo). */
export function wikiCredit(articleTitle: string): string {
  return `Foto: Wikipedia, artigo "${articleTitle}" (licença Creative Commons, veja a página do artigo)`;
}
