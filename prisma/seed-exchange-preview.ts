// Dados de PREVIEW da página Exchange (Farm → Exchange).
// Baseados em dados reais: o trade validado do Annul (7->9) + candidatos do `mmband`.
// Todos marcados com "[preview]" nas notas -> limpe com: npx tsx prisma/seed-exchange-preview.ts --clean
import "dotenv/config";
import { prisma } from "../lib/prisma";

const LEAGUE = "Ancestors";
const h = (n: number) => new Date(Date.now() - n * 3600 * 1000); // n horas atrás

async function main() {
  if (process.argv.includes("--clean")) {
    const del = await prisma.fill.deleteMany({ where: { notes: { contains: "[preview]" } } });
    console.log(`Removidos ${del.count} fills de preview.`);
    return;
  }

  const rows = [
    // 1) Trade REAL validado (fechado) — Annul comprado a 7c, vendido a 9c
    {
      league: LEAGUE, item: "Orb of Annulment", base: "Chaos Orb", mode: "manual", source: "ui",
      status: "closed",
      buyRatio: 7, buyQty: 23, buyPostedAt: h(72), buyFilledAt: h(71.5), buyQAhead: 3,
      sellRatio: 9, sellQty: 23, sellPostedAt: h(71), sellFilledAt: h(48), sellQAhead: 51,
      fairAtEntry: 7.5, pnlChaos: (9 - 7) * 23,
      notes: "[preview] trade real validado (Annul 7->9)",
    },
    // 2) Fechado — Gemcutter's Prism (candidato mmband)
    {
      league: LEAGUE, item: "Gemcutter's Prism", base: "Chaos Orb", mode: "manual", source: "ui",
      status: "closed",
      buyRatio: 2.3, buyQty: 200, buyPostedAt: h(40), buyFilledAt: h(39), buyQAhead: 0,
      sellRatio: 2.5, sellQty: 200, sellPostedAt: h(38), sellFilledAt: h(30), sellQAhead: 0,
      fairAtEntry: 2.4, pnlChaos: (2.5 - 2.3) * 200,
      notes: "[preview] amostra (mmband)",
    },
    // 3) Segurando inventário — Orb of Scouring (comprou, ainda não vendeu)
    {
      league: LEAGUE, item: "Orb of Scouring", base: "Chaos Orb", mode: "manual", source: "ui",
      status: "holding",
      buyRatio: 0.33, buyQty: 800, buyPostedAt: h(10), buyFilledAt: h(9.5), buyQAhead: 0,
      fairAtEntry: 0.39,
      notes: "[preview] amostra (segurando)",
    },
    // 4) Aberta — Silver Coin (ordem de compra postada, enchendo)
    {
      league: LEAGUE, item: "Silver Coin", base: "Chaos Orb", mode: "manual", source: "ui",
      status: "open",
      buyRatio: 0.29, buyQty: 1500, buyPostedAt: h(2), buyQAhead: 348,
      fairAtEntry: 0.32,
      notes: "[preview] amostra (aberta, fila cheia)",
    },
    // 5) Aberta em rung QUEBRADO (queue-jump), modo semi-auto
    {
      league: LEAGUE, item: "Orb of Annulment", base: "Chaos Orb", mode: "semi", source: "auto",
      status: "open",
      buyRatio: 6.05, buyQty: 30, buyPostedAt: h(0.5), buyQAhead: 3,
      fairAtEntry: 7.5,
      notes: "[preview] amostra (queue-jump 121:20)",
    },
  ];

  for (const r of rows) {
    // @ts-expect-error enums vêm como string literal do array acima
    await prisma.fill.create({ data: r });
  }
  console.log(`Inseridos ${rows.length} fills de preview na liga ${LEAGUE}.`);
  console.log("Para limpar depois: npx tsx prisma/seed-exchange-preview.ts --clean");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
