"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { HeaderIcon } from "./ui/header-icon";

/**
 * Botão hambúrguer e o painel que desce sob o cabeçalho (ancorado em `.cabecalho`, que é `relative`).
 * Aberto, fecha com Esc, toque fora, Tab para fora, navegação, e em qualquer `a` ou `[data-fecha-menu]` dentro do painel.
 */
export function MenuCelular({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Guardar a rota em que abriu faz o menu fechar sozinho quando ela muda (voltar do navegador, por exemplo), sem efeito.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;
  const id = useId();
  const grupo = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Element && !grupo.current?.contains(event.target)) setAbertoEm(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  return (
    <div
      ref={grupo}
      className="site-menu"
      onBlur={(event) => {
        // Sem relatedTarget (Safari não foca botão ao toque) o toque fora já é tratado por `pointerdown`.
        if (aberto && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setAbertoEm(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && aberto) {
          event.preventDefault();
          setAbertoEm(null);
          gatilho.current?.focus();
        }
      }}
    >
      <button
        ref={gatilho}
        type="button"
        aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-linha bg-fundo text-tinta hover:bg-suave"
      >
        <HeaderIcon name={aberto ? "close" : "menu"} size={22} />
      </button>
      {aberto ? (
        <div id={id} className="absolute inset-x-0 top-full z-50 max-h-[80dvh] overflow-y-auto border-b border-borda bg-papel pb-2 shadow-painel">
          <div
            className="mx-auto py-3"
            style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest("a, [data-fecha-menu]")) setAbertoEm(null);
            }}
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
