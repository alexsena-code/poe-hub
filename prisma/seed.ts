import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { encrypt } from "../lib/crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set in environment variables before seeding.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, role: "admin" },
    create: {
      username,
      passwordHash,
      role: "admin",
    },
  });

  console.log(`Admin user created/updated: ${admin.username} (${admin.id})`);

  // Seed default cost config
  const costConfig = await prisma.globalCostConfig.upsert({
    where: { id: "default-cost-config" },
    update: {},
    create: {
      id: "default-cost-config",
      name: "Custos Padrão 2026",
      isDefault: true,
      proxyCostPerBotMonthly: 5.0,
      levelingCostPerBot: 50.0,
      stashPackCostPerBot: 0,
      expluginsKeyCostDaily: 1.0,
      dpbKeyCostDaily: 0,
    },
  });

  console.log(`Default cost config: ${costConfig.name} (${costConfig.id})`);

  // Seed default buyer (CNL)
  const cnlBuyer = await prisma.buyer.upsert({
    where: { id: "cnl-buyer" },
    update: {},
    create: {
      id: "cnl-buyer",
      name: "CNL",
      isCnl: true,
      notes: "Revendedor principal",
    },
  });

  console.log(`CNL buyer: ${cnlBuyer.name} (${cnlBuyer.id})`);

  // Seed default proxy config
  const proxyConfig = await prisma.proxyConfig.upsert({
    where: { id: "default-proxy-config" },
    update: {},
    create: {
      id: "default-proxy-config",
      port: 8080,
      username: encrypt(process.env.PROXY_USERNAME || "proxy-user"),
      password: encrypt(process.env.PROXY_PASSWORD || "proxy-pass"),
      notes: "Configuração padrão de proxy compartilhada por todos os bots",
    },
  });

  console.log(`Default proxy config: id=${proxyConfig.id}, port=${proxyConfig.port}`);

  // Seed leagues from historical data
  const { LEAGUES } = await import("./leagues-data.js");

  let leagueCount = 0;
  for (const league of LEAGUES) {
    await prisma.league.upsert({
      where: { name: league.name },
      update: {
        isCurrent: league.isCurrent,
        startDate: league.startDate ? new Date(league.startDate) : null,
        endDate: league.endDate ? new Date(league.endDate) : null,
      },
      create: {
        name: league.name,
        poeVersion: league.poeVersion,
        startDate: league.startDate ? new Date(league.startDate) : null,
        endDate: league.endDate ? new Date(league.endDate) : null,
        isCurrent: league.isCurrent,
      },
    });
    leagueCount++;
  }

  console.log(`Leagues seeded: ${leagueCount} (${LEAGUES.filter(l => l.isCurrent).map(l => l.name).join(", ")} current)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
