import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CxPairState } from "@prisma/client";

function AggressionBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  // Color transitions: green < 0.4, yellow 0.4-0.7, red > 0.7
  const color =
    pct < 40 ? "bg-green-500" : pct < 70 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function isCoolingDown(cooldownUntil: Date | null): boolean {
  if (!cooldownUntil) return false;
  return cooldownUntil.getTime() > Date.now();
}

export function PairStatesTable({ pairStates }: { pairStates: CxPairState[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pair States</CardTitle>
      </CardHeader>
      <CardContent>
        {pairStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pair state registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Aggression</TableHead>
                  <TableHead className="text-right">Timeouts</TableHead>
                  <TableHead className="text-right">Fills</TableHead>
                  <TableHead>Cooldown</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairStates.map((ps) => {
                  const cooling = isCoolingDown(ps.cooldownUntil);
                  return (
                    <TableRow key={ps.id}>
                      <TableCell className="font-mono text-xs">{ps.pairKey}</TableCell>
                      <TableCell className="text-xs">{ps.strategy}</TableCell>
                      <TableCell>
                        <AggressionBar value={ps.aggression} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {ps.consecutiveTimeouts}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {ps.consecutiveFills}
                      </TableCell>
                      <TableCell>
                        {cooling ? (
                          <Badge variant="destructive">cooldown</Badge>
                        ) : (
                          <Badge variant="outline">ativo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
