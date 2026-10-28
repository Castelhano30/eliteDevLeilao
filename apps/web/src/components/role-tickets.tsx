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

/** "Eu sou": dois bilhetes selecionáveis (`rounded-xl`) que são radios escondidos de forma acessível (nunca `display:none`). O foco é o anel global do rótulo. */
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
              className={`relative block cursor-pointer rounded-xl border px-4 py-3 text-tinta ${
                checked ? "border-ocre bg-selecionado" : "border-borda bg-papel hover:border-tinta2"
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
              {checked ? (
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-3 text-ocreTexto">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m8 12.5 3 3 5-6" />
                </svg>
              ) : null}
              <span className="block pr-8 text-[16px] font-extrabold leading-tight">{option.title}</span>
              <span className="t-body-nota mt-1 block">{option.note}</span>
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
