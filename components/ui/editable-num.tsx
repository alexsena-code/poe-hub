"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EditableNumProps {
  value: number;
  onChange: (v: number) => void;
  type?: "int" | "decimal";
  decimals?: number;
  className?: string;
  /** When true, the value is displayed as an override (e.g. amber + small badge). */
  overridden?: boolean;
  /** Called when the override reset badge is clicked. */
  onReset?: () => void;
  /** Display formatter. Defaults to toFixed(decimals) / integer. */
  format?: (v: number) => string;
  /** Placeholder to show when value is 0 or NaN and `emptyAsPlaceholder` is true. */
  placeholder?: string;
  emptyAsPlaceholder?: boolean;
}

export function EditableNum({
  value,
  onChange,
  type = "decimal",
  decimals,
  className,
  overridden = false,
  onReset,
  format,
  placeholder,
  emptyAsPlaceholder,
}: EditableNumProps) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setEditVal(String(value));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  function commit() {
    setEditing(false);
    const parsed = type === "int" ? parseInt(editVal) : parseFloat(editVal);
    if (!isNaN(parsed) && parsed !== value) onChange(parsed);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={cn(
          "h-6 w-20 text-center font-mono text-sm bg-background border border-input rounded-sm outline-none focus:ring-1 focus:ring-ring",
          className
        )}
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  const displayFn =
    format ??
    ((v: number) => {
      if (type === "int") return String(Math.round(v));
      if (decimals != null) return v.toFixed(decimals);
      return v.toFixed(2);
    });

  const isEmpty = emptyAsPlaceholder && (!Number.isFinite(value) || value === 0);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "cursor-pointer font-mono text-sm hover:text-primary transition-colors underline decoration-dotted underline-offset-4",
          overridden && "text-amber-500",
          isEmpty && "text-muted-foreground italic"
        )}
        onClick={start}
        title="Clique para editar"
      >
        {isEmpty ? placeholder ?? "—" : displayFn(value)}
      </span>
      {overridden && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-amber-500/70 hover:text-amber-500 text-[10px] leading-none"
          title="Valor manual — clique para resetar"
        >
          ✎
        </button>
      )}
    </span>
  );
}
