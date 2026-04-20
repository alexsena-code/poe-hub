'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePostStore } from '@/lib/engine-store';
import { writeSection, rewriteSelection, fixSection } from '@/lib/content-api';
import IssueBanner from './IssueBanner';

type Lang = 'pt-br' | 'en';

interface FloatingAction {
  x: number;
  y: number;
  text: string;
}

export default function SectionEditor() {
  const {
    sections,
    activeSectionId,
    briefing,
    slug,
    globalComment,
    updateSection,
    addHumanMessage,
    setCritiqueIssues,
    dismissIssue,
    clearIssues,
    setIssuesCollapsed,
    setFixingIssues,
  } = usePostStore();

  const section = sections.find((s) => s.sectionId === activeSectionId);

  const [humanInput, setHumanInput] = useState('');
  const [lang, setLang] = useState<Lang>('pt-br');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [floatingAction, setFloatingAction] = useState<FloatingAction | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ original: string; replacement: string } | null>(null);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const draftRef = useRef<HTMLDivElement>(null);

  // Locked parts from store (persisted per section)
  const lockedParts = section?.lockedParts ?? [];

  // Listen for text selection in the draft panel
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !draftRef.current) {
      setFloatingAction(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 5) {
      setFloatingAction(null);
      return;
    }

    // Check selection is within the draft panel
    const range = sel.getRangeAt(0);
    if (!draftRef.current.contains(range.commonAncestorContainer)) {
      setFloatingAction(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = draftRef.current.getBoundingClientRect();

    setFloatingAction({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      text,
    });
  }, []);

  // Close floating action on click outside or scroll
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.floating-action')) return;
      setTimeout(() => setFloatingAction(null), 150);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!section) return null;

  function getPreviousComments() {
    const currentIndex = sections.findIndex(
      (s) => s.sectionId === section!.sectionId,
    );
    return sections
      .slice(0, currentIndex)
      .filter((s) => s.humanMessages.length > 0)
      .flatMap((s) =>
        s.humanMessages.map((msg) => ({
          sectionTitle: s.title,
          comment: msg,
        })),
      );
  }

  async function handleGenerate(fromScratch = false) {
    if (!briefing || !section) return;
    updateSection(section.sectionId, { status: 'generating' });

    const previousComments = getPreviousComments();

    try {
      // Build context from previously generated sections for coherence
      const previousSections = sections
        .filter((s) => s.sectionId !== section.sectionId && s.draft && (s.draft.en || s.draft['pt-br']))
        .map((s) => ({
          sectionId: s.sectionId,
          title: s.title || s.sectionId,
          content: { 'pt-br': s.draft?.['pt-br'] || '', en: s.draft?.en || '' },
          tokensUsed: s.tokensUsed || 0,
        }));

      const result = await writeSection({
        briefing,
        sectionId: section.sectionId,
        humanInput: humanInput.trim() || undefined,
        previousDraft: fromScratch ? undefined : section.draft?.[lang] || undefined,
        previousComments: previousComments.length > 0 ? previousComments : undefined,
        lockedContent: lockedParts.length > 0 ? lockedParts : undefined,
        fromScratch,
        previousSections: previousSections.length > 0 ? previousSections : undefined,
        slug: slug || undefined,
        globalComment: globalComment?.trim() || undefined,
      });

      if (humanInput.trim()) {
        addHumanMessage(section.sectionId, humanInput.trim());
        setHumanInput('');
      }

      updateSection(section.sectionId, {
        status: 'draft',
        draft: result.content || { 'pt-br': '', en: '' },
        tokensUsed: result.tokensUsed || 0,
      });
      setCritiqueIssues(section.sectionId, result.critiqueIssues || []);
      setIssuesCollapsed(section.sectionId, false);
    } catch {
      updateSection(section.sectionId, { status: 'pending' });
    }
  }

  async function handleFixIssues(issueIds: string[]) {
    if (!briefing || !section || !section.draft || issueIds.length === 0) return;
    const targetIssues = (section.critiqueIssues || []).filter((i) => issueIds.includes(i.id));
    if (targetIssues.length === 0) return;

    setFixingIssues(section.sectionId, issueIds);
    try {
      const result = await fixSection({
        briefing,
        sectionId: section.sectionId,
        currentDraft: section.draft,
        issues: targetIssues,
        lang,
      });
      updateSection(section.sectionId, {
        draft: result.content,
        tokensUsed: (section.tokensUsed || 0) + (result.tokensUsed || 0),
      });
      setCritiqueIssues(section.sectionId, result.critiqueIssues || []);
    } catch {
      // silent — user can retry
    } finally {
      setFixingIssues(section.sectionId, []);
    }
  }

  function handleApprove() {
    if (!section) return;
    updateSection(section.sectionId, { status: 'approved' });
  }

  function handleEdit() {
    if (!section?.draft) return;
    setEditContent(section.draft[lang]);
    setIsEditing(true);
  }

  function handleSaveEdit() {
    if (!section?.draft) return;
    updateSection(section.sectionId, {
      draft: { ...section.draft, [lang]: editContent },
    });
    setIsEditing(false);
  }

  function handleLockSelection() {
    if (!floatingAction || !section) return;
    const alreadyLocked = lockedParts.some((p) => p === floatingAction.text);
    if (!alreadyLocked) {
      updateSection(section.sectionId, {
        lockedParts: [...lockedParts, floatingAction.text],
      });
    }
    setFloatingAction(null);
    window.getSelection()?.removeAllRanges();
  }

  function handleInlineEditStart() {
    if (!floatingAction) return;
    setInlineEdit({ original: floatingAction.text, replacement: floatingAction.text });
    setFloatingAction(null);
    window.getSelection()?.removeAllRanges();
  }

  function handleInlineEditSave() {
    if (!inlineEdit || !section?.draft) return;
    const updated = section.draft[lang].replace(inlineEdit.original, inlineEdit.replacement);
    updateSection(section.sectionId, {
      draft: { ...section.draft, [lang]: updated },
    });
    setInlineEdit(null);
  }

  async function handleRegenSelection() {
    if (!floatingAction || !section?.draft || !briefing) return;
    if (!showRegenInput) {
      setShowRegenInput(true);
      return;
    }
    setRegenLoading(true);
    const selectedText = floatingAction.text;
    try {
      const result = await rewriteSelection({
        briefing,
        sectionId: section.sectionId,
        fullDraft: section.draft[lang],
        selectedText,
        instruction: regenInstruction.trim() || undefined,
      });
      if (result.content?.[lang]) {
        updateSection(section.sectionId, {
          draft: { ...section.draft, [lang]: result.content[lang] },
          tokensUsed: (section.tokensUsed || 0) + (result.tokensUsed || 0),
        });
      }
    } catch {
      // silent
    } finally {
      setRegenLoading(false);
      setShowRegenInput(false);
      setRegenInstruction('');
      setFloatingAction(null);
      window.getSelection()?.removeAllRanges();
    }
  }

  function handleUnlock(index: number) {
    if (!section) return;
    updateSection(section.sectionId, {
      lockedParts: lockedParts.filter((_, i) => i !== index),
    });
  }

  const hasDraft = section.draft !== null;
  const draftText = section.draft?.[lang] || '';

  const needsHumanInput =
    section.requiresHumanInput && (section.humanMessages?.length ?? 0) === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Human-input banner: rendered above the section so the author sees
          the template's guidance the moment they open the section. Hides
          as soon as they submit an opinion (tracked by humanMessages). */}
      {needsHumanInput && (
        <div className="mx-8 mt-4 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-200">
                Esta seção precisa da sua opinião
              </div>
              {section.humanInputGuidance ? (
                <p className="mt-1 text-xs text-amber-100/80 whitespace-pre-wrap leading-relaxed">
                  {section.humanInputGuidance}
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-100/70">
                  Use a caixa "Adicione sua opinião ou instruções..." abaixo antes de aprovar.
                  Sem isso, o gerador retorna um placeholder vazio.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section header: title + language toggle */}
      <div className="flex items-center gap-3 px-8 py-4 border-b border-border bg-surface shrink-0">
        <h3 className="text-base font-semibold text-foreground mr-auto">
          {section.title}
        </h3>

        {section.tokensUsed > 0 && (
          <span className="text-xs text-muted-foreground">
            {section.tokensUsed} tokens
          </span>
        )}

        {lockedParts.length > 0 && (
          <span className="text-xs text-amber-400">
            {lockedParts.length} travado(s)
          </span>
        )}

        <div className="flex rounded-lg border border-border overflow-hidden ml-2">
          <button
            onClick={() => setLang('pt-br')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              lang === 'pt-br'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            }`}
          >
            PT-BR
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border ${
              lang === 'en'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Draft content area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 relative" ref={draftRef} onMouseUp={handleMouseUp}>
        {/* Floating action tooltip */}
        {floatingAction && (
          <div
            className="floating-action absolute z-50 -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1"
            style={{ left: floatingAction.x, top: floatingAction.y }}
          >
            {showRegenInput && (
              <div className="flex gap-1 mb-1">
                <input
                  type="text"
                  value={regenInstruction}
                  onChange={(e) => setRegenInstruction(e.target.value)}
                  placeholder="Instrucao (opcional)..."
                  className="px-2 py-1 rounded text-xs bg-background border border-border text-foreground w-48 focus:outline-none focus:ring-1 focus:ring-foreground/50"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRegenSelection(); }}
                />
              </div>
            )}
            <div className="flex gap-1 rounded-lg bg-surface border border-border p-1 shadow-xl">
              <button
                onClick={handleRegenSelection}
                disabled={regenLoading}
                className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
              >
                {regenLoading ? '...' : 'Regerar'}
              </button>
              <button
                onClick={handleInlineEditStart}
                className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={handleLockSelection}
                className="px-3 py-1.5 rounded-md bg-amber-500 text-black text-xs font-medium hover:bg-amber-400 transition-colors"
              >
                Travar
              </button>
            </div>
          </div>
        )}

        {/* Inline edit overlay */}
        {inlineEdit && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setInlineEdit(null)}>
            <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-semibold text-foreground mb-2">Editar trecho selecionado</h4>
              <p className="text-xs text-muted-foreground mb-3">Original: &quot;{inlineEdit.original.slice(0, 100)}...&quot;</p>
              <textarea
                value={inlineEdit.replacement}
                onChange={(e) => setInlineEdit({ ...inlineEdit, replacement: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-3 text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-y min-h-[120px]"
                rows={6}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => setInlineEdit(null)}
                  className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInlineEditSave}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending state */}
        {section.status === 'pending' && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Clique em &quot;Gerar Rascunho&quot; para criar o rascunho desta secao.
          </div>
        )}

        {/* Generating state */}
        {section.status === 'generating' && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-foreground/60" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-muted-foreground">Gerando rascunho...</span>
            </div>
          </div>
        )}

        {/* Critique issues banner */}
        {(section.status === 'draft' ||
          section.status === 'reviewing' ||
          section.status === 'approved') &&
          hasDraft &&
          !isEditing &&
          (section.critiqueIssues?.length ?? 0) > 0 && (
            <IssueBanner
              issues={section.critiqueIssues || []}
              dismissedIds={section.dismissedIssueIds || []}
              collapsed={section.issuesCollapsed || false}
              fixingIds={section.fixingIssueIds || []}
              onDismiss={(id) => dismissIssue(section.sectionId, id)}
              onFix={(ids) => handleFixIssues(ids)}
              onToggleCollapse={(c) => setIssuesCollapsed(section.sectionId, c)}
              onClearAll={() => clearIssues(section.sectionId)}
            />
          )}

        {/* Draft/reviewing/approved state */}
        {(section.status === 'draft' ||
          section.status === 'reviewing' ||
          section.status === 'approved') &&
          hasDraft &&
          (isEditing ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg border border-border bg-background p-4 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-y min-h-[300px]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="markdown-body select-text max-w-none text-foreground/90 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {draftText}
              </ReactMarkdown>
            </div>
          ))}

        {/* Locked parts display */}
        {lockedParts.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Trechos travados
            </span>
            <div className="flex flex-col gap-1.5 mt-2">
              {lockedParts.map((part, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-amber-400/5 border border-amber-400/20 px-3 py-1.5"
                >
                  <span className="text-xs text-foreground/80 flex-1 truncate">{part}</span>
                  <button
                    onClick={() => handleUnlock(i)}
                    className="text-xs text-red-400 hover:text-red-300 shrink-0 px-1"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasDraft && !isEditing && (
          <p className="text-xs text-muted-foreground mt-4">
            Selecione texto acima para regerar, editar ou travar trechos.
          </p>
        )}
      </div>

      {/* Bottom panel: human opinion + action buttons */}
      <div className="border-t border-border bg-surface shrink-0">
        {/* Human input section */}
        <div className="px-8 py-4">
          {section.requiresHumanInput && section.status === 'pending' && (
            <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 px-4 py-2.5 text-amber-300 text-sm mb-3">
              Sua opiniao e recomendada para esta secao.
            </div>
          )}

          {section.humanMessages.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Mensagens anteriores
              </span>
              {section.humanMessages.map((msg, i) => (
                <div key={i} className="rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground/80">
                  {msg}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <textarea
              rows={2}
              placeholder="Adicione sua opiniao ou instrucoes..."
              value={humanInput}
              onChange={(e) => setHumanInput(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none"
            />

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {section.status === 'pending' && (
                <button
                  onClick={() => handleGenerate(false)}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors whitespace-nowrap"
                >
                  Gerar Rascunho
                </button>
              )}

              {(section.status === 'draft' || section.status === 'reviewing') && (
                <>
                  <button
                    onClick={() => handleGenerate(false)}
                    className="px-3 py-2 rounded-lg border border-foreground/30 text-foreground text-sm font-medium hover:bg-foreground/10 transition-colors whitespace-nowrap"
                  >
                    Reescrever
                  </button>
                  <button
                    onClick={() => handleGenerate(true)}
                    className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors whitespace-nowrap"
                  >
                    Do Zero
                  </button>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors whitespace-nowrap"
                  >
                    Aprovar
                  </button>
                </>
              )}

              {section.status === 'approved' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400 font-medium whitespace-nowrap">Seção aprovada</span>
                  <button
                    type="button"
                    onClick={() => updateSection(section.sectionId, { status: 'draft' })}
                    className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                    title="Voltar para rascunho para editar/regerar"
                  >
                    Desaprovar
                  </button>
                </div>
              )}

              {section.status === 'generating' && (
                <span className="text-sm text-muted-foreground animate-pulse whitespace-nowrap">Gerando...</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
