'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { generateOutline } from '@/lib/content-api';
import { usePostStore } from '@/lib/engine-store';
import type { Briefing } from '@/lib/engine-types';

const API_URL = '/api/engine';

// Templates that use topic instead of skill/ascendancy
const TOPIC_TEMPLATES = ['mechanic_guide', 'qa_page', 'currency_guide', 'atlas_guide', 'faq', 'league_start', 'crafting_guide', 'tier_list', 'meta_report'];

export default function BriefingForm() {
  const router = useRouter();
  const { setBriefing, setPostId, initSections, setPhase } = usePostStore();

  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<Array<{ name: string; file: string }>>([]);
  const [form, setForm] = useState<Briefing>({
    skill: searchParams.get('topic') || '',
    ascendancy: '',
    topic: searchParams.get('topic') || '',
    league: '3.28',
    budgetLow: 5,
    budgetMid: 15,
    budgetHigh: 50,
    notes: searchParams.get('notes') || '',
    mode: 'outline_only',
    templateName: searchParams.get('template') || 'mechanic_guide',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTopicMode = TOPIC_TEMPLATES.includes(form.templateName || '');

  useEffect(() => {
    fetch(`${API_URL}/content/templates`)
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .catch(() => {});
  }, []);

  function updateField<K extends keyof Briefing>(key: K, value: Briefing[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isTopicMode) {
      if (!form.topic?.trim()) {
        setError('Topic e obrigatorio para este template.');
        return;
      }
    } else {
      if (!form.skill.trim() || !form.ascendancy.trim()) {
        setError('Skill e Ascendancy sao obrigatorios.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const postId = nanoid(10);
      const outline = await generateOutline(form);

      setPostId(postId);
      setBriefing(form);

      const sections = (
        outline.sections as Array<{
          id?: string;
          sectionId?: string;
          title: string;
          requiresHumanInput?: boolean;
          requires_human_input?: boolean;
        }>
      ).map((s) => ({
        sectionId: s.sectionId || s.id || nanoid(6),
        title: s.title,
        requiresHumanInput:
          s.requiresHumanInput ?? s.requires_human_input ?? false,
      }));

      initSections(sections);
      setPhase('writing');
      router.push(`/editor/${postId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao gerar outline.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Template */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Template
        </label>
        <select
          value={form.templateName || 'mechanic_guide'}
          onChange={(e) => updateField('templateName', e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {templates.map((t) => (
            <option key={t.file} value={t.file}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Topic (for mechanic_guide, qa_page) OR Skill+Ascendancy (for build_guide, tier_list, etc) */}
      {isTopicMode ? (
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Topic
          </label>
          <input
            type="text"
            placeholder="Ex: Delirium, Righteous Fire, Harvest Crafting"
            value={form.topic || ''}
            onChange={(e) => updateField('topic', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Skill
            </label>
            <input
              type="text"
              placeholder="Ex: Righteous Fire"
              value={form.skill}
              onChange={(e) => updateField('skill', e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Ascendancy
            </label>
            <input
              type="text"
              placeholder="Ex: Chieftain"
              value={form.ascendancy}
              onChange={(e) => updateField('ascendancy', e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      )}

      {/* League */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          League
        </label>
        <input
          type="text"
          placeholder="Ex: 3.24"
          value={form.league}
          onChange={(e) => updateField('league', e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Budget (only for build-type templates) */}
      {!isTopicMode && <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Budget (Divine Orbs)
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Starter</label>
            <input
              type="number"
              min={0}
              value={form.budgetLow}
              onChange={(e) =>
                updateField('budgetLow', Number(e.target.value))
              }
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Mid</label>
            <input
              type="number"
              min={0}
              value={form.budgetMid}
              onChange={(e) =>
                updateField('budgetMid', Number(e.target.value))
              }
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Endgame</label>
            <input
              type="number"
              min={0}
              value={form.budgetHigh}
              onChange={(e) =>
                updateField('budgetHigh', Number(e.target.value))
              }
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Notas
        </label>
        <textarea
          rows={3}
          placeholder="Notas adicionais..."
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 items-center justify-center rounded-lg bg-accent px-8 text-background font-semibold transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Gerando Outline...
          </span>
        ) : (
          'Gerar Outline'
        )}
      </button>
    </form>
  );
}
