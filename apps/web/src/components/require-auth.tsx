"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { homeFor, type Role } from "@lanceauto/shared";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";
import { useAuth } from "./auth-provider";

/**
 * Guarda de rota privada. Enquanto lê o token mostra "Carregando…", sem piscar redirect.
 * Visitante vai a `/entrar?next=`; papel errado vai à home do próprio papel com `?aviso=papel`.
 */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const wrongRole = status === "auth" && user !== null && role !== undefined && user.role !== role;

  useEffect(() => {
    if (status === "anon") router.replace(`/entrar?next=${pathname}`);
    else if (wrongRole && user) router.replace(`${homeFor(user.role)}?aviso=papel`);
  }, [status, wrongRole, user, pathname, router]);

  if (status !== "auth" || wrongRole) {
    return (
      <PageShell>
        <FeedbackState variant="carregando">Carregando…</FeedbackState>
      </PageShell>
    );
  }
  return <>{children}</>;
}
