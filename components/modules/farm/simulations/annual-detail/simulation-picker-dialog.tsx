"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SimulationListItem } from "./types";

interface SimulationPickerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: SimulationListItem[];
  showAllKinds: boolean;
  onToggleAllKinds: (v: boolean) => void;
  onSelect: (simId: string) => void;
}

export function SimulationPickerDialog({
  open,
  onOpenChange,
  items,
  showAllKinds,
  onToggleAllKinds,
  onSelect,
}: SimulationPickerDialogProps) {
  function handleSelect(simId: string) {
    onSelect(simId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar liga ao plano</DialogTitle>
          <DialogDescription>
            Selecione simulações para incluir neste plano. Cada simulação = 1 liga do ano.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAllKinds}
              onChange={(e) => onToggleAllKinds(e.target.checked)}
            />
            Mostrar também simulações operacionais
          </label>
          <Button variant="outline" size="sm" asChild>
            <Link href="/farm/simulations?kind=forecast">Nova simulação forecast</Link>
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {items.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">
              Nenhuma simulação disponível.{" "}
              {showAllKinds ? "" : "Tente marcar 'Mostrar também operacionais'."}
            </p>
          ) : (
            <PickerTable items={items} onSelect={handleSelect} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PickerTableProps {
  items: SimulationListItem[];
  onSelect: (simId: string) => void;
}

function PickerTable({ items, onSelect }: PickerTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Liga</TableHead>
          <TableHead className="text-center">Kind</TableHead>
          <TableHead className="text-center">Sem.</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{s.league}</TableCell>
            <TableCell className="text-center">
              <Badge
                variant={s.kind === "forecast" ? "outline" : "secondary"}
                className="text-xs"
              >
                {s.kind === "forecast" ? "Forecast" : "Oper."}
              </Badge>
            </TableCell>
            <TableCell className="text-center font-mono text-sm">{s.durationWeeks}</TableCell>
            <TableCell className="text-right">
              <Button size="sm" onClick={() => onSelect(s.id)}>
                Adicionar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
