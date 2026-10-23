"use client";

import { useEffect, useId, useState } from "react";
import { applyThemeChoice, readThemeChoice, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "sistema", label: "Sistema" },
  { value: "claro", label: "Claro" },
  { value: "noite", label: "Noite" },
];

/** Select nativo "Tema". Sistema é o padrão e remove a escolha gravada. */
export function ThemeSwitch() {
  const id = useId();
  const [choice, setChoice] = useState<ThemeChoice>("sistema");

  // Lê depois de montar, para o HTML do servidor e o primeiro render do cliente serem iguais.
  useEffect(() => {
    setChoice(readThemeChoice());
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="t-mono-rotulo">
        Tema
      </label>
      <select
        id={id}
        value={choice}
        onChange={(event) => {
          const next = event.target.value as ThemeChoice;
          setChoice(next);
          applyThemeChoice(next);
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
