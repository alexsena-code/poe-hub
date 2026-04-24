'use client';

/** Accordion-style editor for a single template section. */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TagInput } from './tag-input';
import { QUERY_TYPES, type TemplateSection } from './types';

interface SectionEditorProps {
  section: TemplateSection;
  onChange: (section: TemplateSection) => void;
  onDelete: () => void;
  expanded: boolean;
  onToggle: () => void;
}

export function SectionEditor({
  section,
  onChange,
  onDelete,
  expanded,
  onToggle,
}: SectionEditorProps) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Accordion header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-hover transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs font-mono">{section.id}</span>
          <span className="text-sm font-medium text-foreground">
            {section.title || 'Untitled section'}
          </span>
          {section.requiresHumanInput && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400">
              human input
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs">{expanded ? '[-]' : '[+]'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {/* Title */}
          <div className="mt-4">
            <label className="block text-xs text-muted-foreground mb-1">Title</label>
            <Input
              value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })}
            />
          </div>

          {/* Instruction */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Instruction</label>
            <Textarea
              value={section.instruction}
              onChange={(e) => onChange({ ...section, instruction: e.target.value })}
              rows={5}
              className="resize-none font-mono leading-relaxed"
            />
          </div>

          {/* Query type + Max tokens row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">Query type</label>
              <select
                value={section.queryType}
                onChange={(e) => onChange({ ...section, queryType: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {QUERY_TYPES.map((qt) => (
                  <option key={qt} value={qt}>
                    {qt}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs text-muted-foreground mb-1">Max tokens</label>
              <Input
                type="number"
                value={section.maxTokens}
                onChange={(e) => onChange({ ...section, maxTokens: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* RAG queries */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              RAG queries (Enter to add)
            </label>
            <TagInput
              tags={section.ragQueries}
              onChange={(ragQueries) => onChange({ ...section, ragQueries })}
              placeholder="Type a query and press Enter..."
            />
          </div>

          {/* Requires human input + Delete */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={section.requiresHumanInput}
                onChange={(e) =>
                  onChange({ ...section, requiresHumanInput: e.target.checked })
                }
                className="rounded border-border"
              />
              Requires human input
            </label>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-600/20 transition-colors"
            >
              Remove section
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
