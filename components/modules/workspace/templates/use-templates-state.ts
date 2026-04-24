'use client';

/**
 * Central state hook for the workspace/templates page.
 * Owns all async operations (fetch, save, delete, YAML import) and
 * derived mutation helpers (section add/update/delete, toggle expand).
 */

import { useState, useEffect, useCallback } from 'react';
import { apiToTemplate, templateToApi, emptyTemplate, emptySection } from './helpers';
import type { Template, TemplateListItem, TemplateSection } from './types';

const API_URL = '/api/engine';

interface TemplatesState {
  templates: TemplateListItem[];
  selected: string | null;
  current: Template | null;
  loading: boolean;
  saving: boolean;
  expandedSections: Set<string>;
  confirmDelete: boolean;
  showYamlImport: boolean;
  yamlText: string;
}

interface TemplatesActions {
  selectTemplate: (file: string) => Promise<void>;
  handleNew: () => void;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleImportYaml: () => Promise<void>;
  setCurrent: (t: Template) => void;
  updateSection: (index: number, section: TemplateSection) => void;
  deleteSection: (index: number) => void;
  addSection: () => void;
  toggleSection: (id: string) => void;
  setConfirmDelete: (v: boolean) => void;
  setShowYamlImport: (v: boolean) => void;
  setYamlText: (v: string) => void;
}

export function useTemplatesState(): TemplatesState & TemplatesActions {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [current, setCurrent] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showYamlImport, setShowYamlImport] = useState(false);
  const [yamlText, setYamlText] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/content/templates`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = (await res.json()) as TemplateListItem[];
      setTemplates(data);
    } catch {
      // API not available — operator will see empty sidebar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  async function selectTemplate(file: string) {
    setSelected(file);
    setConfirmDelete(false);
    setExpandedSections(new Set());
    try {
      const res = await fetch(`${API_URL}/content/templates/${encodeURIComponent(file)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = (await res.json()) as Record<string, unknown>;
      setCurrent(apiToTemplate(data));
    } catch {
      // Fallback: build a bare template from the list entry
      const entry = templates.find((t) => t.file === file);
      if (!entry) return;
      setCurrent({
        name: entry.name,
        slug: entry.file.replace('.yaml', ''),
        targetWordCount: 2000,
        maxTokensPerSection: 5000,
        sections: [],
        seo: { primaryKeyword: '', secondaryKeywords: [], schemaType: '' },
      });
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
      if (!res.ok) {
        // Fallback: try parsing client-side with simple YAML→JSON
        // The js-yaml library isn't available, so we try JSON parse of YAML-like
        alert('Failed to parse YAML on server. Check format.');
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;
      const t = apiToTemplate(data);
      setCurrent(t);
      setSelected(null);
      setExpandedSections(new Set(t.sections.map((s) => s.id)));
      setShowYamlImport(false);
      setYamlText('');
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
        : `${API_URL}/content/templates/${encodeURIComponent(selected!)}`;
      const method = isNew ? 'POST' : 'PUT';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateToApi(current)),
      });

      await fetchTemplates();
      setSelected(current.name);
    } catch {
      // ignore — operator will retry
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    try {
      await fetch(`${API_URL}/content/templates/${encodeURIComponent(selected)}`, {
        method: 'DELETE',
      });
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

  return {
    templates,
    selected,
    current,
    loading,
    saving,
    expandedSections,
    confirmDelete,
    showYamlImport,
    yamlText,
    selectTemplate,
    handleNew,
    handleSave,
    handleDelete,
    handleImportYaml,
    setCurrent,
    updateSection,
    deleteSection,
    addSection,
    toggleSection,
    setConfirmDelete,
    setShowYamlImport,
    setYamlText,
  };
}
