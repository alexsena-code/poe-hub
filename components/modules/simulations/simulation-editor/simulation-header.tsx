"use client";

// Header section: back button, inline name editing, league/status inline
// editing, ImportPricesDialog and CostConfigSelector actions.

import { ArrowLeft, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportPricesDialog } from "../import-prices-dialog";
import { CostConfigSelector } from "../cost-config-selector";
import { STATUS_LABELS, STATUS_VARIANTS, type CostConfig, type Simulation } from "./types";

interface League {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface SimulationHeaderProps {
  simulation: Simulation;
  simulationId: string;
  editingName: boolean;
  nameValue: string;
  editingStatus: boolean;
  editingLeague: boolean;
  costConfig: CostConfig | null;
  leagues: League[];
  onBackClick: () => void;
  onStartEditName: () => void;
  onNameChange: (val: string) => void;
  onSaveName: () => void;
  onCancelEditName: () => void;
  onNameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onStatusChange: (status: string) => void;
  onEditStatusOpen: () => void;
  onLeagueChange: (val: string) => void;
  onEditLeagueOpen: () => void;
  onImported: () => void;
  onCostConfigChange: (config: CostConfig | null) => void;
}

export function SimulationHeader({
  simulation,
  simulationId,
  editingName,
  nameValue,
  editingStatus,
  editingLeague,
  costConfig,
  leagues,
  onBackClick,
  onStartEditName,
  onNameChange,
  onSaveName,
  onCancelEditName,
  onNameKeyDown,
  onStatusChange,
  onEditStatusOpen,
  onLeagueChange,
  onEditLeagueOpen,
  onImported,
  onCostConfigChange,
}: SimulationHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="mb-2" onClick={onBackClick}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                className="text-2xl font-bold h-10 w-96"
                value={nameValue}
                onChange={(e) => onNameChange(e.target.value)}
                onKeyDown={onNameKeyDown}
                autoFocus
              />
              <Button variant="ghost" size="icon" onClick={onSaveName}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onCancelEditName}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h1
              className="text-3xl font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
              onClick={onStartEditName}
            >
              {simulation.name}
              <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h1>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {editingLeague ? (
            <Select defaultValue={simulation.league} onValueChange={onLeagueChange}>
              <SelectTrigger className="h-7 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leagues.map((l) => (
                  <SelectItem key={l.id} value={l.name}>
                    {l.name} {l.isCurrent ? "(atual)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span
              className="cursor-pointer hover:text-foreground transition-colors"
              onClick={onEditLeagueOpen}
            >
              Liga: {simulation.league}
            </span>
          )}
          <Separator orientation="vertical" className="h-4" />
          <span>{simulation.durationWeeks} semanas</span>
          <Separator orientation="vertical" className="h-4" />

          {editingStatus ? (
            <Select value={simulation.status} onValueChange={onStatusChange}>
              <SelectTrigger className="w-36 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="archived">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge
              variant={STATUS_VARIANTS[simulation.status] ?? "outline"}
              className="cursor-pointer"
              onClick={onEditStatusOpen}
            >
              {STATUS_LABELS[simulation.status] ?? simulation.status}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <ImportPricesDialog simulationId={simulationId} onImported={onImported} />
        <CostConfigSelector
          simulationId={simulationId}
          selectedConfigId={costConfig?.id ?? null}
          onConfigChange={(c) => onCostConfigChange(c as CostConfig | null)}
        />
      </div>
    </div>
  );
}
