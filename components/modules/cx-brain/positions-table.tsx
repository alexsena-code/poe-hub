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
import type { CxPosition } from "@prisma/client";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  posted: "outline",
  filled: "default",
  timed_out: "destructive",
  cancelled: "destructive",
};

function timeAgo(date: Date | null): string {
  if (!date) return "-";
  const secs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}min`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtDateTime(date: Date | null): string {
  if (!date) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function PositionsTable({ positions }: { positions: CxPosition[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Positions Ativas</CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma position ativa.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Ratio</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead>Timeout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[pos.status] ?? "secondary"}>
                        {pos.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{pos.pairKey}</TableCell>
                    <TableCell className="text-xs">{pos.strategy}</TableCell>
                    <TableCell>
                      <Badge variant={pos.side === "buy" ? "default" : "secondary"}>
                        {pos.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {pos.ratioPosted.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {timeAgo(pos.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDateTime(pos.timeoutAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
