"use client";
/**
 * PresetBar — inline controls for loading, saving, and managing presets.
 *
 * Rendered at the top of each benchmark form. Keeps three interactions together:
 *  1. Select — pick an existing preset to load its payload into the form.
 *  2. "Save as preset" — name + notes dialog to persist current form values.
 *  3. "Manage" — list all presets with individual delete + confirm dialogs.
 *
 * @example
 * <PresetBar type="qa" currentValues={form.getValues()} onLoad={handleLoad} />
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useBenchmarkPresets, type BenchmarkType } from "./use-benchmark-presets";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PresetBarProps {
  type: BenchmarkType;
  currentValues: unknown;
  onLoad: (payload: unknown, presetId: string) => void;
}

// ─── Save dialog ──────────────────────────────────────────────────────────────

interface SaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, notes: string) => Promise<void>;
}

function SaveDialog({ open, onClose, onSave }: SaveDialogProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function handleClose() {
    setName("");
    setNotes("");
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), notes.trim());
      setName("");
      setNotes("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar como preset</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome *</label>
            <Input
              placeholder="Ex: RF Juggernaut baseline"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Textarea
              placeholder="Contexto ou observações sobre este preset..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage dialog ────────────────────────────────────────────────────────────

interface ManageDialogProps {
  open: boolean;
  onClose: () => void;
  type: BenchmarkType;
  onDelete: (id: string) => Promise<void>;
}

function ManageDialog({ open, onClose, type, onDelete }: ManageDialogProps) {
  const { presets, isLoading } = useBenchmarkPresets(type);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await onDelete(pendingDeleteId);
      toast.success("Preset excluído");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir preset");
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar presets</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {isLoading && (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            )}
            {!isLoading && presets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum preset salvo. Use "Salvar como preset" para criar um.
              </p>
            )}
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{preset.name}</p>
                  {preset.notes && (
                    <p className="truncate text-xs text-muted-foreground">{preset.notes}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setPendingDeleteId(preset.id)}
                >
                  Excluir
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(o) => { if (!o) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir preset?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── PresetBar ────────────────────────────────────────────────────────────────

export function PresetBar({ type, currentValues, onLoad }: PresetBarProps) {
  const { presets, createPreset, deletePreset } = useBenchmarkPresets(type);
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  function handleSelectPreset(id: string) {
    setSelectedId(id);
    const preset = presets.find((p) => p.id === id);
    if (preset) onLoad(preset.payload, preset.id);
  }

  async function handleSave(name: string, notes: string) {
    try {
      await createPreset({ name, type, payload: currentValues, notes: notes || undefined });
      toast.success(`Preset "${name}" salvo`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar preset");
      // Re-throw so SaveDialog can reset its saving state correctly.
      throw err;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedId} onValueChange={handleSelectPreset}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Carregar preset..." />
        </SelectTrigger>
        <SelectContent>
          {presets.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhum preset — salve um abaixo
            </div>
          ) : (
            presets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Button size="sm" variant="secondary" onClick={() => setSaveOpen(true)}>
        Salvar como preset
      </Button>

      <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
        Gerenciar
      </Button>

      <SaveDialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSave={handleSave}
      />

      <ManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        type={type}
        onDelete={deletePreset}
      />
    </div>
  );
}
