import { AUDIT_TEXT } from "@lanceauto/shared";

/** "Como a gente confere": três passos, abaixo da tabela no celular e ao lado a partir de ~1000 px. */
export function HowWeCheck() {
  return (
    <aside aria-labelledby="como-confere" className="min-w-0 border-[3px] border-linha bg-papel p-5 shadow-cartao" style={{ flex: "1 1 320px", alignSelf: "flex-start" }}>
      <h2 id="como-confere" className="t-cartaz-subtitulo mb-4">
        {AUDIT_TEXT.howTitle}
      </h2>
      <ol className="space-y-4">
        {AUDIT_TEXT.how.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span aria-hidden="true" className="text-[32px] font-extrabold leading-none">
              {index + 1}
            </span>
            <p className="t-body min-w-0">{step}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
