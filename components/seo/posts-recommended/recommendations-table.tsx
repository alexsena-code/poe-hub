"use client";

// Session 32 (Frontend B): table for the post-recommendations endpoint.
// Each row exposes Striking / Difficulty / Consol / Clicks30d / Δ Clicks /
// Position so the operator can sanity-check the suggestedAction badge
// against the underlying signals before clicking through to the briefing.

import Link from "next/link";
import { ExternalLink, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActionBadge } from "./action-badge";
import type { PostRecommendation } from "./types";

interface RecommendationsTableProps {
  rows: PostRecommendation[];
}

// Co-writer briefing route — the spec calls for `/co-writer/new?keyword=...`
// but no such route exists yet in this hub. `/workspace/blog/new` is the
// canonical "new draft" surface and accepts a `keyword` query param via
// searchParams that the editor shell can read once the upstream wiring
// lands. Keeping the param shape stable so the link doesn't need to be
// rewritten when the editor learns to consume it.
const BRIEFING_ROUTE = "/workspace/blog/new";

function buildBriefingHref(keyword: string): string {
  const params = new URLSearchParams({ keyword });
  return `${BRIEFING_ROUTE}?${params.toString()}`;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  hard: "bg-red-500/15 text-red-300",
  blocked: "bg-gray-500/15 text-gray-300",
};

function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return <span className="text-xs text-muted-foreground">—</span>;
  const style = DIFFICULTY_STYLES[difficulty] ?? "bg-slate-500/15 text-slate-300";
  return <Badge className={`${style} font-mono text-xs`}>{difficulty}</Badge>;
}

function NumericCell({
  value,
  fractionDigits = 0,
  showSign = false,
}: {
  value: number | null | undefined;
  fractionDigits?: number;
  showSign?: boolean;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  if (!showSign) return <span className="font-mono text-xs">{formatted}</span>;
  const sign = value > 0 ? "+" : "";
  const colour =
    value > 0
      ? "text-emerald-400"
      : value < 0
        ? "text-red-400"
        : "text-muted-foreground";
  return (
    <span className={`font-mono text-xs ${colour}`}>
      {sign}
      {formatted}
    </span>
  );
}

export function RecommendationsTable({ rows }: RecommendationsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface p-12 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Nenhuma recomendação encontrada
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Sem matches com os filtros atuais. Tente "Action: Todas" ou amplie
            o target position. Se a tabela estiver consistentemente vazia,
            confirme que o pipeline de KeywordOpportunity está rodando.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%]">Keyword</TableHead>
            <TableHead className="w-[12%]">Cluster</TableHead>
            <TableHead className="w-[12%]">Action</TableHead>
            <TableHead className="w-[8%] text-right">Striking</TableHead>
            <TableHead className="w-[8%]">Difficulty</TableHead>
            <TableHead className="w-[7%] text-right">Consol</TableHead>
            <TableHead className="w-[8%] text-right">Clicks30d</TableHead>
            <TableHead className="w-[7%] text-right">Δ Clicks</TableHead>
            <TableHead className="w-[7%] text-right">Position</TableHead>
            <TableHead className="w-[11%]">Briefing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.keywordId}>
              <TableCell className="font-medium">{row.keyword}</TableCell>
              <TableCell>
                {row.cluster ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {row.cluster}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <ActionBadge action={row.suggestedAction} />
              </TableCell>
              <TableCell className="text-right">
                <NumericCell value={row.strikingOpportunity} fractionDigits={1} />
              </TableCell>
              <TableCell>
                <DifficultyBadge difficulty={row.personalizedDifficulty} />
              </TableCell>
              <TableCell className="text-right">
                <NumericCell value={row.consolidatedScore} fractionDigits={0} />
              </TableCell>
              <TableCell className="text-right">
                <NumericCell value={row.predictedClicks30d} fractionDigits={0} />
              </TableCell>
              <TableCell className="text-right">
                <NumericCell
                  value={row.predictedClicksDelta}
                  fractionDigits={0}
                  showSign
                />
              </TableCell>
              <TableCell className="text-right">
                <NumericCell value={row.currentPosition} fractionDigits={1} />
              </TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link href={buildBriefingHref(row.keyword)}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir briefing
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
