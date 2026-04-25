"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { importGapsAction, type ImportGapsResult } from "@/app/(auth)/admin/competitor-gaps/actions";

interface ImportGapsButtonProps {
  uncoveredCount: number;
}

export function ImportGapsButton({ uncoveredCount }: ImportGapsButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      const result: ImportGapsResult = await importGapsAction();
      if (!result.ok) {
        toast.error(`Falha no import: ${result.error ?? "erro desconhecido"}`);
        return;
      }
      const imported = result.imported ?? 0;
      const skipped = result.skipped ?? 0;
      const detail = result.details;
      const skipDetails: string[] = [];
      if (detail?.already_covered?.length) skipDetails.push(`${detail.already_covered.length} já cobertos`);
      if (detail?.too_short?.length) skipDetails.push(`${detail.too_short.length} curtos demais`);
      if (detail?.db_error?.length) skipDetails.push(`${detail.db_error.length} erro DB`);
      const skipText = skipDetails.length > 0 ? ` (${skipDetails.join(", ")})` : "";
      toast.success(`Importados: ${imported} · Skipped: ${skipped}${skipText}`);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button disabled={isPending} variant="default">
          {isPending ? "Importando…" : `Importar gaps (${uncoveredCount})`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Importar gaps como keywords?</AlertDialogTitle>
          <AlertDialogDescription>
            Vai promover ~{uncoveredCount} gap(s) uncovered como
            <code className="mx-1">KeywordOpportunity</code> com source=competitor.
            Já-cobertos e tópicos curtos demais são automaticamente skippados pelo engine.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
