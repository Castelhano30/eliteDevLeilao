"use client";

import { useSyncExternalStore } from "react";
import { applyThemeChoice, readDarkTheme, subscribeTheme } from "@/lib/theme";
import { HeaderIcon } from "./header-icon";

export function ThemeSwitch() {
  const dark = useSyncExternalStore(subscribeTheme, readDarkTheme, () => false);
  return (
    <button
      type="button"
      role="switch"
      aria-label="Tema escuro"
      aria-checked={dark}
      onClick={() => applyThemeChoice(dark ? "claro" : "noite")}
      className="theme-toggle inline-flex min-h-alvo min-w-[44px] items-center justify-center gap-1 rounded-full border border-linha bg-fundo px-2 hover:bg-suave"
    >
      <span className="theme-sun rounded-full p-1"><HeaderIcon name="sun" /></span>
      <span className="theme-moon rounded-full p-1"><HeaderIcon name="moon" /></span>
    </button>
  );
}