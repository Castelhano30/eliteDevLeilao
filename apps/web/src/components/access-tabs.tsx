"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface AccessTab<Id extends string> {
  id: Id;
  label: string;
  panel: ReactNode;
}

export interface AccessTabsProps<Id extends string> {
  label: string;
  tabs: [AccessTab<Id>, AccessTab<Id>];
  value: Id;
  onChange: (id: Id) => void;
}

/**
 * Abas do Acesso (tablist/tab/tabpanel): ←/→ trocam, Home/End vão às pontas, só a aba ativa entra na ordem de Tab.
 * Os dois painéis ficam montados, só um visível, para o texto digitado e o erro de login sobreviverem à troca.
 */
export function AccessTabs<Id extends string>({ label, tabs, value, onChange }: AccessTabsProps<Id>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.id);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const target: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = target[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-4 flex gap-1 rounded-xl bg-suave p-1">
        {tabs.map((tab, index) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              id={`${base}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${base}-painel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`t-botao min-h-11 flex-1 rounded-lg border px-4 transition-[color,background-color,border-color,box-shadow] duration-150 ease-out ${
                active ? "border-borda bg-papel text-ocreTexto shadow-cartao" : "border-transparent bg-transparent text-tinta2 hover:text-tinta"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border border-borda bg-papel p-6 shadow-cartao">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`${base}-painel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${base}-tab-${tab.id}`}
            hidden={tab.id !== value}
          >
            {tab.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
