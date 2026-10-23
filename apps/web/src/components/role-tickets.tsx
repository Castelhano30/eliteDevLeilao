"use client";

import { useId } from "react";
import type { Role } from "@lanceauto/shared";

const OPTIONS: { role: Role; title: string; note: string }[] = [
  { role: "BIDDER", title: "LICITANTE", note: "Dá lances e guarda saldo." },
  { role: "AUCTIONEER", title: "LEILOEIRO", note: "Monta lotes e recebe as vendas." },
];

export interface RoleTicketsProps {
  value: Role;
  onChange: (role: Role) => void;
  error?: string;
}

/** "Eu sou": dois bilhetes de papel que são radios escondidos de forma acessível (nunca `display:none`). */
export function RoleTickets({ value, onChange, error }: RoleTicketsProps) {
  const name = useId();
  return (
    <fieldset aria-describedby={error ? `${name}-erro` : undefined}>
      <legend className="t-mono-rotulo mb-2">Eu sou</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const checked = value === option.role;
          return (
            <label
              key={option.role}
              className={`block cursor-pointer rounded-nenhum border-[3px] border-linha px-4 py-3 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-tinta ${
                checked ? "bg-ocre text-sobreOcre shadow-botao" : "bg-papel text-tinta"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.role}
                checked={checked}
                onChange={() => onChange(option.role)}
                className="sr-only"
              />
              <span className="t-cartaz-subtitulo block">{option.title}</span>
              <span className={`t-body-nota block ${checked ? "!text-sobreOcre" : ""}`}>{option.note}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${name}-erro`} className="t-body-nota mt-2 !text-ferrugem">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
