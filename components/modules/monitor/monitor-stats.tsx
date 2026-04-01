import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertTriangle, Wifi } from "lucide-react";

interface MonitorStatsProps {
  online: number;
  total: number;
  alertsToday: number;
}

export function MonitorStats({ online, total, alertsToday }: MonitorStatsProps) {
  const offline = total - online;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10">
            <Wifi className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bots Online</p>
            <p className="text-2xl font-bold leading-none">
              <span className="text-green-500">{online}</span>
              <span className="text-muted-foreground text-sm font-normal">/{total}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
            <Activity className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bots Offline</p>
            <p className="text-2xl font-bold leading-none text-red-500">{offline}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Alertas Hoje</p>
            <p className="text-2xl font-bold leading-none text-yellow-500">{alertsToday}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
