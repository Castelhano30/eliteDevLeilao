"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_LABEL } from "@lanceauto/shared";
import { Button } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { useAuth } from "./auth-provider";

/**
 * Aviso de papel errado. A guarda manda para `homeFor(papel)?aviso=papel`; aqui o aviso é guardado
 * em estado e o parâmetro sai da URL. A tela de origem não vem na URL: "papel certo" é o oposto do papel logado.
 */
export function AvisoPapel() {
  const { user } = useAuth();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [shown, setShown] = useState(false);

  const flagged = params.get("aviso") === "papel";

  // Guarda o aviso assim que ele aparece (estado derivado na renderização); o efeito só limpa a URL.
  if (flagged && user && !shown) setShown(true);

  useEffect(() => {
    if (!flagged || !user) return;
    const next = new URLSearchParams(params.toString());
    next.delete("aviso");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [flagged, user, params, pathname, router]);

  if (!shown || !user) return null;
  const right = user.role === "BIDDER" ? "AUCTIONEER" : "BIDDER";
  return (
    <div className="mx-auto pt-6" style={{ width: "min(100% - 2 * var(--gutter-lateral), 1320px)" }}>
      <FeedbackState variant="vazio">
        Essa tela é de {ROLE_LABEL[right]}. Você entrou como {ROLE_LABEL[user.role]}.
      </FeedbackState>
      <div className="mt-3">
        <Button onClick={() => setShown(false)}>Dispensar</Button>
      </div>
    </div>
  );
}
