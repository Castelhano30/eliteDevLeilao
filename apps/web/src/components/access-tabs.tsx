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
      <div role="tablist" aria-label={label} className="flex">
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
              className={`t-botao relative top-[3px] min-h-12 flex-1 rounded-nenhum border-[3px] border-linha px-4 ${
                active ? "bg-papel text-tinta border-b-papel" : "bg-suave text-tinta2"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="rounded-nenhum border-[3px] border-linha bg-papel p-6 shadow-[8px_8px_0_var(--c-sombra)]">
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
