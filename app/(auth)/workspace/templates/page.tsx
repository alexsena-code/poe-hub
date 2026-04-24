'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const API_URL = '/api/engine';

interface TemplateSection {
  id: string;
  title: string;
  instruction: string;
  queryType: string;
  ragQueries: string[];
  maxTokens: number;
  requiresHumanInput: boolean;
}

interface TemplateSeo {
  primaryKeyword: string;
  secondaryKeywords: string[];
  schemaType: string;
}

interface Template {
  name: string;
  slug: string;
  targetWordCount: number;
  maxTokensPerSection: number;
  sections: TemplateSection[];
  seo: TemplateSeo;
}

const QUERY_TYPES = [
  'qa',
  'mechanic_question',
  'build_guide',
  'meta_report',
  'tier_list',
  'patch_analysis',
  'item_lookup',
];

/** Convert API YAML shape → frontend Template shape */
function apiToTemplate(data: any): Template {
  const t = data.template || {};
  return {
    name: t.name || '',
    slug: t.slug_pattern || '',
    targetWordCount: parseInt(String(t.target_length_words || '2000').split('-').pop() || '2000', 10),
    maxTokensPerSection: t.max_tokens_per_section || 3000,
    sections: (data.sections || []).map((s: any) => ({
      id: s.id || '',
      title: s.title || '',
      instruction: s.instruction || '',
      queryType: s.query_type || 'qa',
      ragQueries: s.rag_queries || [],
      maxTokens: s.max_tokens || 0,
      requiresHumanInput: s.requires_human_input === true || s.requires_human_input === 'recommended',
    })),
    seo: {
      primaryKeyword: data.seo?.primary_keyword || '',
      secondaryKeywords: data.seo?.secondary_keywords || [],
      schemaType: data.seo?.schema_type || 'Article',
    },
  };
}

/** Convert frontend Template shape → API YAML shape */
function templateToApi(t: Template): any {
  return {
    template: {
      name: t.name,
      slug_pattern: t.slug,
      target_length_words: `${Math.round(t.targetWordCount * 0.6)}-${t.targetWordCount}`,
      output_languages: ['pt-br', 'en'],
      ...(t.maxTokensPerSection ? { max_tokens_per_section: t.maxTokensPerSection } : {}),
    },
    sections: t.sections.map((s) => ({
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      query_type: s.queryType,
      rag_queries: s.ragQueries,
      ...(s.maxTokens ? { max_tokens: s.maxTokens } : {}),
      requires_human_input: s.requiresHumanInput,
    })),
    seo: {
      primary_keyword: t.seo.primaryKeyword,
      secondary_keywords: t.seo.secondaryKeywords,
      schema_type: t.seo.schemaType,
    },
  };
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 min-h-[38px] focus-within:ring-1 focus-within:ring-accent">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/10 text-xs text-foreground"
        >
          {tag}
          <button
            onClick={() => remove(tag)}
            className="text-muted-foreground hover:text-foreground"
          >
            x
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

function SectionEditor({
  section,
  onChange,
  onDelete,
  expanded,
  onToggle,
}: {
  section: TemplateSection;
  onChange: (section: TemplateSection) => void;
  onDelete: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
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
              onChange={(e) =>
                onChange({ ...section, instruction: e.target.value })
              }
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
                onChange={(e) =>
                  onChange({ ...section, queryType: e.target.value })
                }
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
                onChange={(e) =>
                  onChange({ ...section, maxTokens: Number(e.target.value) })
                }
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
                  onChange({
                    ...section,
                    requiresHumanInput: e.target.checked,
                  })
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

function emptySection(index: number): TemplateSection {
  return {
    id: `section_${index}`,
    title: '',
    instruction: '',
    queryType: 'qa',
    ragQueries: [],
    maxTokens: 500,
    requiresHumanInput: false,
  };
}

function emptyTemplate(): Template {
  return {
    name: 'New Template',
    slug: 'new-template',
    targetWordCount: 2000,
    maxTokensPerSection: 500,
    sections: [emptySection(1)],
    seo: {
      primaryKeyword: '',
      secondaryKeywords: [],
      schemaType: 'Article',
    },
  };
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Array<{ name: string; file: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [current, setCurrent] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showYamlImport, setShowYamlImport] = useState(false);
  const [yamlText, setYamlText] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/content/templates`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTemplates(data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function selectTemplate(name: string) {
    setSelected(name);
    setConfirmDelete(false);
    setExpandedSections(new Set());
    try {
      const res = await fetch(`${API_URL}/content/templates/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCurrent(apiToTemplate(data));
    } catch {
      // fallback: find in list
      const t = templates.find((t) => t.name === name);
      if (t) setCurrent({ name: t.name, slug: (t as any).file?.replace('.yaml', '') || t.name, targetWordCount: 2000, maxTokensPerSection: 5000, sections: [], seo: { primaryKeyword: '', secondaryKeywords: [], schemaType: '' } });
    }
  }

  function handleNew() {
    const t = emptyTemplate();
    setCurrent(t);
    setSelected(null);
    setConfirmDelete(false);
    setExpandedSections(new Set(['section_1']));
  }

  async function handleImportYaml() {
    if (!yamlText.trim()) return;
    try {
      // Send raw YAML to backend to parse
      const res = await fetch(`${API_URL}/content/templates/parse-yaml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: yamlText }),
      });
      if (res.ok) {
        const data = await res.json();
        const t = apiToTemplate(data);
        setCurrent(t);
        setSelected(null);
        setExpandedSections(new Set(t.sections.map((s) => s.id)));
        setShowYamlImport(false);
        setYamlText('');
      } else {
        // Fallback: try parsing client-side with simple YAML→JSON
        // The js-yaml library isn't available, so we try JSON parse of YAML-like
        alert('Failed to parse YAML on server. Check format.');
      }
    } catch {
      alert('Failed to connect to API.');
    }
  }

  async function handleSave() {
    if (!current) return;
    setSaving(true);
    try {
      const isNew = !selected;
      const url = isNew
        ? `${API_URL}/content/templates`
        : `${API_URL}/content/templates/${encodeURIComponent(selected)}`;
      const method = isNew ? 'POST' : 'PUT';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateToApi(current)),
      });

      await fetchTemplates();
      setSelected(current.name);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    try {
      await fetch(
        `${API_URL}/content/templates/${encodeURIComponent(selected)}`,
        { method: 'DELETE' },
      );
      setCurrent(null);
      setSelected(null);
      setConfirmDelete(false);
      await fetchTemplates();
    } catch {
      // ignore
    }
  }

  function updateSection(index: number, section: TemplateSection) {
    if (!current) return;
    const sections = [...current.sections];
    sections[index] = section;
    setCurrent({ ...current, sections });
  }

  function deleteSection(index: number) {
    if (!current) return;
    const sections = current.sections.filter((_, i) => i !== index);
    setCurrent({ ...current, sections });
  }

  function addSection() {
    if (!current) return;
    const newSection = emptySection(current.sections.length + 1);
    setCurrent({ ...current, sections: [...current.sections, newSection] });
    setExpandedSections((prev) => new Set([...prev, newSection.id]));
  }

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-6">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-foreground">Templates</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage content generation templates
            </p>
          </div>

          {/* Inline stat */}
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</div>
            <div className="text-lg font-bold text-foreground">{templates.length}</div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setShowYamlImport(true)}
              className="px-4 py-2 rounded-md text-sm border border-border text-foreground hover:bg-foreground/5 transition-colors"
            >
              Import YAML
            </button>
            <button
              onClick={handleNew}
              className="px-4 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              + New Template
            </button>
          </div>
        </div>
      </div>

      {/* Content area — sidebar + editor */}
      <div className="flex flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-background flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto scrollbar-none py-2">
            {loading ? (
              <p className="px-4 text-xs text-muted-foreground">Loading...</p>
            ) : templates.length === 0 ? (
              <p className="px-4 text-xs text-muted-foreground">No templates yet.</p>
            ) : (
              templates.map((t) => (
                <button
                  key={t.file}
                  onClick={() => selectTemplate(t.file)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    selected === t.file
                      ? 'bg-foreground/10 text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <span>{t.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex-1 overflow-auto scrollbar-none">
          {!current ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">
                Select a template or create a new one.
              </p>
            </div>
          ) : (
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
                      onChange={(e) =>
                        setCurrent({ ...current, name: e.target.value })
                      }
                      className="font-bold"
                    />
                  </div>
                  <div className="w-48">
                    <label className="block text-xs text-muted-foreground mb-1">
                      Slug pattern
                    </label>
                    <Input
                      value={current.slug}
                      onChange={(e) =>
                        setCurrent({ ...current, slug: e.target.value })
                      }
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
                        setCurrent({
                          ...current,
                          targetWordCount: Number(e.target.value),
                        })
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
                        setCurrent({
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
                    onClick={addSection}
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
                      onChange={(s) => updateSection(i, s)}
                      onDelete={() => deleteSection(i)}
                      expanded={expandedSections.has(section.id)}
                      onToggle={() => toggleSection(section.id)}
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
                          setCurrent({
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
                          setCurrent({
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
                        setCurrent({
                          ...current,
                          seo: { ...current.seo, secondaryKeywords },
                        })
                      }
                      placeholder="Type a keyword and press Enter..."
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pb-8">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
                {selected && (
                  <>
                    {confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">
                          Delete &quot;{selected}&quot;?
                        </span>
                        <button
                          onClick={handleDelete}
                          className="px-3 py-1.5 rounded-md text-xs bg-red-600 hover:bg-red-500 text-white transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-3 py-1.5 rounded-md text-xs bg-surface-hover hover:bg-border text-muted-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="px-4 py-2.5 rounded-lg text-sm bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                      >
                        Delete Template
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* YAML Import Modal */}
      {showYamlImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Import YAML Template</h2>
              <button onClick={() => setShowYamlImport(false)} className="text-muted-foreground hover:text-foreground text-lg">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <p className="text-xs text-muted-foreground mb-3">
                Paste a template YAML (same format as config/templates/*.yaml). It will be parsed and loaded into the editor.
              </p>
              <Textarea
                value={yamlText}
                onChange={(e) => setYamlText(e.target.value)}
                placeholder={`template:\n  name: My Guide\n  slug_pattern: my-guide-{topic}\n  target_length_words: 1500-2000\n\nsections:\n  - id: intro\n    title: Introduction\n    instruction: Write an introduction...\n    query_type: qa\n    rag_queries:\n      - "{topic} overview"\n\nseo:\n  primary_keyword: "{topic}"\n  schema_type: Article`}
                className="h-72 font-mono resize-none"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowYamlImport(false)}
                className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportYaml}
                disabled={!yamlText.trim()}
                className="px-4 py-2 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                Parse & Load
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
