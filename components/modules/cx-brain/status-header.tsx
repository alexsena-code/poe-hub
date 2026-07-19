import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface StatusHeaderProps {
  enabled: boolean;
  league: string | null;
  slotsUsed: number;
  slotsAvailable: number | null;
}

export function StatusHeader({ enabled, league, slotsUsed, slotsAvailable }: StatusHeaderProps) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Brain:</span>
          {enabled ? (
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              enabled
            </Badge>
          ) : (
            <Badge variant="destructive">disabled</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">League:</span>
          <span className="text-sm font-mono">
            {league ?? "n/a"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Slots:</span>
          <span className="text-sm font-mono">
            {slotsUsed}
            {slotsAvailable != null ? ` / ${slotsAvailable}` : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
