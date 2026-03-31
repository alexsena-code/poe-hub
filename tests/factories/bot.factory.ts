import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

let counter = 0;

export function buildBotInput(overrides: Record<string, unknown> = {}) {
  counter++;
  return {
    nick: `TestBot-${counter}`,
    email: `bot${counter}@test.com`,
    password: `password-${counter}`,
    proxyIp: `192.168.1.${counter}`,
    proxyEol: null,
    status: "active" as const,
    notes: null,
    ...overrides,
  };
}

export async function createBot(overrides: Record<string, unknown> = {}) {
  const input = buildBotInput(overrides);
  return prisma.bot.create({
    data: {
      nick: input.nick,
      email: input.email,
      password: encrypt(input.password),
      proxyIp: input.proxyIp,
      proxyEol: input.proxyEol,
      status: input.status,
      notes: input.notes,
    },
  });
}

export async function cleanupBots() {
  await prisma.bot.deleteMany();
}
