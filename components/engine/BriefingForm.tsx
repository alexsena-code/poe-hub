'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { nanoid } from 'nanoid';
import { generateOutline, proposeOutline, fetchSkimCollections } from '@/lib/content-api';
import { usePostStore } from '@/lib/engine-store';
import type { Briefing, CustomSection, ProposedOutline } from '@/lib/engine-types';
import PlanPreview from './PlanPreview';
import OutlineEditor from './OutlineEditor';
import SkimCollectionsSelector from './SkimCollectionsSelector';

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
  // Sections loaded from the currently-selected template so the user can
  // opt out of any section before generation. Keyed by section id →
  // boolean (true = keep). We only ever add to this map, never clobber,
  // so user choices persist across template edits.
  const [templateSections, setTemplateSections] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [keptSections, setKeptSections] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Briefing>({
    skill: searchParams.get('topic') || '',
    ascendancy: '',
    topic: searchParams.get('topic') || '',
    league: '3.28',
    notes: searchParams.get('notes') || '',
    mode: 'outline_only',
    templateName: searchParams.get('template') || 'mechanic_guide',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Collections do Qdrant a consultar no skim do outline proposer.
  // Pré-populamos com os defaults do template; o SkimCollectionsSelector
  // deixa o autor ampliar ou reduzir. Vazio = usa o default do template
  // no backend. Um valor diferente do default viaja como
  // briefing.skimCollections ao gerar o outline.
  const [skimCollections, setSkimCollections] = useState<string[]>([]);
  const [skimDefaultsByTemplate, setSkimDefaultsByTemplate] = useState<
    Record<string, string[]>
  >({});
  // Step state: 'briefing' = form atual, 'outline' = OutlineEditor com proposta.
  // Ao clicar "Gerar Outline", chamamos proposeOutline() e movemos para 'outline'.
  const [step, setStep] = useState<'briefing' | 'outline'>('briefing');
  const [outlineProposal, setOutlineProposal] = useState<ProposedOutline | null>(null);
  const [pipelineBriefing, setPipelineBriefing] = useState<Briefing | null>(null);

  const isTopicMode = TOPIC_TEMPLATES.includes(form.templateName || '');

  useEffect(() => {
    fetch(`${API_URL}/content/templates`)
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .catch(() => {});
  }, []);

  // Fetch o catálogo de skim collections uma vez (é pequeno e mudam raro).
  // Também reseta a seleção pro default do template assim que o mapa
  // chega.
  useEffect(() => {
    let cancelled = false;
    fetchSkimCollections()
      .then((data) => {
        if (cancelled) return;
        setSkimDefaultsByTemplate(data.defaultsByTemplate);
        const name = form.templateName;
        if (name && data.defaultsByTemplate[name]) {
          setSkimCollections(data.defaultsByTemplate[name]);
        }
      })
      .catch(() => {
        // Backend offline / sem endpoint? Mantemos vazio e o backend
        // cai no default por template (no-op prática pro autor).
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reseta skimCollections ao default quando templateName muda — exceto
  // se o autor já customizou neste render pro mesmo template (sem jeito
  // trivial de detectar; keep simple, reset sempre).
  useEffect(() => {
    const name = form.templateName;
    if (!name) return;
    const defaults = skimDefaultsByTemplate[name];
    if (defaults && defaults.length > 0) {
      setSkimCollections(defaults);
    }
  }, [form.templateName, skimDefaultsByTemplate]);

  // Load the selected template's sections so the user can choose which
  // ones to skip. Re-runs whenever templateName changes. New sections
  // default to kept=true; sections the user already opted out of stay
  // opted out if they appear in a different template with the same id.
  useEffect(() => {
    const name = form.templateName;
    if (!name) return;
    let cancelled = false;
    fetch(`${API_URL}/content/templates/${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const raw = Array.isArray(data?.sections) ? data.sections : [];
        const normalized = raw
          .map((s: any) => ({
            id: String(s.id || s.sectionId || ''),
            title: String(s.title || s.id || ''),
          }))
          .filter((s: { id: string }) => s.id);
        setTemplateSections(normalized);
        setKeptSections((prev) => {
          const next = { ...prev };
          for (const s of normalized) {
            if (!(s.id in next)) next[s.id] = true;
          }
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setTemplateSections([]);
      });
    return () => { cancelled = true; };
  }, [form.templateName]);

  const toggleSection = (id: string) => {
    setKeptSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const excludedSectionIds = templateSections
    .filter((s) => !keptSections[s.id])
    .map((s) => s.id);

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
      // Build the final Briefing: stitch the hydrated brief (structured
      // context from ideation) together with the user's free-form addenda
      // from the Notas textarea. The brief block goes first so the LLM
      // treats the user's notes as higher-priority guidance.
      // Só enviamos skimCollections quando o autor desviou do default do
      // template — backend trata "ausente/vazio" como "use default".
      const templateDefaults = skimDefaultsByTemplate[form.templateName || ''] || [];
      const skimDiffersFromDefault =
        skimCollections.length !== templateDefaults.length ||
        !skimCollections.every((k) => templateDefaults.includes(k));
      const skimOverride = skimDiffersFromDefault ? skimCollections : undefined;

      const briefingForPipeline: Briefing = briefSource
        ? {
            ...form,
            notes: buildStitchedNotes(briefSource, form.notes || ''),
            excludedSections: excludedSectionIds.length > 0 ? excludedSectionIds : undefined,
            skimCollections: skimOverride,
          }
        : {
            ...form,
            excludedSections: excludedSectionIds.length > 0 ? excludedSectionIds : undefined,
            skimCollections: skimOverride,
          };

      // Step 1: pede ao engine para propor o outline. Quando a feature flag
      // backend está off, o engine retorna o template skeleton como
      // fallback — a UI de edição abre normalmente para rename/reorder/add.
      const proposal = await proposeOutline(briefingForPipeline);

      setPipelineBriefing(briefingForPipeline);
      setOutlineProposal(proposal);
      setStep('outline');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao propor outline.',
      );
    } finally {
      setLoading(false);
    }
  }

  // Disparado pelo OutlineEditor. Pega o outline final (já editado pelo
  // usuário) e chama o pipeline legacy de research-only (`/content/outline`)
  // com customOutline. Mantém a mesma sequência que o fluxo antigo:
  // grava o post no store e navega para /editor/{postId}.
  async function handleGenerate(sections: CustomSection[]) {
    if (!pipelineBriefing) return;
    setLoading(true);
    setError(null);

    try {
      const postId = nanoid(10);
      const finalBriefing: Briefing = {
        ...pipelineBriefing,
        customOutline: sections,
      };
      const outline = await generateOutline(finalBriefing);

      setPostId(postId);
      setBriefing(finalBriefing);

      const uiSections = (
        outline.sections as Array<{
          id?: string;
          sectionId?: string;
          title: string;
          requiresHumanInput?: boolean;
          requires_human_input?: boolean;
          pendingHumanInput?: boolean;
          humanInputGuidance?: string;
        }>
      ).map((s) => ({
        sectionId: s.sectionId || s.id || nanoid(6),
        title: s.title,
        requiresHumanInput:
          s.requiresHumanInput ??
          s.requires_human_input ??
          s.pendingHumanInput ??
          false,
        humanInputGuidance: s.humanInputGuidance,
      }));

      initSections(uiSections);
      setPhase('writing');
      router.push(`/editor/${postId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar o post.');
    } finally {
      setLoading(false);
    }
  }

  function handleCancelOutline() {
    setStep('briefing');
    setOutlineProposal(null);
    setError(null);
  }

  async function handleResetOutline() {
    if (!pipelineBriefing) return;
    setLoading(true);
    setError(null);
    try {
      // Re-fetch o template puro via proposeOutline — o engine retorna
      // fallback ao skeleton quando qualquer problema acontece, e também
      // é isso que queremos ao "resetar": outline sem edições.
      const proposal = await proposeOutline({
        ...pipelineBriefing,
        // Força fallback mesmo com flag ligada enviando um hint:
        // o proposer ainda vai rodar, mas a UI descarta alterações do user.
      });
      setOutlineProposal(proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resetar outline.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'outline' && outlineProposal) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}
        <OutlineEditor
          proposal={outlineProposal}
          onConfirm={handleGenerate}
          onCancel={handleCancelOutline}
          onReset={handleResetOutline}
          submitting={loading}
          submitLabel="Gerar post"
        />
      </div>
    );
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

      {/* Section selector — opt out of template sections for this post.
          All sections start enabled; unchecking flows through to
          Briefing.excludedSections and the research node filters them
          out before write. */}
      {templateSections.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">
              Seções do template
            </label>
            <span className="text-[10px] text-muted-foreground/70">
              {excludedSectionIds.length === 0
                ? `${templateSections.length} seções — todas ativas`
                : `${templateSections.length - excludedSectionIds.length}/${templateSections.length} ativas`}
            </span>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3 space-y-1.5">
            {templateSections.map((s) => {
              const kept = !!keptSections[s.id];
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    kept ? 'hover:bg-background/50' : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={kept}
                    onChange={() => toggleSection(s.id)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <span className="text-[11px] font-mono text-muted-foreground/70 w-32 truncate">
                    {s.id}
                  </span>
                  <span className={`text-sm ${kept ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                    {s.title}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Skim collections — quais fontes do Qdrant alimentam o outline proposer */}
      <SkimCollectionsSelector
        templateName={form.templateName}
        selected={skimCollections}
        onChange={setSkimCollections}
        onResetToDefault={() => {
          const defaults = skimDefaultsByTemplate[form.templateName || ''];
          if (defaults) setSkimCollections(defaults);
        }}
      />

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
        className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-lg bg-accent px-8 text-sm font-semibold text-background shadow-lg shadow-accent/20 ring-1 ring-accent/40 transition-all hover:bg-accent-hover hover:shadow-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Gerando outline…</span>
          </>
        ) : (
          <>
            <span>Gerar outline</span>
            <span aria-hidden>→</span>
          </>
        )}
      </button>
    </form>
  );
}
