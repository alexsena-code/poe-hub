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
  const password = process.env.ADMIN_PASSWORD || "admin123";

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
      vpsCostMonthly: 50.0,
      dpbLicenseCostMonthly: 30.0,
      otherFixedCostsMonthly: 0,
      otherVariableCostPerBot: 0,
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
