"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "./helpers";

interface InlineCellProps {
  value: number | null;
  /** True when the value is inherited from week defaults (renders gray + italic). */
  inherited: boolean;
  onSave: (val: number | null) => void;
  onReset?: () => void;
  type?: "int" | "decimal";
  prefix?: string;
  className?: string;
}

/**
 * Inline-editable table cell. Click to edit, Enter/blur to commit, Escape to cancel.
 * Renders gray+italic when inherited from week defaults, bold when overridden.
 */
export function InlineCell({
  value,
  inherited,
  onSave,
  onReset,
  type = "decimal",
  prefix = "",
  className,
}: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditValue(value !== null && value !== undefined ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed === "" || trimmed === String(value)) return;
    const parsed = type === "int" ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (isNaN(parsed)) return;
    onSave(parsed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  const displayVal =
    value !== null && value !== undefined
      ? `${prefix}${type === "int" ? Number(value).toLocaleString("pt-BR") : fmtNum(value)}`
      : "-";

  return (
    <div className={cn("flex items-center justify-end gap-1 group", className)}>
      {editing ? (
        <input
          ref={inputRef}
          className="h-6 w-20 text-right font-mono text-sm px-1 bg-background border border-input rounded-sm outline-none focus:ring-1 focus:ring-ring"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span
          className={cn(
            "cursor-pointer font-mono text-sm",
            inherited ? "text-muted-foreground italic" : "font-bold"
          )}
          onClick={startEdit}
          title={
            inherited
              ? "Herdado da semana (clique para sobrescrever)"
              : "Valor sobrescrito"
          }
        >
          {displayVal}
        </span>
      )}
      {!editing && !inherited && onReset && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restaurar padrao da semana</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
