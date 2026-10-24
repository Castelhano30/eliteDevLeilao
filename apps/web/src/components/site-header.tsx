"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { BalanceChip } from "@/components/balance-chip";
import { ProfileMenu } from "@/components/profile-menu";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useAuth } from "./auth-provider";

const LINK = "t-mono-rotulo inline-flex min-h-alvo items-center border-b-2 border-transparent text-tinta no-underline";
const wideHeader = () => window.matchMedia("(min-width: 1200px)").matches;
function subscribeWidth(listener: () => void) {
  const media = window.matchMedia("(min-width: 1200px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? "page" : undefined} className={`${LINK} ${active ? "!border-tinta" : ""}`}>{children}</Link>;
}

export function SiteHeader() {
  const { user, status } = useAuth();
  // A navegação muda de posição no DOM junto com o layout: Tab acompanha a leitura visual.
  // As chaves preservam os mesmos controles; nenhuma instância é duplicada.
  const wide = useSyncExternalStore(subscribeWidth, wideHeader, () => false);
  const ready = status !== "loading" && status !== "error";
  const nav = !ready ? null : (
    <nav key="nav" aria-label={user?.role === "AUCTIONEER" ? "Leiloeiro" : user ? "Principal" : "Visitante"} className="site-nav flex flex-wrap items-center gap-x-5 gap-y-1">
      {user?.role === "AUCTIONEER" ? <><NavLink href="/painel" exact>Meus lotes</NavLink><NavLink href="/painel/criar-lote">Criar lote</NavLink></> : null}
      <NavLink href="/">Vitrine</NavLink>
      {user?.role === "BIDDER" ? <NavLink href="/carteira">Carteira</NavLink> : null}
      {!user ? <Link href="/#como-funciona" className={LINK}>Como funciona</Link> : null}
      {process.env.NODE_ENV !== "production" ? <NavLink href="/kit">Kit</NavLink> : null}
    </nav>
  );

  return (
    <header className="border-b-2 border-linha bg-papel">
      <div className="site-header mx-auto" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
        <div key="logo" className="site-logo"><Logo /></div>
        {wide ? nav : null}
        <div key="theme" className="site-theme"><ThemeSwitch /></div>
        {ready ? (
          <div key="account" className="site-account flex min-w-0 flex-wrap items-center justify-end gap-2">
            {user ? <>{user.role === "BIDDER" ? <BalanceChip /> : null}<ProfileMenu /></> : <>
              <Link href="/entrar?aba=entrar" className={buttonClasses("secundario")}>Entrar</Link>
              <Link href="/entrar" className={buttonClasses("primario")}>Criar conta</Link>
            </>}
          </div>
        ) : null}
        {!wide ? nav : null}
      </div>
    </header>
  );
}