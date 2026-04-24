"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";

interface CostConfig {
  id: string;
  name: string;
  isDefault: boolean;
  proxyCostPerBotMonthly: number;
  levelingCostPerBot: number;
  stashPackCostPerBot: number;
  expluginsKeyCostDaily: number;
  dpbKeyCostDaily: number;
}

interface CostConfigSelectorProps {
  simulationId: string;
  selectedConfigId: string | null;
  onConfigChange: (config: CostConfig | null) => void;
}

export function CostConfigSelector({
  simulationId,
  selectedConfigId,
  onConfigChange,
}: CostConfigSelectorProps) {
  const [configs, setConfigs] = useState<CostConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cost-configs")
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data.data ?? [];
        setConfigs(items);
      })
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleChange(configId: string) {
    const config = configs.find((c) => c.id === configId) ?? null;

    try {
      // Link the cost config to the simulation
      const res = await fetch(`/api/simulations/${simulationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costConfigId: configId }),
      });
      if (!res.ok) throw new Error();
      onConfigChange(config);
      toast.success("Configuracao de custos atualizada");
    } catch {
      toast.error("Erro ao atualizar configuracao de custos");
    }
  }

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Configuracao de Custos
        </Label>
        <Select
          value={selectedConfigId ?? ""}
          onValueChange={handleChange}
          disabled={loading}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecionar config de custos" />
          </SelectTrigger>
          <SelectContent>
            {configs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} {c.isDefault ? "(padrao)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link href="/admin/config/costs">
          <Settings2 className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
