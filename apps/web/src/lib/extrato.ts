import { brasiliaParts } from "@lanceauto/shared";

/** Movimentos por página do extrato: o resto fica nas páginas seguintes. */
export const EXTRATO_POR_PAGINA = 10;

const pad = (n: number) => String(n).padStart(2, "0");

/** Dia em Brasília ("2026-10-28") de uma data ISO UTC: é o que o filtro compara, o mesmo dia que o extrato mostra. */
export function diaDeBrasilia(iso: string): string {
  const { year, month, day } = brasiliaParts(iso);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Data inicial depois da final: o filtro não tem o que mostrar e a tela avisa. */
export function periodoInvertido(de: string, ate: string): boolean {
  return de !== "" && ate !== "" && de > ate;
}

/** Mantém os movimentos do dia `de` ao dia `ate`, os dois inclusive. Campo vazio deixa aquele lado aberto. */
export function filtrarPorPeriodo<T extends { createdAt: string }>(entries: readonly T[], de: string, ate: string): T[] {
  if (de === "" && ate === "") return [...entries];
  return entries.filter((entry) => {
    const dia = diaDeBrasilia(entry.createdAt);
    return (de === "" || dia >= de) && (ate === "" || dia <= ate);
  });
}

/** "2026-10-28" para "28/10/2026". */
export function dataBr(dia: string): string {
  const [ano, mes, d] = dia.split("-");
  return `${d}/${mes}/${ano}`;
}

/** Texto do período aplicado: "24/10/2026 a 28/10/2026", "A partir de 24/10/2026" ou "Até 28/10/2026". Vazio sem filtro. */
export function descreverPeriodo(de: string, ate: string): string {
  if (de !== "" && ate !== "") return de === ate ? dataBr(de) : `${dataBr(de)} a ${dataBr(ate)}`;
  if (de !== "") return `A partir de ${dataBr(de)}`;
  if (ate !== "") return `Até ${dataBr(ate)}`;
  return "";
}
