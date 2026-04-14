import { prisma } from "@/lib/prisma";

let counter = 0;

export function buildLeagueInput(overrides: Record<string, unknown> = {}) {
  counter++;
  return {
    name: `TestLeague-${counter}`,
    poeVersion: "poe2" as const,
    startDate: null as string | null,
    endDate: null as string | null,
    isCurrent: false,
    ...overrides,
  };
}

export async function createLeague(overrides: Record<string, unknown> = {}) {
  const input = buildLeagueInput(overrides);
  return prisma.league.create({
    data: {
      name: input.name as string,
      poeVersion: input.poeVersion as "poe1" | "poe2",
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      isCurrent: input.isCurrent as boolean,
    },
  });
}

export async function cleanupLeagues() {
  await prisma.league.deleteMany();
}
