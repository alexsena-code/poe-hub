import { prisma } from "@/lib/prisma";
import type { BotAlertType, BotAlertSeverity } from "@prisma/client";

let instanceCounter = 0;
let alertCounter = 0;

export function buildInstanceInput(overrides: Record<string, unknown> = {}) {
  instanceCounter++;
  return {
    pcName: `PC-${instanceCounter}`,
    configName: `Config-${instanceCounter}`,
    characterName: `Char-${instanceCounter}`,
    league: "Settlers",
    currentArea: "Hideout",
    botVersion: "1.0.0",
    isOnline: true,
    ...overrides,
  };
}

export async function createInstance(overrides: Record<string, unknown> = {}) {
  const input = buildInstanceInput(overrides);
  return prisma.botInstance.create({
    data: {
      pcName: input.pcName as string,
      configName: input.configName as string,
      characterName: input.characterName as string | null,
      league: input.league as string | null,
      currentArea: input.currentArea as string | null,
      botVersion: input.botVersion as string | null,
      isOnline: input.isOnline as boolean,
      botId: (input.botId as string) ?? null,
    },
  });
}

export function buildAlertInput(
  instanceId: string,
  overrides: Record<string, unknown> = {}
) {
  alertCounter++;
  return {
    instanceId,
    type: "error" as BotAlertType,
    severity: "high" as BotAlertSeverity,
    title: `Alert-${alertCounter}`,
    message: `Something went wrong #${alertCounter}`,
    details: null as string | null,
    acknowledged: false,
    ...overrides,
  };
}

export async function createAlert(
  instanceId: string,
  overrides: Record<string, unknown> = {}
) {
  const input = buildAlertInput(instanceId, overrides);
  return prisma.botAlert.create({
    data: {
      instanceId: input.instanceId,
      type: input.type as BotAlertType,
      severity: input.severity as BotAlertSeverity,
      title: input.title as string,
      message: input.message as string,
      details: input.details as string | null,
      acknowledged: input.acknowledged as boolean,
    },
  });
}

export async function cleanupMonitor() {
  await prisma.botAlert.deleteMany();
  await prisma.botInstance.deleteMany();
}
