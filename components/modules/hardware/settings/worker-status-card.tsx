"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, WifiOff } from "lucide-react";
import type { WorkerStatus } from "./types";

interface WorkerStatusCardProps {
  status: WorkerStatus | null;
  loading: boolean;
}

export function WorkerStatusCard({ status, loading }: WorkerStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Worker Status</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-6 w-40" />
        ) : status?.online ? (
          <div className="flex items-center gap-2 text-green-500">
            <Wifi className="h-5 w-5" />
            <span className="font-medium">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-500">
            <WifiOff className="h-5 w-5" />
            <span className="font-medium">Offline</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
