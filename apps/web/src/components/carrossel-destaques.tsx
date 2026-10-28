"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/** Tempo de cada imagem na tela antes de passar sozinha. */
export const INTERVALO_CARROSSEL_MS = 12_000;

export interface SlideCarrossel {
  src: string;
  alt: string;
}

// Os textos das imagens vão no `alt`: quem não enxerga a arte recebe a mesma mensagem.
export const SLIDES_VITRINE: SlideCarrossel[] = [
  {
    src: "/carrossel/leilao-destaque.webp",
    alt: "LanceAuto. Participe de leilões e conquiste seu próximo carro. Veículos de procedência, lances transparentes e todo o processo 100% online, com histórico completo do veículo.",
  },
  {
    src: "/carrossel/como-funciona.webp",
    alt: "Como funciona? Em 3 passos você já pode participar dos leilões e dar o seu lance: 1, cadastre-se na plataforma; 2, dê o seu lance; 3, leve e confira.",
  },
];

/** Índice vizinho, dando a volta nas pontas. */
export function indiceVizinho(atual: number, total: number, passo: 1 | -1): number {
  return total <= 0 ? 0 : (atual + passo + total) % total;
}

/** Slide que ocupa a faixa, a partir da posição da rolagem. */
export function indiceDaRolagem(rolagem: number, largura: number, total: number): number {
  if (largura <= 0 || total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, Math.round(rolagem / largura)));
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(listener: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const reducedMotion = () => window.matchMedia(reducedMotionQuery).matches;

function subscribeVisibility(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}
const tabHidden = () => document.visibilityState === "hidden";

const CONTROLE =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-linha bg-papel text-tinta transition-colors duration-150 hover:bg-suave active:translate-y-px";

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/**
 * Carrossel de destaques da Vitrine. Rola na horizontal com encaixe (arrastar no toque, setas e pontos no mouse e no teclado)
 * e passa sozinho a cada `INTERVALO_CARROSSEL_MS`. Pausa com o mouse em cima, com o foco do teclado dentro, com a aba escondida
 * e pelo botão; quem pede menos movimento começa pausado.
 */
export function CarrosselDestaques({ slides = SLIDES_VITRINE, intervalMs = INTERVALO_CARROSSEL_MS }: { slides?: SlideCarrossel[]; intervalMs?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [escolha, setEscolha] = useState<"auto" | "rodar" | "pausar">("auto");
  const [mouseEm, setMouseEm] = useState(false);
  const [focoEm, setFocoEm] = useState(false);
  const menosMovimento = useSyncExternalStore(subscribeReducedMotion, reducedMotion, () => false);
  const abaEscondida = useSyncExternalStore(subscribeVisibility, tabHidden, () => false);
  const total = slides.length;

  const automatico = escolha === "rodar" || (escolha === "auto" && !menosMovimento);
  const rodando = automatico && !mouseEm && !focoEm && !abaEscondida && total > 1;

  const irPara = useCallback(
    (alvo: number) => {
      const track = trackRef.current;
      if (!track) return;
      track.scrollTo({ left: alvo * track.clientWidth, behavior: menosMovimento ? "auto" : "smooth" });
    },
    [menosMovimento],
  );

  useEffect(() => {
    if (!rodando) return;
    const timer = setTimeout(() => irPara(indiceVizinho(index, total, 1)), intervalMs);
    return () => clearTimeout(timer);
  }, [rodando, index, total, intervalMs, irPara]);

  const aoRolar = () => {
    const track = trackRef.current;
    if (track) setIndex(indiceDaRolagem(track.scrollLeft, track.clientWidth, total));
  };

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques da Vitrine"
      onMouseEnter={() => setMouseEm(true)}
      onMouseLeave={() => setMouseEm(false)}
      // Só o foco do teclado pausa: clicar numa seta deixaria o foco ali e o carrossel parado para sempre.
      onFocus={(event) => { if (event.target.matches(":focus-visible")) setFocoEm(true); }}
      onBlur={() => setFocoEm(false)}
    >
      <div className="overflow-hidden rounded-xl border border-borda bg-painel shadow-cartao">
        <div
          ref={trackRef}
          onScroll={aoRolar}
          aria-live={rodando ? "off" : "polite"}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => (
            <div key={slide.src} role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${total}`} className="w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- arte estática já otimizada em public/carrossel */}
              <img
                src={slide.src}
                alt={slide.alt}
                width={1800}
                height={601}
                decoding="async"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                draggable={false}
                // No celular a arte inteira ficaria com ~110 px e o texto ilegível: corta pela esquerda, onde está a mensagem.
                className="block h-[210px] w-full select-none object-cover object-left sm:h-auto"
              />
            </div>
          ))}
        </div>
      </div>

      {total > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button type="button" className={CONTROLE} aria-label="Imagem anterior" onClick={() => irPara(indiceVizinho(index, total, -1))}>
            <Icone><path d="m15 18-6-6 6-6" /></Icone>
          </button>
          <div className="flex items-center">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                aria-label={`Ir para a imagem ${i + 1} de ${total}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => irPara(i)}
                className="group inline-flex h-11 w-11 items-center justify-center"
              >
                <span className={`block h-2.5 rounded-full transition-all duration-150 ${i === index ? "w-6 bg-ocreTexto" : "w-2.5 bg-linha group-hover:bg-ocreTexto"}`} />
              </button>
            ))}
          </div>
          <button type="button" className={CONTROLE} aria-label="Próxima imagem" onClick={() => irPara(indiceVizinho(index, total, 1))}>
            <Icone><path d="m9 18 6-6-6-6" /></Icone>
          </button>
          <button
            type="button"
            className={`${CONTROLE} ml-2`}
            aria-label={automatico ? "Pausar a troca automática" : "Retomar a troca automática"}
            aria-pressed={!automatico}
            onClick={() => setEscolha(automatico ? "pausar" : "rodar")}
          >
            <Icone>{automatico ? <><path d="M9 5v14" /><path d="M15 5v14" /></> : <path d="m8 5 11 7-11 7Z" />}</Icone>
          </button>
        </div>
      ) : null}
    </section>
  );
}
