import { AUDIT_TEXT } from "@lanceauto/shared";
import { Notice } from "@/components/ui/notice";

/** "Como a gente confere": três passos num aviso informativo, abaixo da tabela no celular e ao lado a partir de ~1000 px. */
export function HowWeCheck() {
  return (
    <aside aria-labelledby="como-confere" className="min-w-0" style={{ flex: "1 1 320px", alignSelf: "flex-start" }}>
      <Notice kind="info" role="none">
        <h2 id="como-confere" className="mb-4 text-[18px] font-extrabold leading-tight">
          {AUDIT_TEXT.howTitle}
        </h2>
        <ol className="space-y-4">
          {AUDIT_TEXT.how.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span aria-hidden="true" className="w-6 shrink-0 text-[24px] font-extrabold leading-none tabular-nums">
                {index + 1}
              </span>
              <p className="min-w-0">{step}</p>
            </li>
          ))}
        </ol>
      </Notice>
    </aside>
  );
}
