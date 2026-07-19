"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, PlusCircle, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PortableBlock {
  _type: "block";
  _key: string;
  style: string;
  children: Array<{
    _type: "span";
    _key: string;
    text: string;
    marks: string[];
  }>;
  markDefs: unknown[];
  listItem?: string;
  level?: number;
}

interface RawSection {
  _key: string;
  heading?: string;
  body?: PortableBlock[];
}

interface EditBuildOverviewFormProps {
  slug: string;
  initialSections: RawSection[];
}

export function EditBuildOverviewForm({
  slug,
  initialSections,
}: EditBuildOverviewFormProps) {
  const router = useRouter();
  const [sections, setSections] = useState<RawSection[]>(() =>
    initialSections.map((s) => ({
      ...s,
      body: s.body ? portableToText(s.body) : undefined,
    }) as unknown as RawSection),
  );
  const [saving, setSaving] = useState(false);

  const updateSection = useCallback(
    (index: number, field: "heading" | "body", value: string) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, [field]: value || undefined }
            : s,
        ),
      );
    },
    [],
  );

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      { _key: `new-${Date.now()}`, heading: "", body: "" } as unknown as RawSection,
    ]);
  }, []);

  const moveSection = useCallback((from: number, to: number) => {
    setSections((prev) => {
      const next = [...prev];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const formatted = sections.map((s, i) => ({
        _key: s._key || `section-${i}-${Date.now()}`,
        heading: s.heading || undefined,
        body: textToPortable(s.body),
      }));

      const res = await fetch(`/api/sanity/build-overview/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: formatted }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erro ao salvar");
        return;
      }
      toast.success("Build overview salvo");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <Card key={section._key}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="cursor-grab text-muted-foreground hover:text-foreground"
                title="Arrastar para reordenar"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground font-mono">
                Seção {index + 1}
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Mover para cima"
                    onClick={() => moveSection(index, index - 1)}
                  >
                    ↑
                  </Button>
                )}
                {index < sections.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Mover para baixo"
                    onClick={() => moveSection(index, index + 1)}
                  >
                    ↓
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  title="Remover seção"
                  onClick={() => removeSection(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Input
              placeholder="Heading (opcional) — ex: Gameplay Loop"
              value={(section as any).heading || ""}
              onChange={(e) => updateSection(index, "heading", e.target.value)}
            />
            <Textarea
              placeholder="Conteúdo da seção (Markdown)..."
              className="min-h-[120px] font-mono text-sm"
              value={typeof (section as any).body === "string" ? (section as any).body : ""}
              onChange={(e) => updateSection(index, "body", e.target.value)}
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={addSection}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar seção
        </Button>
        <div className="flex-1" />
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function portableToText(body: PortableBlock[]): string {
  return body
    .map((block) => {
      if (!block.children) return "";
      return block.children.map((span) => span.text || "").join("");
    })
    .join("\n");
}

function textToPortable(body: unknown): PortableBlock[] | undefined {
  if (!body) return undefined;

  if (Array.isArray(body)) {
    // Já é Portable Text — valida e retorna
    const valid = body.every(
      (b: any) => b._type === "block" && Array.isArray(b.children),
    );
    if (valid) return body as PortableBlock[];
  }

  const text = typeof body === "string" ? body : String(body);
  if (!text.trim()) return undefined;

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return paragraphs.map((para) => ({
    _type: "block" as const,
    _key: crypto.randomUUID(),
    style: "normal",
    children: [
      {
        _type: "span" as const,
        _key: crypto.randomUUID(),
        text: para.trim(),
        marks: [],
      },
    ],
    markDefs: [],
  }));
}
