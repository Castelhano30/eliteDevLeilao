import { PlacarPosicao } from "@/components/lots/placar-posicao";
import { Stamp } from "@/components/ui/stamp";
import type { MyBidSeal } from "@/lib/my-bid-view";

/** Selo do ingresso: placar de posição ou carimbo do estado final. O texto está sempre lá; a cor não carrega sozinha. */
export function StatusSeal({ seal }: { seal: MyBidSeal }) {
  if (seal.kind === "placar") return <PlacarPosicao tone={seal.tone} title={seal.title} sub={seal.sub} />;
  // Perdido é o carimbo pequeno (S07 §9); Arrematado e Cancelado seguem no tamanho do kit.
  return (
    <div className="py-2">
      <Stamp variant={seal.variant} className={seal.variant === "perdido" ? "!text-[20px]" : ""} />
    </div>
  );
}
