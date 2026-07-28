/**
 * Historical league data for PoE 1 and PoE 2
 * Sources: poedb.tw, poe2db.tw, poewiki.net, gamingcy.com
 * Last updated: 2026-07-28
 *
 * To add a new league: add an entry here and run `npx prisma db seed`
 *
 * Ao virar a liga, mexa em DUAS linhas: a nova entra com `isCurrent: true` e a
 * anterior precisa receber `endDate` e voltar para `false`. O seed propaga o que
 * estiver aqui, mas `PATCH /api/leagues/:id` não desmarca a anterior sozinho —
 * deixar as duas como `isCurrent` faz o painel escolher uma arbitrariamente.
 */

export const LEAGUES = [
  // =============================================
  // Path of Exile 1 — Challenge Leagues
  // =============================================
  { name: "Allflame", version: "3.29", poeVersion: "poe1" as const, startDate: "2026-07-24", endDate: null, isCurrent: true },
  { name: "Mirage", version: "3.28", poeVersion: "poe1" as const, startDate: "2026-03-06", endDate: "2026-07-21", isCurrent: false },
  { name: "Keepers of the Flame", version: "3.27", poeVersion: "poe1" as const, startDate: "2025-10-31", endDate: "2026-03-02", isCurrent: false },
  { name: "Mercenaries", version: "3.26", poeVersion: "poe1" as const, startDate: "2025-06-13", endDate: "2025-10-27", isCurrent: false },
  { name: "Settlers of Kalguur", version: "3.25", poeVersion: "poe1" as const, startDate: "2024-07-26", endDate: "2025-06-09", isCurrent: false },
  { name: "Necropolis", version: "3.24", poeVersion: "poe1" as const, startDate: "2024-03-29", endDate: "2024-07-23", isCurrent: false },
  { name: "Affliction", version: "3.23", poeVersion: "poe1" as const, startDate: "2023-12-08", endDate: "2024-03-26", isCurrent: false },
  { name: "Ancestor", version: "3.22", poeVersion: "poe1" as const, startDate: "2023-08-18", endDate: "2023-12-05", isCurrent: false },
  { name: "Crucible", version: "3.21", poeVersion: "poe1" as const, startDate: "2023-04-07", endDate: "2023-08-15", isCurrent: false },
  { name: "Forbidden Sanctum", version: "3.20", poeVersion: "poe1" as const, startDate: "2022-12-09", endDate: "2023-04-07", isCurrent: false },
  { name: "Lake of Kalandra", version: "3.19", poeVersion: "poe1" as const, startDate: "2022-08-19", endDate: "2022-12-06", isCurrent: false },
  { name: "Sentinel", version: "3.18", poeVersion: "poe1" as const, startDate: "2022-05-03", endDate: "2022-08-16", isCurrent: false },
  { name: "Archnemesis", version: "3.17", poeVersion: "poe1" as const, startDate: "2022-02-04", endDate: "2022-05-10", isCurrent: false },
  { name: "Scourge", version: "3.16", poeVersion: "poe1" as const, startDate: "2021-10-22", endDate: "2022-02-01", isCurrent: false },
  { name: "Expedition", version: "3.15", poeVersion: "poe1" as const, startDate: "2021-07-23", endDate: "2021-10-19", isCurrent: false },
  { name: "Ultimatum", version: "3.14", poeVersion: "poe1" as const, startDate: "2021-04-16", endDate: "2021-07-19", isCurrent: false },
  { name: "Ritual", version: "3.13", poeVersion: "poe1" as const, startDate: "2021-01-15", endDate: "2021-04-12", isCurrent: false },
  { name: "Heist", version: "3.12", poeVersion: "poe1" as const, startDate: "2020-09-18", endDate: "2021-01-11", isCurrent: false },
  { name: "Harvest", version: "3.11", poeVersion: "poe1" as const, startDate: "2020-06-19", endDate: "2020-09-14", isCurrent: false },
  { name: "Delirium", version: "3.10", poeVersion: "poe1" as const, startDate: "2020-03-13", endDate: "2020-06-15", isCurrent: false },

  // =============================================
  // Path of Exile 2 — Early Access Leagues
  // =============================================
  { name: "Fate of the Vaal", version: "0.4", poeVersion: "poe2" as const, startDate: "2025-12-12", endDate: null, isCurrent: true },
  { name: "Rise of the Abyssal", version: "0.3", poeVersion: "poe2" as const, startDate: "2025-08-29", endDate: "2025-12-08", isCurrent: false },
  { name: "Dawn of the Hunt", version: "0.2", poeVersion: "poe2" as const, startDate: "2025-04-04", endDate: "2025-08-26", isCurrent: false },
  { name: "Early Access", version: "0.1", poeVersion: "poe2" as const, startDate: "2024-12-06", endDate: "2025-04-01", isCurrent: false },
];
