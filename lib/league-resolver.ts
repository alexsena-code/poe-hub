import { prisma } from "@/lib/prisma";

interface LeagueInfo {
  name: string;
  poeVersion: string;
  startDate: Date | null;
  endDate: Date | null;
}

let cachedLeagues: LeagueInfo[] | null = null;

/**
 * Load all leagues from DB (cached for the process lifetime)
 */
export async function loadLeagues(): Promise<LeagueInfo[]> {
  if (cachedLeagues) return cachedLeagues;

  const leagues = await prisma.league.findMany({
    orderBy: { startDate: "desc" },
    select: { name: true, poeVersion: true, startDate: true, endDate: true },
  });

  cachedLeagues = leagues;
  return leagues;
}

/**
 * Determine which league was active at a given date, for a given channel/poe version.
 *
 * Logic:
 * - Find the league where startDate <= messageDate <= endDate (or endDate is null for current)
 * - If poeVersion is specified, filter by it
 */
export function resolveLeague(
  messageDate: Date,
  leagues: LeagueInfo[],
  poeVersion?: "poe1" | "poe2"
): string | null {
  const filtered = poeVersion
    ? leagues.filter((l) => l.poeVersion === poeVersion)
    : leagues;

  for (const league of filtered) {
    if (!league.startDate) continue;

    const start = league.startDate;
    const end = league.endDate;

    if (messageDate >= start && (!end || messageDate <= end)) {
      return league.name;
    }
  }

  return null;
}

/**
 * Clear cached leagues (useful after seeding new data)
 */
export function clearLeagueCache() {
  cachedLeagues = null;
}
