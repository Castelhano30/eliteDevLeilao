import Link from "next/link";
import { MY_BIDS_TEXT, type MyBidItem } from "@lanceauto/shared";
import { buttonClasses } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import type { AnnouncementState } from "@/lib/my-bids-events";
import { emptyKind, filterByTab, tabsFor, type MyBidsTab } from "@/lib/my-bids-tabs";
import { BidTicket } from "./bid-ticket";

export interface BidTicketListProps {
  items: readonly MyBidItem[];
  tab: MyBidsTab;
  onTab: (tab: MyBidsTab) => void;
  nowMs: number;
  announcement: AnnouncementState;
}

/**
 * Abas, ingressos, vazios e a região viva (S07 §9). Sem lance nenhum não há abas: só a frase e o link para a vitrine
 * (secundário, sem ocre). A região `aria-live` fica sempre montada; cada anúncio novo é um nó novo (`key`), para o
 * leitor de tela repetir mesmo quando o texto é igual ao anterior.
 */
export function BidTicketList({ items, tab, onTab, nowMs, announcement }: BidTicketListProps) {
  const empty = emptyKind(items, tab);
  const visible = filterByTab(items, tab);

  return (
    <>
      {empty === "total" ? (
        <FeedbackState variant="vazio">
          {MY_BIDS_TEXT.empty}
          <span className="mt-4 block">
            <Link href="/" className={buttonClasses("secundario")}>
              {MY_BIDS_TEXT.emptyAction}
            </Link>
          </span>
        </FeedbackState>
      ) : (
        <>
          <FilterTabs label="Filtrar arremates" tabs={tabsFor(items)} value={tab} onChange={onTab} />
          {empty === "tab" ? (
            <FeedbackState variant="vazio" className="mt-6">
              {MY_BIDS_TEXT.emptyTab}
            </FeedbackState>
          ) : (
            <ul className="m-0 mt-6 flex list-none flex-col gap-6 p-0">
              {visible.map((entry) => (
                <BidTicket key={entry.lot.id} entry={entry} nowMs={nowMs} />
              ))}
            </ul>
          )}
        </>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement.text ? <p key={announcement.seq}>{announcement.text}</p> : null}
      </div>
    </>
  );
}
