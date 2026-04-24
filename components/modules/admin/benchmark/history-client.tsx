"use client";

/**
 * BenchmarkHistoryClient — SWR-backed list with type/preset filters,
 * pagination, row-click detail sheet, compare picker, and delete flow.
 *
 * Session 01 S01.benchmark-history.
 */

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Trash2, Eye, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTimeBr, formatCostUsd, formatDurationMs } from "@/lib/formatters";
import { RunDetailSheet } from "./run-detail-sheet";
import { ComparePickerDialog } from "./compare-picker-dialog";
import type {
  BenchmarkRunListRow,
  BenchmarkRunDetail,
  BenchmarkType,
  BenchmarkRunsListResponse,
} from "./history-types";

const LIMIT = 50;

interface BenchmarkHistoryClientProps {
  initialRuns: BenchmarkRunListRow[];
  initialTotal: number;
}

type TypeFilter = "all" | BenchmarkType;

/** Derive the writer model from modelOverrides (write key) or legacy modelOverride scalar. */
function resolveWriterModel(run: BenchmarkRunListRow): string {
  const overrides = run.modelOverrides ?? {};
  // write override takes precedence; fall back to any single-key override for QA runs.
  return overrides.write ?? overrides.model ?? "-";
}

async function fetchRuns(url: string): Promise<BenchmarkRunsListResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return res.json();
}

async function fetchRunDetail(id: string): Promise<BenchmarkRunDetail> {
  const res = await fetch(`/api/benchmark/runs/${id}`);
  if (!res.ok) throw new Error(`Fetch detail failed: ${res.status} for run ${id}`);
  return res.json();
}

function buildRunsUrl(type: TypeFilter, presetId: string, offset: number): string {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (presetId) params.set("presetId", presetId);
  params.set("limit", String(LIMIT));
  params.set("offset", String(offset));
  return `/api/benchmark/runs?${params.toString()}`;
}

/** Badge colour per benchmark type. */
function TypeBadge({ type }: { type: BenchmarkType }) {
  const cls =
    type === "qa"
      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
      : type === "ideation"
        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  const label =
    type === "qa" ? "QA" : type === "ideation" ? "Ideation" : "Content Gen";
  return (
    <Badge variant="outline" className={cn("text-xs font-mono", cls)}>
      {label}
    </Badge>
  );
}

function StatusBadge({ run }: { run: BenchmarkRunListRow }) {
  const isError = run.error !== null || run.httpStatus >= 400;
  return (
    <Badge variant={isError ? "destructive" : "secondary"} className="text-xs">
      {run.httpStatus}
    </Badge>
  );
}

/** Collect distinct presets from the current list for the filter select. */
function extractPresets(
  runs: BenchmarkRunListRow[],
): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const run of runs) {
    if (run.preset) seen.set(run.preset.id, run.preset.name);
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

export function BenchmarkHistoryClient({
  initialRuns,
  initialTotal,
}: BenchmarkHistoryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters synced with URL query params for bookmarkability.
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    (searchParams.get("type") as TypeFilter) ?? "all",
  );
  const [presetFilter, setPresetFilter] = useState(searchParams.get("presetId") ?? "");
  const [offset, setOffset] = useState(0);

  // Detail sheet state.
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRun, setDetailRun] = useState<BenchmarkRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Compare picker state.
  const [compareBase, setCompareBase] = useState<BenchmarkRunListRow | null>(null);

  // Delete confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkRunListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const runsUrl = buildRunsUrl(typeFilter, presetFilter, offset);

  const { data, isLoading, isValidating, mutate } = useSWR<BenchmarkRunsListResponse>(
    runsUrl,
    fetchRuns,
    {
      fallbackData: { runs: initialRuns, total: initialTotal },
      keepPreviousData: true,
    },
  );

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT);

  const distinctPresets = extractPresets(runs);

  function pushUrlParams(type: TypeFilter, preset: string) {
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    if (preset) params.set("presetId", preset);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleTypeChange(value: string) {
    const t = value as TypeFilter;
    setTypeFilter(t);
    setOffset(0);
    pushUrlParams(t, presetFilter);
  }

  function handlePresetChange(value: string) {
    const p = value === "_all" ? "" : value;
    setPresetFilter(p);
    setOffset(0);
    pushUrlParams(typeFilter, p);
  }

  function handlePrev() {
    setOffset((o) => Math.max(0, o - LIMIT));
  }

  function handleNext() {
    setOffset((o) => o + LIMIT);
  }

  const handleRowClick = useCallback(async (run: BenchmarkRunListRow) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const detail = await fetchRunDetail(run.id);
      setDetailRun(detail);
    } catch {
      toast.error(`Erro ao carregar detalhes do run ${run.id.slice(0, 8)}`);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/benchmark/runs/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast.success("Run deletado");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao deletar run");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const isBusy = isLoading || isValidating;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="qa">QA</SelectItem>
            <SelectItem value="ideation">Ideation</SelectItem>
            <SelectItem value="content_generation">Content Gen</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={presetFilter || "_all"}
          onValueChange={handlePresetChange}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os presets</SelectItem>
            {distinctPresets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isBusy && <Spinner size="sm" />}

        <span className="ml-auto text-xs text-muted-foreground">
          {total} run{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Criado</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Preset</TableHead>
              <TableHead className="whitespace-nowrap">Writer Model</TableHead>
              <TableHead>Duracao</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead className="text-right">LLM</TableHead>
              <TableHead className="text-right">Qdrant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  <Spinner size="sm" className="inline mr-2" />
                  Carregando...
                </TableCell>
              </TableRow>
            ) : runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  Nenhum run encontrado.
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => {
                const isError = run.error !== null || run.httpStatus >= 400;
                const writerModel = resolveWriterModel(run);
                return (
                  <TableRow
                    key={run.id}
                    data-testid={`run-row-${run.id}`}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isError && "bg-destructive/5 hover:bg-destructive/10",
                    )}
                    onClick={() => handleRowClick(run)}
                  >
                    <TableCell className="whitespace-nowrap text-xs">
                      <span title={new Date(run.createdAt).toISOString()}>
                        {formatDateTimeBr(run.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={run.type} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.preset ? (
                        <a
                          href={`/admin/benchmark?presetId=${run.preset.id}`}
                          className="hover:underline text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {run.preset.name}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/50 italic">ad-hoc</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[10rem] truncate">
                      {writerModel}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDurationMs(run.totalDurationMs)}
                    </TableCell>
                    <TableCell className="text-sm font-mono whitespace-nowrap">
                      {formatCostUsd(run.totalCostUsd)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {run.llmCallCount}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {run.qdrantQueryCount}
                    </TableCell>
                    <TableCell>
                      <StatusBadge run={run} />
                      {run.error && (
                        <p className="text-[10px] text-destructive mt-0.5 max-w-[8rem] truncate" title={run.error}>
                          {run.error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Ver detalhes"
                          onClick={() => handleRowClick(run)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Comparar com..."
                          onClick={() => setCompareBase(run)}
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Deletar run"
                          onClick={() => setDeleteTarget(run)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total > 0
            ? `${offset + 1}–${Math.min(offset + LIMIT, total)} de ${total}`
            : "0 resultados"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={handlePrev}
          >
            Anterior
          </Button>
          <span className="flex items-center px-2 text-xs">
            {currentPage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + LIMIT >= total}
            onClick={handleNext}
          >
            Proxima
          </Button>
        </div>
      </div>

      {/* Detail sheet */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <Spinner size="sm" />
        </div>
      )}
      <RunDetailSheet
        run={detailRun}
        open={detailOpen && !detailLoading}
        onClose={() => { setDetailOpen(false); setDetailRun(null); }}
      />

      {/* Compare picker */}
      {compareBase && (
        <ComparePickerDialog
          baseRunId={compareBase.id}
          baseType={compareBase.type}
          open={!!compareBase}
          onClose={() => setCompareBase(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar run?</AlertDialogTitle>
            <AlertDialogDescription>
              Run {deleteTarget?.id.slice(0, 8)}... ({deleteTarget?.type}) de{" "}
              {deleteTarget ? formatDateTimeBr(deleteTarget.createdAt) : ""}.
              Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
