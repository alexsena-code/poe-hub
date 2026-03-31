import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const d = await prisma.dailyPrice.deleteMany();
  const p = await prisma.priceEntry.deleteMany();
  console.log(`Deleted ${p.count} price entries and ${d.count} daily prices`);
  await prisma.$disconnect();
}
main();
