"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPriceBrl } from "../helpers";
import type { PriceCompItem } from "../types";

interface PriceComparisonPanelProps {
  priceComparison: PriceCompItem[];
}

function SavingsBadge({ savingsPct }: { savingsPct: number | null }) {
  if (savingsPct === null) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge
      variant={savingsPct > 0 ? "default" : "destructive"}
      className={
        savingsPct > 30
          ? "bg-green-600"
          : savingsPct > 0
            ? "bg-yellow-600"
            : ""
      }
    >
      {savingsPct > 0 ? `-${savingsPct}%` : `+${Math.abs(savingsPct)}%`}
    </Badge>
  );
}

/** Used vs New price comparison table — rendered below the product list. */
export function PriceComparisonPanel({ priceComparison }: PriceComparisonPanelProps) {
  if (priceComparison.length === 0) return null;
  return (
    <Card className="bg-card border-border mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Used vs New — Price Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Item</TableHead>
                <TableHead>OLX Min</TableHead>
                <TableHead>OLX Avg</TableHead>
                <TableHead>Deals</TableHead>
                <TableHead>New Price</TableHead>
                <TableHead>Savings</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceComparison.map((item) => (
                <TableRow key={item.item_name} className="border-border">
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell>
                    {item.olx_min ? formatPriceBrl(item.olx_min) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {item.olx_avg ? formatPriceBrl(item.olx_avg) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>{item.olx_count}</TableCell>
                  <TableCell>
                    {item.price_new ? (
                      <span className="text-green-400">{formatPriceBrl(item.price_new)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SavingsBadge savingsPct={item.savings_pct} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {item.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
