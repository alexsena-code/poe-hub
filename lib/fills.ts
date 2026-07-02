// Deriva o estado de um fill a partir das pernas preenchidas.
// Mantém POST e PATCH consistentes (status e PnL sempre coerentes com os dados).

export type FillLegs = {
  base?: string | null;
  buyRatio?: number | null;
  buyQty?: number | null;
  buyFilledAt?: string | Date | null;
  sellRatio?: number | null;
  sellQty?: number | null;
  sellFilledAt?: string | Date | null;
};

export function deriveStatus(f: FillLegs): "open" | "holding" | "closed" {
  if (f.sellFilledAt) return "closed"; // vendeu -> round-trip fechado
  if (f.buyFilledAt) return "holding"; // comprou, segurando inventário
  return "open"; // ordem de compra postada, ainda enchendo
}

export function derivePnl(f: FillLegs): {
  pnlChaos: number | null;
  pnlDiv: number | null;
} {
  const { buyRatio, sellRatio } = f;
  if (buyRatio == null || sellRatio == null) return { pnlChaos: null, pnlDiv: null };
  const qty = f.sellQty ?? f.buyQty ?? null;
  if (qty == null) return { pnlChaos: null, pnlDiv: null };
  const pnl = (sellRatio - buyRatio) * qty; // lucro na moeda base do flip
  const isChaos = (f.base ?? "Chaos Orb").toLowerCase().includes("chaos");
  return isChaos ? { pnlChaos: pnl, pnlDiv: null } : { pnlChaos: null, pnlDiv: pnl };
}
