"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BalanceChip } from "@/components/balance-chip";
import { buttonClasses } from "@/components/ui/button";
import { IdentityChip } from "@/components/ui/identity-chip";
import { Logo } from "@/components/ui/logo";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useAuth } from "./auth-provider";

const LINK = "t-mono-rotulo inline-flex min-h-alvo items-center border-b-[3px] border-transparent text-tinta no-underline";

/** Item de navegação: o ativo leva sublinhado de 3px e `aria-current="page"`. */
function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${LINK} ${active ? "!border-tinta" : ""}`}
    >
      {children}
    </Link>
  );
}

/** Cabeçalho por papel: visitante, licitante ou leiloeiro (S01 9.3). */
export function SiteHeader() {
  const { user, status, logout } = useAuth();

  return (
    <header className="border-b-4 border-linha bg-papel">
      <div
        className="mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
        style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}
      >
        <Logo />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {status === "loading" || status === "error" ? null : user?.role === "BIDDER" ? (
            <>
              <nav aria-label="Principal" className="flex flex-wrap items-center gap-x-6">
                <NavLink href="/">Vitrine</NavLink>
                <NavLink href="/carteira">Carteira</NavLink>
                {process.env.NODE_ENV !== "production" ? <NavLink href="/kit">Kit</NavLink> : null}
              </nav>
              <BalanceChip />
              <IdentityChip role="licitante" />
              <SignOut onClick={logout} />
            </>
          ) : user?.role === "AUCTIONEER" ? (
            <>
              <nav aria-label="Leiloeiro" className="flex flex-wrap items-center gap-x-6">
                <NavLink href="/painel" exact>
                  Meus lotes
                </NavLink>
                <NavLink href="/painel/criar-lote">Criar lote</NavLink>
                <NavLink href="/">Vitrine</NavLink>
                {process.env.NODE_ENV !== "production" ? <NavLink href="/kit">Kit</NavLink> : null}
              </nav>
              <IdentityChip role="leiloeiro" />
              <SignOut onClick={logout} />
            </>
          ) : (
            <>
              <nav aria-label="Visitante" className="flex flex-wrap items-center gap-x-6">
                <NavLink href="/">Vitrine</NavLink>
                <Link href="/#como-funciona" className={LINK}>
                  Como funciona
                </Link>
                {process.env.NODE_ENV !== "production" ? <NavLink href="/kit">Kit</NavLink> : null}
              </nav>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/entrar?aba=entrar" className={buttonClasses("secundario")}>
                  Entrar
                </Link>
                <Link href="/entrar" className={buttonClasses("primario")}>
                  Criar conta
                </Link>
              </div>
            </>
          )}
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}

function SignOut({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${LINK} bg-transparent underline`}>
      Sair
    </button>
  );
}
