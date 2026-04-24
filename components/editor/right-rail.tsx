'use client';
/**
 * Right rail for the blog editor — five collapsible widgets in a vertical accordion.
 *
 * Replaces the old slotSidePanels pattern (side-panel-qa + side-panel-assets mounted
 * from the page level). All five widgets now live inside the shell itself, removing
 * the need for page-level slot assembly.
 *
 * Layout position: after EditorSidebar, width w-80, full-height with its own scroll.
 *
 * Persistence:
 * - Open accordion items are persisted to localStorage per draftId so the rail
 *   remembers its state across reloads for the same draft.
 * - Key: `editor-rail-open-${draftId}` — stores a JSON array of open item ids.
 * - Default open: 'qa' and 'content-score'.
 *
 * S10.a.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { QaChatWidget } from './widgets/qa-chat-widget';
import { AssetsWidget } from './widgets/assets-widget';
import { AssetsLookupWidget } from './widgets/assets-lookup-widget';
import { ContentScoreWidget } from './widgets/content-score-widget';
import { SlangReportWidget } from './widgets/slang-report-widget';
import { SlangLookupWidget } from './widgets/slang-lookup-widget';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RightRailProps {
  draftId: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const DEFAULT_OPEN: string[] = ['qa', 'content-score'];

function storageKey(draftId: string): string {
  return `editor-rail-open-${draftId}`;
}

function loadOpenItems(draftId: string): string[] {
  if (typeof window === 'undefined') return DEFAULT_OPEN;
  try {
    const raw = localStorage.getItem(storageKey(draftId));
    if (!raw) return DEFAULT_OPEN;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_OPEN;
  } catch {
    return DEFAULT_OPEN;
  }
}

function persistOpenItems(draftId: string, items: string[]): void {
  try {
    localStorage.setItem(storageKey(draftId), JSON.stringify(items));
  } catch {
    // localStorage quota exceeded — skip silently
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the five right-rail widgets in a controlled accordion.
 * State is persisted per draftId so reloading the same draft restores panel state.
 *
 * @example
 * <RightRail draftId={draftId} />
 */
export function RightRail({ draftId }: RightRailProps) {
  const [openItems, setOpenItems] = useState<string[]>(() => loadOpenItems(draftId));

  // Reload persisted state when the draft changes (navigating between drafts)
  useEffect(() => {
    setOpenItems(loadOpenItems(draftId));
  }, [draftId]);

  const handleValueChange = useCallback(
    (value: string[]) => {
      setOpenItems(value);
      persistOpenItems(draftId, value);
    },
    [draftId],
  );

  return (
    <aside
      className="w-80 shrink-0 border-l border-zinc-800 overflow-y-auto flex flex-col"
      aria-label="Editor right rail"
    >
      <Accordion
        type="multiple"
        value={openItems}
        onValueChange={handleValueChange}
        className="flex flex-col"
      >
        <QaChatWidget />
        <ContentScoreWidget />
        <SlangReportWidget />
        <AssetsWidget />
        <AssetsLookupWidget />
        <SlangLookupWidget />
      </Accordion>
    </aside>
  );
}
