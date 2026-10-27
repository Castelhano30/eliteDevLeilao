-- Meus arremates (S07): a consulta "lotes em que o usuario deu lance" filtra por bidderId; o indice (lotId, bidderId) comeca por lotId.
CREATE INDEX "Bid_bidderId_idx" ON "Bid"("bidderId");
