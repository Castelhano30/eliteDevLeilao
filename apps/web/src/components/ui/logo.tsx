import Link from "next/link";

export interface LogoProps {
  /** "tela" nas páginas do app; "manual" é o tamanho grande da marca. */
  size?: "tela" | "manual";
}

/** Logo-placa: placa Mercosul com a faixa "BRASIL" (decorativa) e "LANCE·AUTO". */
export function Logo({ size = "tela" }: LogoProps) {
  const manual = size === "manual";
  return (
    <Link href="/" aria-label="LanceAuto, vitrine" className="inline-block !text-logoTinta no-underline hover:!text-logoTinta">
      <span
        className={`logo-placa flex flex-col border-2 border-[var(--f-logo-contorno)] bg-logoPapel ${
          manual ? "rounded-logo shadow-cartao" : "rounded-logo-tela shadow-chip"
        }`}
      >
        <span
          aria-hidden="true"
          className="block bg-faixaPlaca text-center font-semibold text-brasilTexto"
          style={
            manual
              ? { fontSize: 12, letterSpacing: "0.5em", padding: "2px 0" }
              : { fontSize: 8, letterSpacing: "0.42em", padding: "1px 0" }
          }
        >
          BRASIL
        </span>
        <span
          className={`relative mx-1 mb-1 block rounded-b-[6px] border-2 border-t-0 border-logoTinta pb-[5px] pt-2 ${
            manual ? "t-logo px-4" : "t-logo-tela px-3"
          }`}
        >
          <i aria-hidden="true" className="absolute left-[5px] top-1/2 h-1 w-1 -translate-y-1/2 rounded-circulo bg-logoTinta" />
          LANCE·AUTO
          <i aria-hidden="true" className="absolute right-[5px] top-1/2 h-1 w-1 -translate-y-1/2 rounded-circulo bg-logoTinta" />
        </span>
      </span>
    </Link>
  );
}
