import { LOADING_TEXT } from "@/components/ui/feedback-state";
import { LOT_CARD_SHELL, LOT_GRID_COLUMNS } from "./lot-card-shell";

// Classes literais, para o Tailwind gerá-las. Os blocos são `suave` com `rounded-md` e pulsam devagar (`la-pulsa`, 1,6s); com
// `prefers-reduced-motion` o `globals.css` zera toda animação e o desenho fica parado, completo.
const PULSE = "animate-[la-pulsa_1.6s_ease-in-out_infinite]";
const BLOCK = `rounded-md bg-suave ${PULSE}`;

/**
 * Um cartão de lote em carregamento: o mesmo casco do cartão (16px, fio `borda`, nível 1) e a mesma anatomia. Foto de 200px, a etiqueta
 * por cima dela no canto esquerdo, título em duas barras (70% e 45%), meta (55%), o fio, o preço (28px, 40%) e o cronômetro (96x52).
 * Puramente decorativo: quem o usa em grupo (`LotCardSkeletons`) põe o `role="status"` e o texto.
 */
export function LotCardSkeleton() {
  return (
    <div aria-hidden="true" className={LOT_CARD_SHELL}>
      <div className="relative h-50 shrink-0">
        <div className={`absolute inset-0 bg-suave ${PULSE}`} />
        {/* Sobre a foto (também `suave`), o bloco da etiqueta usa `borda` para aparecer. */}
        <div className={`absolute left-3 top-5 h-15 w-16 rounded-md bg-borda ${PULSE}`} />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <div className={`h-5 w-[70%] ${BLOCK}`} />
        <div className={`mt-2 h-5 w-[45%] ${BLOCK}`} />
        <div className={`mb-4 mt-3 h-3.5 w-[55%] ${BLOCK}`} />
        <div className="mt-auto flex items-end justify-between gap-4 border-t border-borda pt-4">
          <div className={`h-7 w-[40%] ${BLOCK}`} />
          <div className={`h-13 w-24 shrink-0 rounded-xl bg-suave ${PULSE}`} />
        </div>
      </div>
    </div>
  );
}

/** Primeiro carregamento da Vitrine: três esqueletos na mesma grade dos cartões, num só `status` ocupado com o texto de carregamento. */
export function LotCardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{LOADING_TEXT}</span>
      <div className="grid gap-6" style={{ gridTemplateColumns: LOT_GRID_COLUMNS }}>
        {Array.from({ length: count }, (_, index) => (
          <LotCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
