"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtNum } from "./helpers";

interface DefaultFieldProps {
  label: string;
  value: number | null;
  onSave: (val: number) => void;
  type?: "int" | "decimal";
  prefix?: string;
  tooltip?: string;
}

/**
 * Inline-editable week-level default field (shown in the params bar above the day table).
 * Click the value to edit; Enter/blur commits, Escape cancels.
 */
export function DefaultField({
  label,
  value,
  onSave,
  type = "decimal",
  prefix = "",
  tooltip,
}: DefaultFieldProps) {
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
    if (trimmed === "") return;
    const parsed = type === "int" ? parseInt(trimmed, 10) : parseFloat(trimmed);
    if (isNaN(parsed)) return;
    if (parsed === value) return;
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
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          ref={inputRef}
          className="h-8 w-28 font-mono text-sm"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className="cursor-pointer font-mono text-sm font-bold hover:text-primary transition-colors"
                onClick={startEdit}
              >
                {displayVal}
              </p>
            </TooltipTrigger>
            {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
