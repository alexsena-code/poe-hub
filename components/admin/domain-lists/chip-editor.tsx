"use client";

import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveDomainList, type SaveDomainListResult } from "@/app/(auth)/admin/domain-lists/actions";
import {
  LIST_HELP,
  LIST_LABEL,
  MAX_DOMAINS_PER_LIST,
  type ListType,
} from "./types";

interface ChipEditorProps {
  listType: ListType;
  domains: string[];
  dirty: boolean;
  onChange: (next: string[]) => void;
  onSaved: (domains: string[]) => void;
}

const SPLIT_RE = /[\s,;]+/g;
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Splits a bulk-paste blob into candidate domains. Tolerates newlines,
 * commas, semicolons, tabs — anything plausibly between domain entries.
 */
function splitBulk(value: string): string[] {
  return value
    .split(SPLIT_RE)
    .map(normalize)
    .filter(Boolean);
}

export function ChipEditor({ listType, domains, dirty, onChange, onSaved }: ChipEditorProps) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const counterTone = useMemo(() => {
    if (domains.length > MAX_DOMAINS_PER_LIST) return "text-destructive";
    if (domains.length >= MAX_DOMAINS_PER_LIST - 50) return "text-amber-400";
    return "text-muted-foreground";
  }, [domains.length]);

  const overLimit = domains.length > MAX_DOMAINS_PER_LIST;

  function addCandidates(candidates: string[]): void {
    if (candidates.length === 0) return;
    const existing = new Set(domains);
    const fresh: string[] = [];
    let duplicates = 0;
    let invalid = 0;
    for (const c of candidates) {
      if (!c) continue;
      if (existing.has(c)) {
        duplicates++;
        continue;
      }
      if (!DOMAIN_RE.test(c)) {
        invalid++;
        continue;
      }
      existing.add(c);
      fresh.push(c);
    }
    if (fresh.length === 0) {
      if (duplicates > 0) toast.warning(`${duplicates} duplicado(s) ignorado(s)`);
      if (invalid > 0) toast.error(`${invalid} entrada(s) com formato inválido`);
      return;
    }
    onChange([...domains, ...fresh]);
    if (duplicates > 0) toast.info(`${fresh.length} adicionado(s), ${duplicates} duplicado(s) ignorado(s)`);
    if (invalid > 0) toast.warning(`${fresh.length} adicionado(s), ${invalid} inválido(s) ignorado(s)`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      const candidates = splitBulk(draft);
      if (candidates.length > 0) {
        addCandidates(candidates);
        setDraft("");
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!text.match(SPLIT_RE) || text.split(SPLIT_RE).filter(Boolean).length <= 1) {
      // Single value paste — let the default paste handler run, user types Enter to add.
      return;
    }
    e.preventDefault();
    const candidates = splitBulk(text);
    addCandidates(candidates);
    setDraft("");
  }

  function removeAt(idx: number) {
    onChange(domains.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (overLimit) {
      toast.error(`Lista acima do limite (${domains.length}/${MAX_DOMAINS_PER_LIST}) — remova entradas antes de salvar.`);
      return;
    }
    startTransition(async () => {
      const result: SaveDomainListResult = await saveDomainList(listType, domains);
      if (result.ok) {
        toast.success(`${LIST_LABEL[listType]}: ${result.count ?? domains.length} domínios salvos`);
        onSaved(domains);
      } else {
        toast.error(`Falha ao salvar: ${result.error ?? "erro desconhecido"}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">{LIST_HELP[listType]}</div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/40 p-3 min-h-[60px]">
        {domains.length === 0 && (
          <span className="text-xs text-muted-foreground italic">Nenhum domínio. Cole abaixo ou tecle.</span>
        )}
        {domains.map((d, i) => (
          <Badge
            key={`${d}-${i}`}
            variant="secondary"
            className="flex items-center gap-1 pr-1 font-mono text-xs"
          >
            {d}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="ml-1 rounded hover:bg-foreground/10"
              aria-label={`Remover ${d}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <Input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="exemplo.com (Enter, Tab, vírgula ou bulk-paste)"
        className="font-mono text-sm"
        autoComplete="off"
      />

      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-xs", counterTone)}>
          {domains.length}/{MAX_DOMAINS_PER_LIST}
          {overLimit && " — acima do limite"}
          {dirty && !overLimit && " · alterações não salvas"}
        </span>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!dirty || overLimit || isPending}
          size="sm"
        >
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
