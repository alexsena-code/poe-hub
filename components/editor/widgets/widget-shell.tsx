'use client';
/**
 * Internal primitive that wraps AccordionItem with a standardised header
 * (icon + title + optional badge) and padded body.
 *
 * Every right-rail widget composes this so header spacing, icon size, and
 * border treatment are consistent across all five panels.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WidgetShellProps {
  /** Must match the value passed to <Accordion value> */
  id: string;
  icon: LucideIcon;
  title: string;
  /** Optional badge rendered after the title — use for counters or status chips */
  badge?: React.ReactNode;
  children: React.ReactNode;
  /** Extra class on the AccordionContent wrapper — use for overflow overrides */
  contentClassName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Wraps a single accordion section with consistent header + body layout.
 *
 * @example
 * <WidgetShell id="qa" icon={MessageSquare} title="Q&A Engine">
 *   <QaChatContent />
 * </WidgetShell>
 */
export function WidgetShell({
  id,
  icon: Icon,
  title,
  badge,
  children,
  contentClassName,
}: WidgetShellProps) {
  return (
    <AccordionItem value={id} className="border-b border-zinc-800 last:border-b-0">
      <AccordionTrigger
        className={cn(
          'flex items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200',
          'hover:bg-zinc-800/40 hover:no-underline transition-colors',
          '[&[data-state=open]>svg]:rotate-180',
        )}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="truncate">{title}</span>
          {badge && <span className="ml-1">{badge}</span>}
        </span>
      </AccordionTrigger>
      <AccordionContent className={cn('pb-0', contentClassName)}>
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
