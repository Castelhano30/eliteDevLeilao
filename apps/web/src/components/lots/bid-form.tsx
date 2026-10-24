"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { BID_TEXT, formatBRL, parseReais, type LotState, type PlaceBidResponse } from "@lanceauto/shared";
import { WALLET_LEDGER_KEY, WALLET_SUMMARY_KEY } from "@/components/auth-provider";
import { MoneyField } from "@/components/money-field";
import { Button } from "@/components/ui/button";
import { RefusalMessage } from "@/components/ui/refusal-message";
import { apiPost } from "@/lib/api-client";
import { describeBidFailure, type BidFailure } from "@/lib/bid-refusal";
import { applyBidResponse, applyShortcut, BID_SHORTCUTS, initialField, lockedFooter, syncField, type BidField, type Situation } from "@/lib/lot-state";
import { lotKey } from "@/lib/lot-query";
import { BID_MAX_DIGITS } from "@/lib/money-mask";

const INPUT_ID = "lance-valor";
const REFUSAL_ID = "lance-recusa";

export interface BidFormProps {
  id: string;
  lot: LotState["lot"];
  situation: Situation;
}

/**
 * Formulário de lance (§9.3): campo em reais inteiros, atalhos que somam ao valor digitado, envio por botão ou Enter.
 * Sem atualização otimista (INV-1): a tela só muda com a resposta do servidor. Uma recusa por vez, colada ao botão.
 */
export function BidForm({ id, lot, situation }: BidFormProps) {
  const queryClient = useQueryClient();
  const [field, setField] = useState<BidField>(() => initialField(lot.minimumBidCents));
  const [refusal, setRefusal] = useState<BidFailure | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  // Enquanto não editado, o campo acompanha o mínimo (ex.: depois do refetch de um OUTDATED).
  const synced = syncField(field, lot.minimumBidCents);
  if (synced !== field) setField(synced);

  const refocus = () => document.getElementById(INPUT_ID)?.focus();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const amountCents = parseReais(field.text);
    if (amountCents === null || amountCents <= 0) {
      setRefusal({ message: BID_TEXT.emptyField, invalid: true, refetch: false });
      return;
    }
    inFlight.current = true;
    setSending(true);
    setRefusal(null);
    const result = await apiPost<PlaceBidResponse>(`/lots/${encodeURIComponent(id)}/bids`, {
      amountCents,
      expectedCurrentCents: lot.currentBidCents,
    });
    inFlight.current = false;
    setSending(false);

    if (result.ok) {
      const response = result.data;
      queryClient.setQueryData<LotState>(lotKey(id), (previous) => (previous ? applyBidResponse(previous, response) : previous));
      queryClient.setQueryData(WALLET_SUMMARY_KEY, response.wallet);
      void queryClient.invalidateQueries({ queryKey: WALLET_LEDGER_KEY });
      // Reconcilia o histórico de terceiros com o servidor.
      void queryClient.invalidateQueries({ queryKey: lotKey(id) });
      setField(initialField(response.lot.minimumBidCents));
      refocus();
      return;
    }
    const failure = describeBidFailure(result.status, result.error);
    setRefusal(failure);
    if (failure.refetch) void queryClient.invalidateQueries({ queryKey: lotKey(id) });
    refocus();
  }

  const edit = (next: BidField) => {
    setField(next);
    setRefusal(null);
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <MoneyField
        id={INPUT_ID}
        label="Seu lance"
        value={field.text}
        maxDigits={BID_MAX_DIGITS}
        onChange={(text) => edit({ text, dirty: true })}
        invalid={refusal?.invalid === true}
        help={`Mínimo aceito ${formatBRL(lot.minimumBidCents)} · incremento ${formatBRL(lot.minIncrementCents)}`}
        describedBy={refusal ? REFUSAL_ID : undefined}
      />
      <div role="group" aria-label="Atalhos de valor" className="flex flex-wrap gap-2">
        {BID_SHORTCUTS.map((reais) => (
          <Button key={reais} variant="atalho" onClick={() => edit(applyShortcut(field, reais, lot.minimumBidCents))}>
            + {formatBRL(reais * 100).replace(",00", "")}
          </Button>
        ))}
      </div>
      <Button
        variant="primario"
        type="submit"
        loading={sending}
        loadingText={BID_TEXT.sending}
        aria-busy={sending || undefined}
        className="w-full !min-h-12 !text-[24px]"
      >
        Dar lance
      </Button>
      {refusal ? (
        <div id={REFUSAL_ID}>
          <RefusalMessage action={refusal.action}>{refusal.message}</RefusalMessage>
        </div>
      ) : null}
      <p className="t-mono">{lockedFooter(situation)}</p>
    </form>
  );
}
