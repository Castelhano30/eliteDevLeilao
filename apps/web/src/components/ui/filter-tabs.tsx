export interface FilterTab<Value extends string> {
  value: Value;
  label: string;
  /** Contador opcional, mostrado com dois dígitos. */
  count?: number;
}

export interface FilterTabsProps<Value extends string> {
  /** Nome do grupo para leitores de tela. */
  label: string;
  tabs: FilterTab<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** Classes do invólucro (largura e `flex` na barra onde o trilho mora). */
  className?: string;
}

// Classes literais, para o Tailwind gerá-las. `aria-pressed:` é o selecionado; o noite ganha a borda `destaque` pelo token `ocreBorda`
// (o `ocre` sozinho dá só 2,35:1 sobre o trilho). A área clicável sobe a 44px por um pseudo-elemento.
const SEGMENT =
  "group relative inline-flex h-9 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-full border border-transparent bg-transparent px-[14px] t-filtro text-tinta transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] " +
  "not-disabled:active:translate-y-px not-disabled:not-aria-pressed:hover:bg-selecionado not-disabled:not-aria-pressed:hover:text-ocreTextoHover " +
  "aria-pressed:border-ocreBorda aria-pressed:bg-ocre aria-pressed:text-sobreOcre aria-pressed:shadow-botao not-disabled:aria-pressed:hover:bg-ocreHover " +
  "disabled:cursor-not-allowed disabled:text-tinta2 disabled:aria-pressed:border-linha disabled:aria-pressed:bg-papel disabled:aria-pressed:text-tinta2 disabled:aria-pressed:shadow-none";

const COUNT =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-suave px-1.5 text-[12px] font-bold tabular-nums leading-none text-tinta group-aria-pressed:bg-white/20 group-aria-pressed:text-sobreOcre group-disabled:text-tinta2";

/**
 * Controle segmentado: grupo de botões `aria-pressed`, um selecionado por vez, num trilho de pílula de 44px.
 * O invólucro tem 6px de folga (com margem negativa igual) para o anel de foco não ser cortado quando o trilho rola na horizontal em tela estreita.
 */
export function FilterTabs<Value extends string>({ label, tabs, value, onChange, className = "" }: FilterTabsProps<Value>) {
  return (
    <div className={`-m-1.5 w-fit max-w-full overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`.trim()}>
      <div role="group" aria-label={label} className="inline-flex h-11 w-max min-w-full items-center gap-1 rounded-full border border-linha bg-papel p-[3px]">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button key={tab.value} type="button" aria-pressed={active} onClick={() => onChange(tab.value)} className={SEGMENT}>
              {tab.label}
              {tab.count !== undefined ? <span className={COUNT}>{String(tab.count).padStart(2, "0")}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
