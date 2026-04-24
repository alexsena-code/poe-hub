'use client';

/**
 * Main editor panel: template metadata fields, sections list, and SEO block.
 * Rendered only when a template is loaded (current !== null).
 */

import { Input } from '@/components/ui/input';
import { TagInput } from './tag-input';
import { SectionEditor } from './section-editor';
import type { Template, TemplateSection } from './types';

interface TemplateFieldsProps {
  current: Template;
  expandedSections: Set<string>;
  onTemplateChange: (t: Template) => void;
  onSectionChange: (index: number, section: TemplateSection) => void;
  onSectionDelete: (index: number) => void;
  onSectionAdd: () => void;
  onSectionToggle: (id: string) => void;
}

export function TemplateFields({
  current,
  expandedSections,
  onTemplateChange,
  onSectionChange,
  onSectionDelete,
  onSectionAdd,
  onSectionToggle,
}: TemplateFieldsProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      {/* Template header fields */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">
              Template name
            </label>
            <Input
              value={current.name}
              onChange={(e) => onTemplateChange({ ...current, name: e.target.value })}
              className="font-bold"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs text-muted-foreground mb-1">
              Slug pattern
            </label>
            <Input
              value={current.slug}
              onChange={(e) => onTemplateChange({ ...current, slug: e.target.value })}
              className="font-mono"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-40">
            <label className="block text-xs text-muted-foreground mb-1">
              Target word count
            </label>
            <Input
              type="number"
              value={current.targetWordCount}
              onChange={(e) =>
                onTemplateChange({ ...current, targetWordCount: Number(e.target.value) })
              }
            />
          </div>
          <div className="w-48">
            <label className="block text-xs text-muted-foreground mb-1">
              Max tokens per section (default)
            </label>
            <Input
              type="number"
              value={current.maxTokensPerSection}
              onChange={(e) =>
                onTemplateChange({
                  ...current,
                  maxTokensPerSection: Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">
            Sections ({current.sections.length})
          </h3>
          <button
            onClick={onSectionAdd}
            className="px-3 py-1.5 rounded-md text-xs bg-surface-hover hover:bg-border text-muted-foreground transition-colors"
          >
            + Add section
          </button>
        </div>
        <div className="space-y-2">
          {current.sections.map((section, i) => (
            <SectionEditor
              key={section.id}
              section={section}
              onChange={(s) => onSectionChange(i, s)}
              onDelete={() => onSectionDelete(i)}
              expanded={expandedSections.has(section.id)}
              onToggle={() => onSectionToggle(section.id)}
            />
          ))}
        </div>
      </div>

      {/* SEO */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">SEO</h3>
        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1">
                Primary keyword
              </label>
              <Input
                value={current.seo.primaryKeyword}
                onChange={(e) =>
                  onTemplateChange({
                    ...current,
                    seo: { ...current.seo, primaryKeyword: e.target.value },
                  })
                }
              />
            </div>
            <div className="w-40">
              <label className="block text-xs text-muted-foreground mb-1">
                Schema type
              </label>
              <Input
                value={current.seo.schemaType}
                onChange={(e) =>
                  onTemplateChange({
                    ...current,
                    seo: { ...current.seo, schemaType: e.target.value },
                  })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Secondary keywords (Enter to add)
            </label>
            <TagInput
              tags={current.seo.secondaryKeywords}
              onChange={(secondaryKeywords) =>
                onTemplateChange({
                  ...current,
                  seo: { ...current.seo, secondaryKeywords },
                })
              }
              placeholder="Type a keyword and press Enter..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
