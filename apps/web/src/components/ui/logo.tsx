import Link from "next/link";

export interface LogoProps {
  /** "tela" nas páginas do app; "manual" é o tamanho grande da marca. */
  size?: "tela" | "manual";
}

/** Logo-placa: placa Mercosul com a faixa "BRASIL" (decorativa) e "LANCE·AUTO". */
export function Logo({ size = "tela" }: LogoProps) {
  const manual = size === "manual";
  return (
    <Link href="/" aria-label="LanceAuto, vitrine" className="inline-block text-tinta no-underline hover:text-tinta">
      <span
        className={`flex flex-col border-4 border-tinta bg-papel ${
          manual ? "rounded-logo shadow-cartao" : "rounded-logo-tela shadow-chip"
        }`}
      >
        <span
          aria-hidden="true"
          className="block bg-faixaPlaca text-center font-mono font-semibold text-brasilTexto"
          style={
            manual
              ? { fontSize: 12, letterSpacing: "0.5em", padding: "2px 0" }
              : { fontSize: 8, letterSpacing: "0.42em", padding: "1px 0" }
          }
        >
          BRASIL
        </span>
        <span
          className={`relative mx-1 mb-1 block rounded-b-[6px] border-2 border-t-0 border-tinta pb-[5px] pt-2 ${
            manual ? "t-logo px-4" : "t-logo-tela px-4"
          }`}
        >
          <i aria-hidden="true" className="absolute left-[5px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-circulo bg-tinta" />
          LANCE·AUTO
          <i aria-hidden="true" className="absolute right-[5px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-circulo bg-tinta" />
        </span>
      </span>
    </Link>
  );
}
