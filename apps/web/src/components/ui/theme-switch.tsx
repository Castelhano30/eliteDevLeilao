"use client";

import { useId, useSyncExternalStore } from "react";
import { applyThemeChoice, readThemeChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "sistema", label: "Sistema" },
  { value: "claro", label: "Claro" },
  { value: "noite", label: "Noite" },
];

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Select nativo "Tema". Sistema é o padrão e remove a escolha gravada. */
export function ThemeSwitch() {
  const id = useId();
  // No servidor e na hidratação vale "sistema"; depois o cliente lê o que está gravado.
  const choice = useSyncExternalStore(subscribe, readThemeChoice, (): ThemeChoice => "sistema");

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="t-mono-rotulo">
        Tema
      </label>
      <select
        id={id}
        value={choice}
        onChange={(event) => {
          applyThemeChoice(event.target.value as ThemeChoice);
          listeners.forEach((listener) => listener());
        }}
        className="min-h-12 rounded-nenhum border-[3px] border-linha bg-fundo px-3 font-serif text-[19px] text-tinta"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
