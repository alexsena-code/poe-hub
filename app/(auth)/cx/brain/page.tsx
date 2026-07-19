import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { PositionsTable } from "@/components/modules/cx-brain/positions-table";
import { PairStatesTable } from "@/components/modules/cx-brain/pair-states-table";
import { BrainLogTable } from "@/components/modules/cx-brain/brain-log-table";
import { ConfigPanel } from "@/components/modules/cx-brain/config-panel";
import { StatusHeader } from "@/components/modules/cx-brain/status-header";
import type { BrainLogEntrySerialized } from "@/components/modules/cx-brain/brain-log-table";

export const dynamic = "force-dynamic";

// CX Brain — operational state view. Server component that fetches brain data
// directly via Prisma. Auth handled by (auth) layout.

export default async function CxBrainPage() {
  const [positions, pairStates, brainLogs, brainParams] = await Promise.all([
    prisma.cxPosition.findMany({
      where: { status: { in: ["posted", "filled"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cxPairState.findMany({
      orderBy: { pairKey: "asc" },
    }),
    prisma.cxBrainLog.findMany({
      orderBy: { ts: "desc" },
      take: 50,
    }),
    prisma.cxParams.findMany({
      where: { scope: "global", scopeKey: "brain" },
      orderBy: { key: "asc" },
    }),
  ]);

  // Derive status header values from params
  const enabledParam = brainParams.find((p) => p.key === "enabled");
  const enabled = enabledParam?.value === true || enabledParam?.value === "true";

  const leagueParam = brainParams.find((p) => p.key === "league");
  const league = typeof leagueParam?.value === "string" ? leagueParam.value : null;

  const totalSlotsParam = brainParams.find((p) => p.key === "total_slots");
  const slotsAvailable =
    totalSlotsParam?.value != null ? Number(totalSlotsParam.value) : null;
  const slotsUsed = positions.filter((p) => p.status === "posted").length;

  // Serialize dates for the client component (BrainLogTable)
  const serializedLogs: BrainLogEntrySerialized[] = brainLogs.map((log) => ({
    id: log.id,
    ts: log.ts.toISOString(),
    action: log.action,
    pairKey: log.pairKey,
    detail: log.detail,
    positionId: log.positionId,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="CX Brain"
        description="Estado operacional do brain — positions, pair states, logs e config."
      />

      <StatusHeader
        enabled={enabled}
        league={league}
        slotsUsed={slotsUsed}
        slotsAvailable={slotsAvailable}
      />

      <PositionsTable positions={positions} />
      <PairStatesTable pairStates={pairStates} />
      <BrainLogTable logs={serializedLogs} />
      <ConfigPanel params={brainParams} />
    </div>
  );
}
