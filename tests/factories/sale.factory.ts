import { prisma } from "@/lib/prisma";

let saleCounter = 0;
let buyerCounter = 0;

export function buildBuyerInput(overrides: Record<string, unknown> = {}) {
  buyerCounter++;
  return {
    name: `TestBuyer-${buyerCounter}`,
    isCnl: false,
    contact: `buyer${buyerCounter}@test.com`,
    notes: null as string | null,
    ...overrides,
  };
}

export async function createBuyer(overrides: Record<string, unknown> = {}) {
  const input = buildBuyerInput(overrides);
  return prisma.buyer.create({
    data: {
      name: input.name as string,
      isCnl: input.isCnl as boolean,
      contact: input.contact as string | null,
      notes: input.notes as string | null,
    },
  });
}

export function buildSaleInput(buyerId: string, overrides: Record<string, unknown> = {}) {
  saleCounter++;
  return {
    date: "2026-03-15",
    buyerId,
    quantity: 10,
    unit: "divine" as const,
    divinePriceUsd: 1.5,
    divinePriceBrl: 8.0,
    totalUsd: null as number | null,
    totalBrl: null as number | null,
    league: `TestLeague-${saleCounter}`,
    notes: null as string | null,
    ...overrides,
  };
}

export async function createSale(buyerId: string, overrides: Record<string, unknown> = {}) {
  const input = buildSaleInput(buyerId, overrides);
  const quantity = input.quantity as number;
  const divinePriceUsd = (input.divinePriceUsd as number | null) ?? null;
  const divinePriceBrl = (input.divinePriceBrl as number | null) ?? null;

  let totalUsd = (input.totalUsd as number | null) ?? null;
  let totalBrl = (input.totalBrl as number | null) ?? null;

  if (totalUsd == null && divinePriceUsd != null) {
    totalUsd = quantity * divinePriceUsd;
  }
  if (totalBrl == null && divinePriceBrl != null) {
    totalBrl = quantity * divinePriceBrl;
  }

  return prisma.sale.create({
    data: {
      date: new Date(input.date as string),
      buyerId: input.buyerId as string,
      quantity,
      unit: input.unit,
      divinePriceUsd,
      divinePriceBrl,
      totalUsd,
      totalBrl,
      league: input.league as string,
      notes: input.notes as string | null,
    },
    include: {
      buyer: { select: { id: true, name: true, isCnl: true } },
    },
  });
}

export async function cleanupSales() {
  await prisma.sale.deleteMany();
  await prisma.buyer.deleteMany();
}
