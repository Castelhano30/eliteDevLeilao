"use client";

import { useEffect, useState } from "react";
import { MY_BIDS_TEXT } from "@lanceauto/shared";
import { ConnectionBanner } from "@/components/connection-banner";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageShell } from "@/components/ui/page-shell";
import { INITIAL_ANNOUNCEMENT, advanceAnnouncement, resolveAnchor } from "@/lib/my-bids-events";
import type { MyBidsTab } from "@/lib/my-bids-tabs";
import { useConnectionBanner, useConnectionStatus } from "@/lib/realtime/connection-status";
import { useMyBids } from "@/lib/realtime/use-my-bids";
import { useServerNow } from "@/lib/use-server-clock";
import { BidTicketList } from "./bid-ticket-list";

/** Meus arremates (T5, S07 §9): `/arremates`, só `BIDDER` (a guarda fica na rota). */
export function MyBidsScreen() {
  const query = useMyBids();
  const data = query.data;
  const now = useServerNow(data?.serverTime);
  const connection = useConnectionStatus();
  const banner = useConnectionBanner(connection);
  const [tab, setTab] = useState<MyBidsTab>("ALL");

  // Estado derivado no render, como no Painel: cada resposta nova do servidor passa uma vez pelo anúncio.
  const [announcement, setAnnouncement] = useState(INITIAL_ANNOUNCEMENT);
  const [announcedFrom, setAnnouncedFrom] = useState(data);
  if (data && data !== announcedFrom) {
    setAnnouncedFrom(data);
    setAnnouncement(advanceAnnouncement(announcement, data));
  }

  // Âncora vinda da Carteira (`#lote-018`): na primeira resposta, volta a "Todos" e marca o ingresso para rolar e focar.
  const [anchor, setAnchor] = useState<{ checked: boolean; elementId: string | null }>({ checked: false, elementId: null });
  if (data && !anchor.checked) {
    const hit = resolveAnchor(window.location.hash, data.items);
    setAnchor({ checked: true, elementId: hit?.elementId ?? null });
    if (hit) setTab(hit.tab);
  }
  useEffect(() => {
    if (!anchor.elementId) return;
    const target = document.getElementById(anchor.elementId);
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }, [anchor.elementId]);

  return (
    <PageShell>
      <ConnectionBanner view={banner} lastSyncedAt={connection.lastSyncedAt} />
      <h1 className="font-extrabold uppercase [overflow-wrap:anywhere]" style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1 }}>
        {MY_BIDS_TEXT.title}
      </h1>
      <p className="t-body-lead mb-6 mt-2">Tudo em que você deu lance, do jeito que está agora.</p>

      {!data ? (
        query.isError ? (
          <FeedbackState variant="erro" onRetry={() => void query.refetch()}>
            {MY_BIDS_TEXT.loadError}
          </FeedbackState>
        ) : (
          <FeedbackState variant="carregando">{MY_BIDS_TEXT.loading}</FeedbackState>
        )
      ) : (
        <>
          {query.isError ? (
            <FeedbackState variant="erro" onRetry={() => void query.refetch()} className="mb-6">
              {MY_BIDS_TEXT.stale}
            </FeedbackState>
          ) : null}
          <BidTicketList items={data.items} tab={tab} onTab={setTab} nowMs={now} announcement={announcement} />
        </>
      )}
    </PageShell>
  );
}
