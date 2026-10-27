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

// `!`: a regra global `a { color }` fica fora de layer e venceria a utility sem ele.
const LINK =
  "relative inline-flex min-h-alvo items-center text-[13px] font-bold uppercase tracking-[0.08em] !text-tinta2 no-underline hover:!text-tinta after:absolute after:inset-x-0 after:bottom-[6px] after:h-[3px] after:rounded-full after:bg-transparent";
// Botões da conta (visitante): as mesmas classes dos botões do site, no tamanho compacto (40px, 8px de raio).
const BOTAO_ENTRAR = buttonClasses("secundario", false, "compacto");
const BOTAO_CRIAR = buttonClasses("primario", false, "compacto");
const wideHeader = () => window.matchMedia("(min-width: 1200px)").matches;
function subscribeWidth(listener: () => void) {
  const media = window.matchMedia("(min-width: 1200px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? "page" : undefined} className={`${LINK} ${active ? "!text-[var(--h-ativo-texto)] after:!bg-[var(--h-azul)]" : ""}`}>{children}</Link>;
}

export function SiteHeader() {
  const { user, status } = useAuth();
  // A navegação muda de posição no DOM junto com o layout: Tab acompanha a leitura visual.
  // As chaves preservam os mesmos controles; nenhuma instância é duplicada.
  const wide = useSyncExternalStore(subscribeWidth, wideHeader, () => false);
  const ready = status !== "loading" && status !== "error";
  const nav = !ready ? null : (
    <nav key="nav" aria-label={user?.role === "AUCTIONEER" ? "Leiloeiro" : user ? "Principal" : "Visitante"} className="site-nav flex flex-wrap items-center gap-x-8 gap-y-1">
      {user?.role === "AUCTIONEER" ? <><NavLink href="/painel" exact>Meus lotes</NavLink><NavLink href="/painel/criar-lote">Criar lote</NavLink></> : null}
      <NavLink href="/">Vitrine</NavLink>
      {user?.role === "BIDDER" ? <><NavLink href="/arremates">Meus arremates</NavLink><NavLink href="/carteira">Carteira</NavLink></> : null}
      {!user ? <Link href="/#como-funciona" className={LINK}>Como funciona</Link> : null}
    </nav>
  );

  return (
    <header className="cabecalho">
      <div className="site-header mx-auto" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
        <div key="logo" className="site-logo"><Logo /></div>
        {wide ? nav : null}
        <div key="theme" className="site-theme"><ThemeSwitch /></div>
        {ready ? (
          <div key="account" className="site-account flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-x-4">
            {user ? <>
              {user.role === "BIDDER" ? <><span aria-hidden="true" className="cabecalho-divisor" /><BalanceChip /></> : null}
              <span aria-hidden="true" className="cabecalho-divisor" />
              <ProfileMenu />
            </> : <>
              <span aria-hidden="true" className="cabecalho-divisor" />
              <Link href="/entrar?aba=entrar" className={BOTAO_ENTRAR}>Entrar</Link>
              <Link href="/entrar" className={BOTAO_CRIAR}>Criar conta</Link>
            </>}
          </div>
        ) : null}
        {!wide ? nav : null}
      </div>
    </header>
  );
}
