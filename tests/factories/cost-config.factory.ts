import { prisma } from "@/lib/prisma";

let counter = 0;

export function buildCostConfigInput(overrides: Record<string, unknown> = {}) {
  counter++;
  return {
    name: `TestConfig-${counter}`,
    isDefault: false,
    proxyCostPerBotMonthly: 5.0,
    levelingCostPerBot: 10.0,
    stashPackCostPerBot: 2.0,
    expluginsKeyCostDaily: 0.5,
    dpbKeyCostDaily: 0.3,
    notes: null as string | null,
    ...overrides,
  };
}

export async function createCostConfig(overrides: Record<string, unknown> = {}) {
  const input = buildCostConfigInput(overrides);
  return prisma.globalCostConfig.create({
    data: {
      name: input.name as string,
      isDefault: input.isDefault as boolean,
      proxyCostPerBotMonthly: input.proxyCostPerBotMonthly as number,
      levelingCostPerBot: input.levelingCostPerBot as number,
      stashPackCostPerBot: input.stashPackCostPerBot as number,
      expluginsKeyCostDaily: input.expluginsKeyCostDaily as number,
      dpbKeyCostDaily: input.dpbKeyCostDaily as number,
      notes: input.notes as string | null,
    },
  });
}

export async function cleanupCostConfigs() {
  await prisma.simulationCostLink.deleteMany();
  await prisma.globalCostConfig.deleteMany();
}
