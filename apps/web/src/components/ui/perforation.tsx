/** Picote: separa o que se destaca. Linha tracejada com um recorte semicircular em cada lateral. */
export function Perforation({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative h-6 bg-papel ${className}`.trim()}>
      <span className="absolute left-5 right-5 top-[11px] border-t-2 border-dashed border-tracejado" />
      <span className="absolute -left-3 top-0 h-6 w-6 rounded-circulo bg-fundo" />
      <span className="absolute -right-3 top-0 h-6 w-6 rounded-circulo bg-fundo" />
    </div>
  );
}
