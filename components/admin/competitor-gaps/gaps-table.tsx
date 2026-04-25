"use client";

import { useState } from "react";
import { ExternalLink, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GapRow } from "./types";

interface GapsTableProps {
  rows: GapRow[];
}

export function GapsTable({ rows }: GapsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface p-12 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Nenhum gap encontrado</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Sem matches com os filtros atuais. Reduza o "Min. competidores" ou
            confirme que o page enricher rodou nos competitors recentemente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Tópico</TableHead>
              <TableHead className="w-[12%]">Competidores</TableHead>
              <TableHead className="w-[18%]">Categoria</TableHead>
              <TableHead className="w-[14%]">Coverage</TableHead>
              <TableHead className="w-[16%]">URLs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.topic + row.category}>
                <TableCell className="font-medium">{row.topic}</TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="cursor-help">
                        {row.competitors.length}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <ul className="text-xs font-mono">
                        {row.competitors.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {row.category || "—"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.ourCoverage ? (
                    <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25">
                      coberto
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-300 hover:bg-amber-500/25">
                      uncovered
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <UrlListDialog topic={row.topic} urls={row.competitorUrls} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

function UrlListDialog({ topic, urls }: { topic: string; urls: string[] }) {
  const [open, setOpen] = useState(false);
  if (urls.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          {urls.length} {urls.length === 1 ? "página" : "páginas"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Páginas: {topic}</DialogTitle>
          <DialogDescription>
            URLs dos competidores que cobrem esse tópico.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <ul className="space-y-1">
            {urls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md p-2 text-xs font-mono text-primary hover:bg-foreground/5"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
