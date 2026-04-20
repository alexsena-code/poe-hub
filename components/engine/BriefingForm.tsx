'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { generateOutline } from '@/lib/content-api';
import { usePostStore } from '@/lib/engine-store';
import type { Briefing } from '@/lib/engine-types';
import PlanPreview from './PlanPreview';

const API_URL = '/api/engine';

// Templates that use topic instead of skill/ascendancy.
// All current templates are topic-based (no build_guide anymore); legacy
// names (atlas_guide, league_start, etc.) stay here for posts generated
// before the template cleanup so they still render correctly on reopen.
const TOPIC_TEMPLATES = [
  'mechanic_guide', 'currency_guide', 'faq', 'quick_explainer', 'beginner_guide',
  // legacy
  'qa_page', 'atlas_guide', 'league_start', 'crafting_guide', 'tier_list',
  'meta_report', 'comparison',
];

// Stitches the structured brief (rationale + expanded briefing + keywords)
// with the user's free-form notes into a single Briefing.notes payload.
// User notes come last as "Additional guidance" — writers are told to
// treat them as addenda, not to replace the structured context.
function buildStitchedNotes(
  brief: {
    title: string;
    titleEn: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    cluster: string | null;
    rationale: string;
    briefingText: string | null;
    effort: string;
    urgency: string;
    score: number;
  },
  userNotes: string,
): string {
  const parts: string[] = [
    `## Content Brief`,
    `Title (PT-BR): ${brief.title}`,
    brief.titleEn ? `Title (EN): ${brief.titleEn}` : '',
    `Primary Keyword: ${brief.primaryKeyword}`,
    brief.secondaryKeywords.length > 0
      ? `Secondary Keywords: ${brief.secondaryKeywords.join(', ')}`
      : '',
    brief.cluster ? `Cluster/Theme: ${brief.cluster}` : '',
    '',
    `## Why This Topic`,
    brief.rationale,
    '',
  ];
  if (brief.briefingText) {
    parts.push(`## Expanded Briefing`, brief.briefingText, '');
  }
  parts.push(
    `## Editorial Guidance`,
    `Effort Level: ${brief.effort}`,
    `Urgency: ${brief.urgency}`,
    `Priority Score: ${brief.score}/100`,
  );
  const trimmed = userNotes.trim();
  if (trimmed) {
    parts.push('', `## Additional guidance from the editor`, trimmed);
  }
  return parts.filter((p) => p !== null && p !== undefined).join('\n');
}

interface BriefSource {
  id: number;
  title: string;
  titleEn: string;
  templateType: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  rationale: string;
  briefingText: string | null;
  cluster: string | null;
  urgency: string;
  effort: string;
  score: number;
}

export default function BriefingForm() {
  const router = useRouter();
  const { setBriefing, setPostId, initSections, setPhase } = usePostStore();

  const searchParams = useSearchParams();
  const briefIdParam = searchParams.get('briefId');
  const [templates, setTemplates] = useState<Array<{ name: string; file: string }>>([]);
  // The source brief (hydrated via ?briefId=X) is the authoritative data
  // that will be stitched into the Briefing.notes on submit. Keeping it
  // separate from the Notas textarea lets the user add their own addenda
  // without overwriting the structured briefing context.
  const [briefSource, setBriefSource] = useState<BriefSource | null>(null);
  const [briefLoading, setBriefLoading] = useState(!!briefIdParam);
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

  // Hydrate form from the full brief when arriving via /new?briefId=X.
  // We only seed the identifying fields (topic, template); the expanded
  // briefing stays in briefSource and is assembled into notes at submit.
  useEffect(() => {
    if (!briefIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/ideation/briefs/${briefIdParam}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BriefSource | { error: string };
        if ('error' in data) throw new Error(data.error);
        if (cancelled) return;
        setBriefSource(data);
        setForm((prev) => ({
          ...prev,
          topic: data.primaryKeyword || prev.topic,
          skill: data.primaryKeyword || prev.skill,
          templateName: data.templateType || prev.templateName,
        }));
      } catch (e) {
        if (!cancelled) {
          setError(`Falha ao carregar brief #${briefIdParam}: ${e instanceof Error ? e.message : 'erro'}`);
        }
      } finally {
        if (!cancelled) setBriefLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [briefIdParam]);

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
      // Build the final Briefing: stitch the hydrated brief (structured
      // context from ideation) together with the user's free-form addenda
      // from the Notas textarea. The brief block goes first so the LLM
      // treats the user's notes as higher-priority guidance.
      const briefingForPipeline: Briefing = briefSource
        ? {
            ...form,
            notes: buildStitchedNotes(briefSource, form.notes || ''),
          }
        : form;
      const outline = await generateOutline(briefingForPipeline);

      setPostId(postId);
      setBriefing(briefingForPipeline);

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

      {/* Loaded brief summary (only when ?briefId=X) */}
      {briefLoading && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
          Carregando brief #{briefIdParam}...
        </div>
      )}
      {briefSource && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-200">
              Brief #{briefSource.id} carregado
            </span>
            <span className="text-[10px] text-emerald-200/60">
              será injetado automaticamente no briefing
            </span>
          </div>
          {briefSource.briefingText ? (
            <details className="text-xs text-emerald-100/80">
              <summary className="cursor-pointer select-none text-emerald-200/80 hover:text-emerald-100">
                Ver briefing expandido
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-emerald-100/70">
                {briefSource.briefingText}
              </pre>
            </details>
          ) : (
            <p className="text-[11px] text-emerald-200/60">
              (Este brief não tem briefing expandido; só rationale + keywords serão usados.)
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Notas {briefSource && <span className="text-xs text-muted-foreground/70">(adendo do editor — opcional)</span>}
        </label>
        <textarea
          rows={3}
          placeholder={
            briefSource
              ? 'Opcional: adendo seu — ex.: "foque no público casual de 15 div/hora", "evite falar de TFT", "priorize screenshots do poe.ninja"... Vai ser somado ao briefing do brief, não substituir.'
              : 'Adendos, ângulo, restrições ou referências que o autor precisa considerar.'
          }
          value={form.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none"
        />
      </div>

      {/* Plan preview — show how the briefing will be interpreted */}
      <PlanPreview
        briefing={form}
        disabled={loading || (!form.skill.trim() && !form.topic?.trim())}
      />

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
