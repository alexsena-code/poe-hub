"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Plus, RefreshCw, Trash2 } from "lucide-react";
import { maskProxyUrl, proxyRowClass, formatSettingsDate } from "./helpers";
import type { Proxy } from "./types";

interface ProxyPoolCardProps {
  proxies: Proxy[];
  loading: boolean;
  newProxyUrl: string;
  setNewProxyUrl: (v: string) => void;
  testingProxies: boolean;
  onAdd: () => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReset: (id: number) => Promise<void>;
  onTestAll: () => Promise<void>;
}

export function ProxyPoolCard({
  proxies,
  loading,
  newProxyUrl,
  setNewProxyUrl,
  testingProxies,
  onAdd,
  onDelete,
  onReset,
  onTestAll,
}: ProxyPoolCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" /> Proxy Pool
        </CardTitle>
        <CardDescription>
          Proxies used for scraping (currently not needed - using residential
          IP via WebSocket worker)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form + test all */}
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="http://user:pass@host:port"
            value={newProxyUrl}
            onChange={(e) => setNewProxyUrl(e.target.value)}
            className="flex-1 min-w-[280px]"
          />
          <Button size="sm" disabled={!newProxyUrl.trim()} onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testingProxies || proxies.length === 0}
            onClick={onTestAll}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${testingProxies ? "animate-spin" : ""}`} />
            Test All
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : proxies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No proxies configured.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fails</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Last Success</TableHead>
                  <TableHead>Last Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxies.map((proxy) => (
                  <TableRow key={proxy.id} className={proxyRowClass(proxy.fail_count)}>
                    {/* maskProxyUrl strips credentials — never expose user:pass in the UI */}
                    <TableCell className="font-mono text-sm">
                      {maskProxyUrl(proxy.url)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={proxy.is_active ? "default" : "secondary"}
                        className={proxy.is_active ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {proxy.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          proxy.fail_count >= 5
                            ? "text-red-500 font-bold"
                            : proxy.fail_count >= 1
                              ? "text-yellow-500 font-medium"
                              : "text-green-500"
                        }
                      >
                        {proxy.fail_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatSettingsDate(proxy.last_used)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatSettingsDate(proxy.last_success)}
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground max-w-[200px] truncate"
                      title={proxy.last_error || ""}
                    >
                      {proxy.last_error || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onReset(proxy.id)}
                          title="Reset fail count"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(proxy.id)}
                          title="Delete"
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
