import type { ReactNode } from "react";
import { formatBRL, formatReferenceMonth, type LotState } from "@lanceauto/shared";

type Car = LotState["car"];

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const ICONES = {
  marca: (
    <Icone>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </Icone>
  ),
  modelo: (
    <Icone>
      <path d="M4 17v-5l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v5Z" />
      <path d="M4 12h16" />
      <circle cx="8" cy="15" r="1" />
      <circle cx="16" cy="15" r="1" />
    </Icone>
  ),
  ano: (
    <Icone>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </Icone>
  ),
  combustivel: (
    <Icone>
      <path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z" />
    </Icone>
  ),
};

/**
 * Ficha técnica da Sala: quatro dados com ícone e, em destaque, o preço de referência com a fonte. Cartão no mesmo
 * padrão do painel de lance (arredondado, fio `borda`, fundo `papel`).
 */
export function FichaCarro({ car }: { car: Car }) {
  const itens = [
    { rotulo: "Marca", valor: car.brand, icone: ICONES.marca },
    { rotulo: "Modelo", valor: car.model, icone: ICONES.modelo },
    { rotulo: "Ano", valor: String(car.year), icone: ICONES.ano },
    { rotulo: "Combustível", valor: car.fuel || "—", icone: ICONES.combustivel },
  ];
  return (
    <div className="mt-6 rounded-2xl border border-borda bg-papel p-6 shadow-cartao">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {itens.map(({ rotulo, valor, icone }) => (
          <div key={rotulo} className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-suave text-ocreTexto">
              {icone}
            </span>
            <div className="min-w-0">
              <dt className="t-mono-rotulo text-tinta2">{rotulo}</dt>
              <dd className="mt-0.5 text-[18px] font-semibold leading-[1.3] [overflow-wrap:anywhere]">{valor}</dd>
            </div>
          </div>
        ))}
        <div className="border-t border-borda pt-5 sm:col-span-2">
          <dt className="t-mono-rotulo text-tinta2">Preço de referência</dt>
          <dd className="mt-1 text-[28px] font-bold leading-[1.2]">{formatBRL(car.referencePriceCents)}</dd>
        </div>
      </dl>
      <p className="t-mono-rotulo mt-3 text-tinta2">FONTE: TABELA FIPE · {formatReferenceMonth(car.referenceMonth)}</p>
    </div>
  );
}
