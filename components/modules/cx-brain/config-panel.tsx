import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CxParams } from "@prisma/client";

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function fmtDate(date: Date): string {
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ConfigPanel({ params }: { params: CxParams[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brain Config</CardTitle>
      </CardHeader>
      <CardContent>
        {params.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum parametro de brain configurado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Updated By</TableHead>
                  <TableHead>Updated At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {params.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {p.key}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatValue(p.value)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.updatedBy ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(p.updatedAt)}
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
