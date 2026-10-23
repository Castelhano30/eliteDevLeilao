import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { AvisoPapel } from "@/components/aviso-papel";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/ui/skip-link";
import { themeInitScript } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

// "Big Shoulders Display" virou "Big Shoulders" (variável, eixo opsz); com `axes` o peso é omitido.
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
  fallback: ["Impact", "sans-serif"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
  fallback: ["monospace"],
});

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "LanceAuto",
  description: "Casa de leilões de carros com lances ao vivo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: o script do tema altera data-theme antes da hidratação.
    <html lang="pt-BR" suppressHydrationWarning className={`${display.variable} ${mono.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          <SkipLink />
          <SiteHeader />
          <main id="conteudo">
            <Suspense fallback={null}>
              <AvisoPapel />
            </Suspense>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
