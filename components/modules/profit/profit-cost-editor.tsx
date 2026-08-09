"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";
import type { DailyCostComponents } from "@/lib/daily-cost";
import { NumberField } from "./number-field";

/**
 * Custos que a tela está usando agora. Nasce da config selecionada e o
 * operador edita à vontade: nada aqui volta para o banco — é bancada de
 * simulação, não formulário de cadastro. Para mudar de verdade, /admin/config.
 */
export interface ProfitCostState {
  parts: DailyCostComponents;
  /** Leveling + stash pack + customs únicos, por bot. */
  oneTimePerBot: number;
}

interface ProfitCostEditorProps {
  value: ProfitCostState;
  /** true quando o operador já mexeu em algum campo. */
  edited: boolean;
  configName: string | null;
  onChange: (patch: Partial<DailyCostComponents>) => void;
  onChangeOneTime: (value: number) => void;
  onReset: () => void;
}

const PER_BOT_FIELDS: { key: keyof DailyCostComponents; label: string; suffix: string }[] = [
  { key: "expluginsPerBotDaily", label: "ExPlugins", suffix: "US$/bot/dia" },
  { key: "dpbPerBotDaily", label: "DPB", suffix: "US$/bot/dia" },
  { key: "proxyPerBotDaily", label: "Proxy", suffix: "US$/bot/dia" },
  { key: "customPerBotDaily", label: "Outros (por bot)", suffix: "US$/bot/dia" },
  { key: "customGlobalDaily", label: "Outros (global)", suffix: "US$/dia" },
];

export function ProfitCostEditor({
  value,
  edited,
  configName,
  onChange,
  onChangeOneTime,
  onReset,
}: ProfitCostEditorProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            Custos desta simulação
            {edited && (
              <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                editado — não salvo
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {edited
              ? "Valores só desta tela. A config no banco continua intacta."
              : `Vindos de ${configName ?? "nenhuma config"}. Edite para simular.`}
          </p>
        </div>
        {edited && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Restaurar
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PER_BOT_FIELDS.map((field) => (
          <NumberField
            key={field.key}
            id={`custo-${field.key}`}
            label={field.label}
            value={value.parts[field.key]}
            min={0}
            max={1000}
            step={0.01}
            suffix={field.suffix}
            onChange={(v) => onChange({ [field.key]: v } as Partial<DailyCostComponents>)}
          />
        ))}
        <NumberField
          id="custo-setup"
          label="Setup do bot (único)"
          value={value.oneTimePerBot}
          min={0}
          max={10000}
          step={1}
          suffix="US$/bot"
          onChange={onChangeOneTime}
        />
      </CardContent>
    </Card>
  );
}
