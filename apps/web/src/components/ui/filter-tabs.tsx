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
}

/** Grupo de botões `aria-pressed`: um filtro ativo por vez. Canto reto, 48px de altura. */
export function FilterTabs<Value extends string>({ label, tabs, value, onChange }: FilterTabsProps<Value>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.value)}
            className={`t-botao inline-flex h-12 items-center gap-2 rounded-nenhum border-[3px] border-linha px-4 ${
              active ? "bg-tinta text-fundo" : "bg-transparent text-tinta"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="font-mono text-[14px] font-semibold">{String(tab.count).padStart(2, "0")}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
