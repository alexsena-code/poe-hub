'use client';

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react";

// Shape returned by GET /api/engine/seo/gsc/status (gsc.service.ts#getStatus)
export interface GscStatus {
  configured: boolean;
  siteUrl: string;
  info: string;
}

// Shape returned by POST /api/engine/seo/gsc/sync (gsc.service.ts#syncData)
interface GscSyncResult {
  fetched: number;
  imported: number;
  rejected: number;
  error?: string;
  siteUrl?: string;
  range?: { startDate: string; endDate: string };
}

interface GscClientProps {
  initialStatus: GscStatus | null;
}

const DAYS_OPTIONS = ["7", "14", "28", "90"] as const;
type DaysOption = (typeof DAYS_OPTIONS)[number];

// Format ISO date string to pt-BR dd/mm/yyyy
function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function GscClient({ initialStatus }: GscClientProps) {
  const [status, setStatus] = useState<GscStatus | null>(initialStatus);
  const [reloading, setReloading] = useState(false);
  const [days, setDays] = useState<DaysOption>("28");
  const [syncing, setSyncing] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [lastSync, setLastSync] = useState<GscSyncResult | null>(null);

  async function reloadStatus() {
    setReloading(true);
    try {
      const res = await fetch("/api/engine/seo/gsc/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GscStatus;
      setStatus(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao recarregar status");
    } finally {
      setReloading(false);
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/engine/seo/gsc/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days) }),
      });
      const data = (await res.json()) as GscSyncResult;

      if (data.error) {
        toast.error(`Sync falhou: ${data.error}`);
        return;
      }

      setLastSync(data);
      const rangeLabel =
        data.range
          ? ` (${formatDateBr(data.range.startDate)} – ${formatDateBr(data.range.endDate)})`
          : "";
      toast.success(
        `Sync OK${rangeLabel}: ${data.fetched} buscados, ${data.imported} importados, ${data.rejected} rejeitados`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no sync");
    } finally {
      setSyncing(false);
    }
  }

  async function startAuth() {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/engine/seo/gsc/auth-url");
      const data = (await res.json()) as { authUrl?: string; url?: string; error?: string };
      const url = data.authUrl ?? data.url;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (url) {
        window.open(url, "_blank");
      } else {
        toast.error("Auth URL nao retornada pelo engine");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao buscar auth URL");
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <StatusCard
        status={status}
        reloading={reloading}
        onReload={reloadStatus}
      />

      {status?.configured ? (
        <SyncCard
          days={days}
          syncing={syncing}
          lastSync={lastSync}
          onDaysChange={setDays}
          onSync={triggerSync}
        />
      ) : (
        <AuthCard authLoading={authLoading} onStartAuth={startAuth} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusCardProps {
  status: GscStatus | null;
  reloading: boolean;
  onReload: () => void;
}

function StatusCard({ status, reloading, onReload }: StatusCardProps) {
  const configured = status?.configured ?? false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Status da Conexao</CardTitle>
        <Button variant="ghost" size="icon" onClick={onReload} disabled={reloading}>
          <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          {configured ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <Badge variant={configured ? "default" : "destructive"}>
            {configured ? "Autenticado" : "Nao autenticado"}
          </Badge>
        </div>

        {status ? (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Site:</span> {status.siteUrl}
            </p>
            <p className="text-sm text-muted-foreground">{status.info}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Status indisponivel — recarregue para tentar novamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface SyncCardProps {
  days: DaysOption;
  syncing: boolean;
  lastSync: GscSyncResult | null;
  onDaysChange: (d: DaysOption) => void;
  onSync: () => void;
}

function SyncCard({ days, syncing, lastSync, onDaysChange, onSync }: SyncCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Sincronizar Dados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Select value={days} onValueChange={(v) => onDaysChange(v as DaysOption)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onSync} disabled={syncing}>
            {syncing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Sincronizando...
              </>
            ) : (
              "Sincronizar agora"
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Normalmente demora 10-30s pra ranges acima de 30 dias.
        </p>

        {lastSync && !lastSync.error && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">Ultimo sync bem-sucedido</p>
            {lastSync.range && (
              <p className="text-muted-foreground">
                Periodo: {formatDateBr(lastSync.range.startDate)} – {formatDateBr(lastSync.range.endDate)}
              </p>
            )}
            <p className="text-muted-foreground">
              Buscados: {lastSync.fetched} &bull; Importados: {lastSync.imported} &bull; Rejeitados:{" "}
              {lastSync.rejected}
            </p>
            {lastSync.siteUrl && (
              <p className="text-muted-foreground">Site: {lastSync.siteUrl}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AuthCardProps {
  authLoading: boolean;
  onStartAuth: () => void;
}

function AuthCard({ authLoading, onStartAuth }: AuthCardProps) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base font-medium text-destructive">Nao autenticado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Configure <code className="text-xs bg-muted px-1 rounded">GSC_CLIENT_ID</code>,{" "}
          <code className="text-xs bg-muted px-1 rounded">GSC_CLIENT_SECRET</code> e{" "}
          <code className="text-xs bg-muted px-1 rounded">GSC_REFRESH_TOKEN</code> no engine,
          ou inicie o fluxo OAuth abaixo.
        </p>

        <Button onClick={onStartAuth} disabled={authLoading} variant="outline">
          {authLoading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Buscando URL...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-4 w-4" />
              Iniciar autenticacao
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
