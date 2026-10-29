"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { BalanceChip, BalanceEyeButton } from "@/components/balance-chip";
import { MenuCelular } from "@/components/menu-celular";
import { ProfileMenu } from "@/components/profile-menu";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useAuth } from "./auth-provider";

// `!`: a regra global `a { color }` fica fora de layer e venceria a utility sem ele.
const LINK_BASE =
  "relative inline-flex min-h-alvo items-center text-[13px] font-bold uppercase tracking-[0.08em] !text-tinta2 no-underline hover:!text-tinta after:absolute after:rounded-full after:bg-transparent";
const LINK = `${LINK_BASE} after:inset-x-0 after:bottom-[6px] after:h-[3px]`;
// No menu do celular o link ocupa a linha toda e o ativo leva uma barra à esquerda, não um sublinhado da largura da tela.
const LINK_LISTA = `${LINK_BASE} w-full after:inset-y-2 after:-left-3 after:w-[3px]`;
// Botões da conta (visitante): as mesmas classes dos botões do site, no tamanho compacto (40px, 8px de raio).
const BOTAO_ENTRAR = buttonClasses("secundario", false, "compacto");
const BOTAO_CRIAR = buttonClasses("primario", false, "compacto");

// celular (<768px): hambúrguer; médio: navegação em linha própria; largo (>=1200px): navegação ao lado do logo.
type Faixa = "celular" | "medio" | "largo";
const CONSULTAS = ["(min-width: 768px)", "(min-width: 1200px)"] as const;
const lerFaixa = (): Faixa => (window.matchMedia(CONSULTAS[1]).matches ? "largo" : window.matchMedia(CONSULTAS[0]).matches ? "medio" : "celular");
function subscribeFaixa(listener: () => void) {
  const medias = CONSULTAS.map((consulta) => window.matchMedia(consulta));
  for (const media of medias) media.addEventListener("change", listener);
  return () => { for (const media of medias) media.removeEventListener("change", listener); };
}

function NavLink({ href, children, exact = false, lista = false }: { href: string; children: ReactNode; exact?: boolean; lista?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} aria-current={active ? "page" : undefined} className={`${lista ? LINK_LISTA : LINK} ${active ? "!text-[var(--h-ativo-texto)] after:!bg-[var(--h-azul)]" : ""}`}>{children}</Link>;
}

export function SiteHeader() {
  const { user, status, logout } = useAuth();
  // A navegação muda de posição no DOM junto com o layout (no celular, para dentro do menu): Tab acompanha a leitura visual.
  // As chaves preservam os mesmos controles; nenhuma instância é duplicada.
  const faixa = useSyncExternalStore(subscribeFaixa, lerFaixa, (): Faixa => "medio");
  const celular = faixa === "celular";
  const ready = status !== "loading" && status !== "error";
  const nav = !ready ? null : (
    <nav key="nav" aria-label={user?.role === "AUCTIONEER" ? "Leiloeiro" : user ? "Principal" : "Visitante"} className={celular ? "flex flex-col gap-1" : "site-nav flex flex-wrap items-center gap-x-8 gap-y-1"}>
      {user?.role === "AUCTIONEER" ? <><NavLink href="/painel" exact lista={celular}>Meus lotes</NavLink><NavLink href="/painel/criar-lote" lista={celular}>Criar lote</NavLink></> : null}
      <NavLink href="/" lista={celular}>Vitrine</NavLink>
      <NavLink href="/como-funciona" lista={celular}>Como Funciona</NavLink>
      {user?.role === "BIDDER" ? <><NavLink href="/arremates" lista={celular}>Meus arremates</NavLink><NavLink href="/carteira" lista={celular}>Carteira</NavLink></> : null}
    </nav>
  );

  return (
    <header className="cabecalho">
      <div className="site-header mx-auto" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
        <div key="logo" className="site-logo"><Logo /></div>
        {faixa === "largo" ? nav : null}
        {celular ? null : <div key="theme" className="site-theme"><ThemeSwitch /></div>}
        {/* Celular: o saldo (licitante) ou o Entrar (visitante) ficam na própria barra, entre o logo e o menu; o resto da conta mora no menu. */}
        {ready && celular && user?.role === "BIDDER" ? <div key="account" className="site-conta-celular"><BalanceChip barra /></div> : null}
        {ready && celular && !user ? <div key="account" className="site-conta-celular"><Link href="/entrar?aba=entrar" className={BOTAO_ENTRAR}>Entrar</Link></div> : null}
        {celular ? (
          <MenuCelular>
            {nav}
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-borda pt-3">
              <span className="t-body">Tema escuro</span>
              <ThemeSwitch />
            </div>
            {user?.role === "BIDDER" ? (
              <div className="mt-2 flex items-center justify-between gap-4 border-t border-borda pt-3">
                <span className="t-body">Exibir saldo</span>
                <BalanceEyeButton />
              </div>
            ) : null}
            {user ? (
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-borda pt-3">
                <div className="min-w-0">
                  <p className="t-body break-words font-semibold">{user.name || "Perfil"}</p>
                  <p className="t-mono-rotulo mt-1 text-tinta2">{user.role === "BIDDER" ? "Licitante" : "Leiloeiro"}</p>
                </div>
                <button type="button" data-fecha-menu className={`${BOTAO_ENTRAR} shrink-0`} onClick={() => logout()}>Sair</button>
              </div>
            ) : (
              <div className="mt-3 border-t border-borda pt-3">
                <Link href="/entrar" className={`${BOTAO_CRIAR} w-full`}>Criar conta</Link>
              </div>
            )}
          </MenuCelular>
        ) : null}
        {ready && !celular ? (
          <div key="account" className="site-account flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-x-4">
            {user ? <>
              {user.role === "BIDDER" ? <><span aria-hidden="true" className="cabecalho-divisor" /><BalanceChip /></> : null}
              <span aria-hidden="true" className="cabecalho-divisor" />
              <ProfileMenu />
            </> : <>
              <span aria-hidden="true" className="cabecalho-divisor" />
              {/* Grade de duas colunas iguais: os botões ficam com a largura do maior ("Criar conta"). */}
              <span className="inline-grid grid-cols-2 gap-x-3 sm:gap-x-4">
                <Link href="/entrar?aba=entrar" className={BOTAO_ENTRAR}>Entrar</Link>
                <Link href="/entrar" className={BOTAO_CRIAR}>Criar conta</Link>
              </span>
            </>}
          </div>
        ) : null}
        {faixa === "medio" ? nav : null}
      </div>
    </header>
  );
}
