"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPriceBrl } from "../helpers";
import type { SyncResult } from "../types";

interface SyncPanelProps {
  syncResults: SyncResult[];
}

/**
 * Sync results banner — shown after a successful "Sync to Manual Prices" call.
 * Displays synced item names, prices, and merchants as badges.
 */
export function SyncPanel({ syncResults }: SyncPanelProps) {
  if (syncResults.length === 0) return null;
  return (
    <Card className="bg-card border-green-500/30">
      <CardContent className="pt-4 pb-3">
        <p className="text-sm font-medium text-green-400 mb-2">
          Synced {syncResults.length} prices:
        </p>
        <div className="flex flex-wrap gap-2">
          {syncResults.map((r) => (
            <Badge key={r.item} variant="secondary" className="text-xs">
              {r.item}: {formatPriceBrl(r.new_price)} @ {r.merchant}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
