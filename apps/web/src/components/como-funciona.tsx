import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-shell";
import { COMO_FUNCIONA } from "@/lib/como-funciona-conteudo";

/** Página "Como Funciona": o título, três passos em cartões e a chamada final para a vitrine. Só leitura, sem estado. */
export function ComoFunciona() {
  const { titulo, introducao, passos, chamada } = COMO_FUNCIONA;
  return (
    <PageShell>
      <h1 className="t-display-titulo">{titulo}</h1>
      <p className="t-body-lead mb-8 mt-3 max-w-[56ch] text-tinta2">{introducao}</p>

      <ol className="grid list-none gap-6 p-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
        {passos.map((passo) => (
          <li key={passo.numero} className="flex flex-col rounded-2xl border border-borda bg-papel p-5 shadow-cartao sm:p-6">
            <span
              aria-hidden="true"
              className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-ocre text-[18px] font-extrabold tabular-nums text-sobreOcre"
            >
              {passo.numero}
            </span>
            <h2 className="text-[24px] font-extrabold leading-tight">
              <span className="sr-only">{`Passo ${Number(passo.numero)}: `}</span>
              {passo.titulo}
            </h2>
            <p className="t-body mt-2">{passo.resumo}</p>
            <ul className="t-body-nota mt-4 flex list-none flex-col gap-3 border-t border-borda p-0 pt-4">
              {passo.pontos.map((ponto) => (
                <li key={ponto} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-ocre" />
                  <span>{ponto}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section aria-labelledby="como-funciona-chamada" className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-2xl border border-borda bg-suave p-6 sm:p-8">
        <div className="min-w-0">
          <h2 id="como-funciona-chamada" className="text-[24px] font-extrabold leading-tight">
            {chamada.titulo}
          </h2>
          <p className="t-body mt-1 text-tinta2">{chamada.texto}</p>
        </div>
        <Link href={chamada.href} className={buttonClasses("primario")}>
          {chamada.botao}
        </Link>
      </section>
    </PageShell>
  );
}
