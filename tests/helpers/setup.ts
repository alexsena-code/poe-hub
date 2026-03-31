import { prisma } from "@/lib/prisma";

export async function cleanDatabase() {
  await prisma.simulationCostLink.deleteMany();
  await prisma.simulationDay.deleteMany();
  await prisma.simulationWeek.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.globalCostConfig.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.buyer.deleteMany();
  await prisma.bot.deleteMany();
  await prisma.priceEntry.deleteMany();
  await prisma.discordSource.deleteMany();
  await prisma.task.deleteMany();
  await prisma.league.deleteMany();
  await prisma.proxyConfig.deleteMany();
}

export { prisma };
