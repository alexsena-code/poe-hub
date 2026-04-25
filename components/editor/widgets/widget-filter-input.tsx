'use client';
/**
 * Compact filter input used by every right-rail list widget (currencies,
 * items/gems/passives, slang lookup). Search-icon prefix and clear-button
 * suffix replaced ad-hoc per-widget Input wrappers — the shape and spacing
 * were drifting between widgets and the no-icon version was visually noisy
 * inside an already-busy accordion panel.
 *
 * Stays uncontrolled-ish: caller owns `value` + `onChange`. Clear button
 * fires `onChange("")` and refocuses so keyboard users can keep typing.
 */

import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetFilterInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Optional: appended after the placeholder so the count line collapses
   *  inside the input frame on tight layouts. Pass null to skip. */
  rightSlot?: React.ReactNode;
  className?: string;
}

export function WidgetFilterInput({
  value,
  onChange,
  placeholder,
  rightSlot,
  className,
}: WidgetFilterInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 h-8 rounded-md border border-zinc-800',
        'bg-zinc-900/40 px-2 text-xs',
        'focus-within:border-zinc-600 focus-within:bg-zinc-900/60 transition-colors',
        className,
      )}
    >
      <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'flex-1 bg-transparent border-0 outline-none',
          'text-zinc-100 placeholder:text-zinc-500',
          'text-xs leading-none',
        )}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          aria-label="Limpar filtro"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {rightSlot && !hasValue && (
        <span className="text-zinc-500 shrink-0">{rightSlot}</span>
      )}
    </div>
  );
}
