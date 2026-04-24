"use client";

// Orchestrator for /admin/config/costs.
// All state + mutations live in useCostsState; sub-components handle rendering.

import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useCostsState } from "@/components/modules/admin/config/costs/use-costs-state";
import { CostConfigsTable } from "@/components/modules/admin/config/costs/cost-configs-table";
import { CostConfigFormDialog } from "@/components/modules/admin/config/costs/cost-config-form-dialog";

export default function CostConfigsPage() {
  const router = useRouter();

  const {
    configs, loading,
    dialogOpen, setDialogOpen, editingConfig,
    submitting,
    formMethods, customFields,
    fieldCurrencies, customCurrencies,
    openCreate, openEdit, handleDelete,
    handleSubmit,
    addCustomCost, removeCustom,
    toggleFieldCurrency, toggleCustomCurrency,
  } = useCostsState();

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2"
          onClick={() => router.push("/admin/config")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Configuracoes
        </Button>
        <PageHeader
          title="Configuracoes de Custos"
          description="Gerencie os perfis de custo operacional usados nas simulacoes."
          actions={
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Configuracao
            </Button>
          }
        />
      </div>

      <CostConfigsTable
        configs={configs}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <CostConfigFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingConfig={editingConfig}
        submitting={submitting}
        formMethods={formMethods}
        customFields={customFields}
        fieldCurrencies={fieldCurrencies}
        customCurrencies={customCurrencies}
        onSubmit={handleSubmit}
        onAddCustomCost={addCustomCost}
        onRemoveCustom={removeCustom}
        onToggleFieldCurrency={toggleFieldCurrency}
        onToggleCustomCurrency={toggleCustomCurrency}
      />
    </div>
  );
}
