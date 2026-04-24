"use client";

// CostConfigsTable — read-only table of existing cost configs.
// Receives configs + callbacks from useCostsState via the page orchestrator.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, Star } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { CostConfig } from "./types";
import { cadenceLabel } from "./helpers";

interface CostConfigsTableProps {
  configs: CostConfig[];
  loading: boolean;
  onEdit: (config: CostConfig) => void;
  onDelete: (config: CostConfig) => void;
}

export function CostConfigsTable({ configs, loading, onEdit, onDelete }: CostConfigsTableProps) {
  const { formatMoney } = useCurrency();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead className="text-right">Proxy/Bot (mensal)</TableHead>
            <TableHead className="text-right">Leveling/Bot (unico)</TableHead>
            <TableHead className="text-right">Stash Pack/Bot (unico)</TableHead>
            <TableHead className="text-right">Explugins Key (diario)</TableHead>
            <TableHead className="text-right">DPB Key (diario)</TableHead>
            <TableHead className="text-right">Customs</TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          ) : configs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhuma configuracao encontrada. Crie a primeira.
              </TableCell>
            </TableRow>
          ) : (
            configs.map((config) => (
              <ConfigRow
                key={config.id}
                config={config}
                onEdit={onEdit}
                onDelete={onDelete}
                formatMoney={formatMoney}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// --- row sub-component ---

interface ConfigRowProps {
  config: CostConfig;
  onEdit: (config: CostConfig) => void;
  onDelete: (config: CostConfig) => void;
  formatMoney: (amount: number, currency: string) => string;
}

function ConfigRow({ config, onEdit, onDelete, formatMoney }: ConfigRowProps) {
  const customs = config.customCosts ?? [];

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {config.name}
          {config.isDefault && (
            <Badge variant="secondary" className="text-xs">
              <Star className="h-3 w-3 mr-1" />
              Padrao
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatMoney(Number(config.proxyCostPerBotMonthly), "usd")}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatMoney(Number(config.levelingCostPerBot), "usd")}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatMoney(Number(config.stashPackCostPerBot), "usd")}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatMoney(Number(config.expluginsKeyCostDaily), "usd")}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatMoney(Number(config.dpbKeyCostDaily), "usd")}
      </TableCell>
      <TableCell className="text-right">
        <CustomCostsBadge customs={customs} formatMoney={formatMoney} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Editar"
            onClick={() => onEdit(config)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            title="Deletar"
            onClick={() => onDelete(config)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// --- custom costs tooltip badge ---

interface CustomCostsBadgeProps {
  customs: NonNullable<CostConfig["customCosts"]>;
  formatMoney: (amount: number, currency: string) => string;
}

function CustomCostsBadge({ customs, formatMoney }: CustomCostsBadgeProps) {
  if (customs.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="font-mono cursor-help">
            {customs.length}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="text-xs space-y-0.5">
            {customs.map((c) => (
              <li key={c.id}>
                {c.name}: {formatMoney(Number(c.amount), "usd")} / {cadenceLabel(c.cadence)}
                {c.perBot ? " · por bot" : " · global"}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
