"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { RODAPE_CONTEUDO } from "@/lib/rodape-conteudo";
import { useAuth } from "./auth-provider";

// Classes literais, para o Tailwind gerá-las. `!`: a regra global `a { color }` fica fora de layer e venceria a utility sem ele.
const LINK_BASE = "t-rodape-link inline-flex min-h-alvo items-center no-underline hover:underline hover:underline-offset-[3px]";
const LINK = `${LINK_BASE} !text-tinta2 hover:!text-tinta`;
// A página atual troca a cor (não soma outra utility `!`: a de `tinta2` venceria) e mantém a sua no hover.
const LINK_ATUAL = `${LINK_BASE} !text-ocreTexto hover:!text-ocreTexto`;
const PROVISORIO = "t-rodape-link inline-flex min-h-alvo items-center text-tinta2";
const LARGURA = "min(100% - 2 * var(--gutter-lateral), 1320px)";
// Reserva a altura da lista de "Sua conta" (dois itens) enquanto a sessão carrega, para a coluna não saltar.
const LISTA_CONTA = "min-h-[88px]";

interface FooterLinkProps {
  href: string;
  children: ReactNode;
  /** Só a rota exata marca a página atual; links com `?` ou `#` e os de entrada nunca marcam. */
  marca?: boolean;
}

function FooterLink({ href, children, marca = true }: FooterLinkProps) {
  const pathname = usePathname();
  const atual = marca && !/[?#]/.test(href) && pathname === href;
  return (
    <Link href={href} aria-current={atual ? "page" : undefined} className={atual ? LINK_ATUAL : LINK}>
      {children}
    </Link>
  );
}

function Coluna({ titulo, children, className = "" }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0 flex-[1_1_160px]">
      <p className="t-rodape-titulo text-tinta">{titulo}</p>
      <ul className={`mt-3 ${className}`.trim()}>{children}</ul>
    </div>
  );
}

/** Ícones genéricos de 20px para os três espaços de rede social: nenhuma marca, só formas neutras. */
const ICONES: ReactNode[] = [
  <path key="chat" d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
  <path key="play" d="M9 6.5v11l9-5.5-9-5.5Z" />,
  <g key="foto">
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m5 17 5-4.5 3.5 3 2.5-2L20 17" />
  </g>,
];

function Redes() {
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {Array.from({ length: RODAPE_CONTEUDO.redes.quantidade }, (_, indice) => (
        <span
          key={indice}
          role="img"
          aria-label={RODAPE_CONTEUDO.redes.rotulo}
          className="inline-flex h-11 w-11 cursor-default items-center justify-center rounded-full border border-borda bg-suave text-tinta2"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ICONES[indice % ICONES.length]}
          </svg>
        </span>
      ))}
    </div>
  );
}

/** "Sua conta" muda com o papel, como a navegação do cabeçalho. Enquanto a sessão carrega (ou falha) a lista fica vazia e com a altura reservada. */
function ColunaConta() {
  const { user, status } = useAuth();
  const pronta = status !== "loading" && status !== "error";
  return (
    <Coluna titulo={RODAPE_CONTEUDO.colunas.conta} className={LISTA_CONTA}>
      {!pronta ? null : user?.role === "AUCTIONEER" ? (
        <>
          <li><FooterLink href="/painel">Meus lotes</FooterLink></li>
          <li><FooterLink href="/painel/criar-lote">Criar lote</FooterLink></li>
        </>
      ) : user ? (
        <>
          <li><FooterLink href="/arremates">Meus arremates</FooterLink></li>
          <li><FooterLink href="/carteira">Carteira</FooterLink></li>
        </>
      ) : (
        <>
          <li><FooterLink href="/entrar?aba=entrar">Entrar</FooterLink></li>
          <li><FooterLink href="/entrar" marca={false}>Criar conta</FooterLink></li>
        </>
      )}
    </Coluna>
  );
}

export interface SiteFooterProps {
  /** `completo`: marca, colunas, avisos e direitos. `minimo`: só os avisos e os direitos (Comprovante e Auditoria). */
  variant?: "completo" | "minimo";
  /** Some na impressão (Comprovante). */
  hideOnPrint?: boolean;
}

/**
 * Rodapé global (DESIGN 4.13), espelho do cabeçalho: faixa `papel` com fio de 1px no claro e linha azul de 2px no noite.
 * Todo texto é provisório (`lib/rodape-conteudo.ts`); só vira `<a>` o que tem rota.
 */
export function SiteFooter({ variant = "completo", hideOnPrint = false }: SiteFooterProps) {
  const completo = variant === "completo";
  return (
    <footer className={`rodape mt-16 ${hideOnPrint ? "print:hidden" : ""}`.trim()}>
      <div className="mx-auto pb-8 pt-12" style={{ width: LARGURA }}>
        {completo ? (
          <>
            <div className="flex flex-wrap gap-8">
              <div className="min-w-0 flex-[2_1_280px]">
                <Logo />
                <p className="t-rodape-legal mt-4 max-w-[36ch]">{RODAPE_CONTEUDO.apresentacao}</p>
              </div>
              <nav aria-label="Rodapé" className="flex min-w-0 flex-[3_1_480px] flex-wrap gap-8">
                <Coluna titulo={RODAPE_CONTEUDO.colunas.navegue}>
                  <li><FooterLink href="/">Vitrine</FooterLink></li>
                  <li><FooterLink href="/#como-funciona">Como funciona</FooterLink></li>
                  {RODAPE_CONTEUDO.navegueProvisorios.map((texto) => (
                    <li key={texto}><span className={PROVISORIO}>{texto}</span></li>
                  ))}
                </Coluna>
                <ColunaConta />
                <Coluna titulo={RODAPE_CONTEUDO.colunas.contato}>
                  {RODAPE_CONTEUDO.contatoProvisorios.map((texto) => (
                    <li key={texto}><span className={PROVISORIO}>{texto}</span></li>
                  ))}
                  <li><Redes /></li>
                </Coluna>
              </nav>
            </div>
            <div className="mt-8 border-t border-borda pt-6">
              <p className="t-rodape-legal max-w-[80ch]">{RODAPE_CONTEUDO.avisosLegais}</p>
              <p className="t-rodape-legal mt-4">{RODAPE_CONTEUDO.direitos}</p>
            </div>
          </>
        ) : (
          <>
            <p className="t-rodape-legal max-w-[80ch]">{RODAPE_CONTEUDO.avisosLegais}</p>
            <p className="t-rodape-legal mt-4">{RODAPE_CONTEUDO.direitos}</p>
          </>
        )}
      </div>
    </footer>
  );
}

/** A Sala de lances (`/lotes/<id>`, sem `/auditoria`) não tem rodapé: relógio, painel e histórico são a única coisa na tela. */
export function ocultaRodape(pathname: string): boolean {
  return /^\/lotes\/[^/]+\/?$/.test(pathname);
}

/** Invólucro do grupo `(site)`: o rodapé completo em todas as telas, menos na Sala. */
export function SiteFooterGate() {
  const pathname = usePathname();
  return ocultaRodape(pathname) ? null : <SiteFooter />;
}
