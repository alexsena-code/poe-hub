'use client';

// Expanded detail view rendered below the brief card header when the user
// clicks a brief row. Contains keywords, data-source toggles, rationale,
// briefing text panel, model info, and status-specific action buttons.

import { ContentBrief } from './types';
import {
  URGENCY_COLORS,
  EFFORT_COLORS,
  STATUS_COLORS,
  TEMPLATE_LABELS,
  CANONICAL_DATA_SOURCES,
  IDEAS_API,
} from './constants';
import { BriefingTextPanel } from './briefing-text-panel';

interface BriefExpandedDetailProps {
  brief: ContentBrief;
  generatingContent: number | null;
  msg: string | null;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onToggleDataSource: (id: number, key: string) => Promise<void>;
  onGenerateContent: (id: number) => Promise<void>;
  onExportContent: (id: number, format: 'json' | 'md' | 'md-pt' | 'md-en') => void;
  onDeleteGeneratedPost: (id: number) => Promise<void>;
  onDeleteBrief: (id: number) => void;
  onBriefUpdate: (updated: ContentBrief) => void;
}

export function BriefExpandedDetail({
  brief: b,
  generatingContent,
  msg,
  onUpdateStatus,
  onToggleDataSource,
  onGenerateContent,
  onExportContent,
  onDeleteGeneratedPost,
  onDeleteBrief,
  onBriefUpdate,
}: BriefExpandedDetailProps) {
  const editable = b.status !== 'generated';

  return (
    <div className="border-t border-border p-4 bg-background/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: keywords + data sources */}
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Primary Keyword</div>
            <div className="text-sm text-foreground font-mono">{b.primaryKeyword}</div>
          </div>
          {b.secondaryKeywords.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Secondary Keywords</div>
              <div className="flex flex-wrap gap-1">
                {b.secondaryKeywords.map(kw => (
                  <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground font-mono">{kw}</span>
                ))}
              </div>
            </div>
          )}
          <DataSourcesSection
            brief={b}
            editable={editable}
            onToggle={(key) => onToggleDataSource(b.id, key)}
          />
        </div>

        {/* Right: rationale + briefing + model + actions */}
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Rationale</div>
            <p className="text-xs text-foreground/80 leading-relaxed">{b.rationale}</p>
          </div>

          <BriefingTextPanel brief={b} onUpdate={onBriefUpdate} />

          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Model</div>
            <span className="text-[10px] font-mono text-muted-foreground">{b.model}</span>
          </div>

          <StatusActions
            brief={b}
            generatingContent={generatingContent}
            msg={msg}
            onUpdateStatus={onUpdateStatus}
            onGenerateContent={onGenerateContent}
            onExportContent={onExportContent}
            onDeleteGeneratedPost={onDeleteGeneratedPost}
          />

          {/* Delete — always available */}
          <div className="flex justify-end pt-2 border-t border-border/50 mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteBrief(b.id); }}
              className="px-3 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded text-xs transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DataSourcesSection ───────────────────────────────────────────────────────

interface DataSourcesSectionProps {
  brief: ContentBrief;
  editable: boolean;
  onToggle: (key: string) => void;
}

function DataSourcesSection({ brief: b, editable, onToggle }: DataSourcesSectionProps) {
  // Show canonical keys + any extras the LLM added that we don't know about
  const keys = Array.from(
    new Set([...CANONICAL_DATA_SOURCES, ...Object.keys(b.dataSources || {})]),
  );

  const base = 'text-[10px] px-1.5 py-0.5 rounded transition-colors';
  const activeCls = 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40';
  const inactiveCls = 'bg-zinc-800 text-zinc-500 border border-transparent';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Data Sources</div>
        {editable && (
          <span className="text-[10px] text-muted-foreground/60">clique para alternar</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {keys.map((key) => {
          const active = !!b.dataSources?.[key];
          const label = key.replace(/([A-Z])/g, ' $1').trim();
          if (!editable) {
            return (
              <span key={key} className={`${base} ${active ? activeCls : inactiveCls}`}>
                {label}
              </span>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(key); }}
              className={`${base} ${active ? activeCls : inactiveCls} hover:brightness-125`}
              title={active ? 'Desativar fonte' : 'Ativar fonte'}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── StatusActions ────────────────────────────────────────────────────────────

interface StatusActionsProps {
  brief: ContentBrief;
  generatingContent: number | null;
  msg: string | null;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onGenerateContent: (id: number) => Promise<void>;
  onExportContent: (id: number, format: 'json' | 'md' | 'md-pt' | 'md-en') => void;
  onDeleteGeneratedPost: (id: number) => Promise<void>;
}

function StatusActions({
  brief: b,
  generatingContent,
  msg,
  onUpdateStatus,
  onGenerateContent,
  onExportContent,
  onDeleteGeneratedPost,
}: StatusActionsProps) {
  if (b.status === 'pending') {
    return (
      <div className="flex gap-2 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(b.id, 'accepted'); }}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
        >
          Accept
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(b.id, 'rejected'); }}
          className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors"
        >
          Reject
        </button>
      </div>
    );
  }

  if (b.status === 'accepted') {
    return (
      <div className="flex gap-2 pt-2 flex-wrap">
        <button
          onClick={(e) => { e.stopPropagation(); onGenerateContent(b.id); }}
          disabled={generatingContent === b.id}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-medium transition-colors"
        >
          {generatingContent === b.id
            ? (msg?.startsWith('Generating content...') ? msg : 'Generating...')
            : 'Generate Content'}
        </button>
        <a
          href={`/workspace/new?briefId=${b.id}`}
          onClick={(e) => e.stopPropagation()}
          className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs font-medium transition-colors"
        >
          Open in Co-Writer
        </a>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(b.id, 'pending'); }}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs transition-colors"
        >
          Back to Pending
        </button>
      </div>
    );
  }

  if (b.status === 'rejected') {
    return (
      <div className="flex gap-2 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(b.id, 'accepted'); }}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
        >
          Accept
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(b.id, 'pending'); }}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs transition-colors"
        >
          Back to Pending
        </button>
      </div>
    );
  }

  if (b.status === 'generated') {
    return (
      <div className="space-y-2 pt-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Export</div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={(e) => { e.stopPropagation(); onExportContent(b.id, 'md-pt'); }}
            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs transition-colors"
          >
            PT-BR (.md)
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExportContent(b.id, 'md-en'); }}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs transition-colors"
          >
            EN (.md)
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onExportContent(b.id, 'json'); }}
            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded text-xs transition-colors"
          >
            JSON
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(b.id, 'accepted'); }}
            className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs transition-colors"
          >
            Re-generate
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteGeneratedPost(b.id); }}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-xs transition-colors"
          >
            Delete Post
          </button>
        </div>
        {b.generatedPostSlug && (
          <div className="text-[10px] text-muted-foreground">
            Slug: <span className="font-mono text-foreground/70">{b.generatedPostSlug}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
