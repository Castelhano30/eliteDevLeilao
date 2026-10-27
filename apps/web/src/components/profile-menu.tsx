"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "./auth-provider";
import { HeaderIcon } from "./ui/header-icon";

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const id = useId();
  const group = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const action = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    action.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !group.current?.contains(event.target)) {
        setOpen(false);
        const destination = event.target.closest("a[href],button,input,select,textarea,[tabindex],[contenteditable=true],label");
        if (!destination) trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  if (!user) return null;
  const words = user.name.trim().split(/\s+/).filter(Boolean);
  const initials = words.length ? `${words[0]?.[0] ?? ""}${words.length > 1 ? words.at(-1)?.[0] ?? "" : ""}`.toLocaleUpperCase("pt-BR") : "—";

  return (
    <div
      ref={group}
      className="relative shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Abrir menu do perfil"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((previous) => !previous)}
        className="group inline-flex min-h-alvo items-center gap-2 rounded-full text-tinta2 hover:text-tinta"
      >
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 items-center sm:h-12 sm:w-12 justify-center rounded-full border-2 border-[var(--h-avatar-borda)] text-[15px] font-extrabold text-[var(--h-avatar-texto)] transition-colors group-hover:bg-[var(--f-azul-interativo)] ${open ? "bg-[var(--f-azul-interativo)]" : "bg-[var(--h-avatar-fundo)]"}`}
        >
          {initials}
        </span>
        <HeaderIcon name="chevron" />
      </button>
      {open ? (
        <div id={id} className="absolute right-0 top-full z-50 mt-2 w-[240px] max-w-[calc(100vw-32px)] border border-linha bg-papel p-4 shadow-cartao">
          <p className="t-body break-words font-semibold">{user.name || "Perfil"}</p>
          <p className="t-mono-rotulo mt-1 text-tinta2">{user.role === "BIDDER" ? "Licitante" : "Leiloeiro"}</p>
          <button
            ref={action}
            type="button"
            className="t-mono mt-3 flex min-h-alvo w-full items-center border-t border-tracejado px-2 text-left hover:bg-suave"
            onClick={() => { setOpen(false); logout(); }}
          >Sair</button>
        </div>
      ) : null}
    </div>
  );
}
