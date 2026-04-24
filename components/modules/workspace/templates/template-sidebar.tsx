'use client';

/** Left sidebar listing all available templates with selection state. */

import type { TemplateListItem } from './types';

interface TemplateSidebarProps {
  templates: TemplateListItem[];
  selected: string | null;
  loading: boolean;
  onSelect: (file: string) => void;
}

export function TemplateSidebar({
  templates,
  selected,
  loading,
  onSelect,
}: TemplateSidebarProps) {
  return (
    <div className="w-64 border-r border-border bg-background flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto scrollbar-none py-2">
        {loading && (
          <p className="px-4 text-xs text-muted-foreground">Loading...</p>
        )}
        {!loading && templates.length === 0 && (
          <p className="px-4 text-xs text-muted-foreground">No templates yet.</p>
        )}
        {!loading &&
          templates.map((t) => (
            <button
              key={t.file}
              onClick={() => onSelect(t.file)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selected === t.file
                  ? 'bg-foreground/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface'
              }`}
            >
              <span>{t.name}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
