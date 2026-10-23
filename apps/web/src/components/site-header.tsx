import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ThemeSwitch } from "@/components/ui/theme-switch";

/** Cabeçalho provisório da S00. A S01 troca o conteúdo por papel (visitante, licitante, leiloeiro). */
export function SiteHeader() {
  return (
    <header className="border-b-4 border-linha bg-papel">
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-4 py-4"
        style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}
      >
        <Logo />
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-6">
          <Link href="/" className="t-mono-rotulo">
            Vitrine
          </Link>
          {process.env.NODE_ENV !== "production" ? (
            <Link href="/kit" className="t-mono-rotulo">
              Kit
            </Link>
          ) : null}
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
}
