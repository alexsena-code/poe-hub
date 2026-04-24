"use client";

/**
 * Button that creates Sanity drafts from an engine guide and redirects the
 * operator to the PT-BR draft's blog editor.
 *
 * Props: { guide: PostDetail } — the guide object already fetched by the RSC
 * parent (GuidePage).
 *
 * Flow:
 *   1. Operator clicks "Editar no Blog".
 *   2. A Dialog asks which languages to import (default: both PT-BR + EN).
 *   3. POST /api/sanity/draft-from-guide with { guideSlug, languages }.
 *   4. On success: toast + router.push to the PT-BR draft editor.
 *
 * Session 10.e.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PostDetail } from "@/lib/content-api";

interface Props {
  guide: PostDetail;
}

type Language = "pt-br" | "en";

interface DraftRef {
  id: string;
  language: Language;
  slug: string;
  title: string;
}

export function ImportToBlogButton({ guide }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState<Language[]>(["pt-br", "en"]);

  function toggleLanguage(lang: Language) {
    setSelectedLangs((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function handleConfirm() {
    if (!selectedLangs.length) {
      toast.error("Selecione ao menos um idioma.");
      return;
    }

    setDialogOpen(false);

    startTransition(async () => {
      await importGuide(selectedLangs);
    });
  }

  async function importGuide(languages: Language[]) {
    let drafts: DraftRef[] = [];

    try {
      const res = await fetch("/api/sanity/draft-from-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guideSlug: guide.slug, languages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { drafts: DraftRef[] };
      drafts = data.drafts;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Falha ao criar draft: ${message}`);
      return;
    }

    const ptbr = drafts.find((d) => d.language === "pt-br");
    const en = drafts.find((d) => d.language === "en");

    const count = drafts.length;
    const toastMessage = `${count} draft${count !== 1 ? "s" : ""} criado${count !== 1 ? "s" : ""}.`;

    if (en && ptbr) {
      toast.success(toastMessage, {
        description: `EN: /workspace/blog/${en.id}/edit`,
        duration: 6000,
      });
    } else {
      toast.success(toastMessage);
    }

    const target = ptbr ?? drafts[0];
    if (target) {
      router.push(`/workspace/blog/${target.id}/edit`);
    }
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={isPending}
      >
        <Send className="h-4 w-4" />
        {isPending ? "Importando..." : "Editar no Blog"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Importar para o Blog</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Selecione os idiomas para criar drafts separados no Sanity:
          </p>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="lang-ptbr"
                checked={selectedLangs.includes("pt-br")}
                onCheckedChange={() => toggleLanguage("pt-br")}
              />
              <Label htmlFor="lang-ptbr">PT-BR</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="lang-en"
                checked={selectedLangs.includes("en")}
                onCheckedChange={() => toggleLanguage("en")}
              />
              <Label htmlFor="lang-en">EN</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedLangs.length}>
              Criar drafts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
