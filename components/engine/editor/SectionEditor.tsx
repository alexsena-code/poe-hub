'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePostStore } from '@/lib/engine-store';
import { writeSection, rewriteSelection } from '@/lib/content-api';

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
    updateSection,
    addHumanMessage,
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
      // Small delay to allow button click to register
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
      const result = await writeSection({
        briefing,
        sectionId: section.sectionId,
        humanInput: humanInput.trim() || undefined,
        previousDraft: fromScratch ? undefined : section.draft?.[lang] || undefined,
        previousComments: previousComments.length > 0 ? previousComments : undefined,
        lockedContent: lockedParts.length > 0 ? lockedParts : undefined,
        fromScratch,
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
    } catch {
      updateSection(section.sectionId, { status: 'pending' });
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

  // Highlight locked parts in the draft text
  function renderDraftWithLocks(text: string) {
    if (lockedParts.length === 0) return text;

    let result = text;
    // Wrap locked parts in a special marker for visual highlighting
    // We use a zero-width approach: render markdown normally, highlight via CSS
    // Actually, we'll render the markdown and use a post-process approach
    return result;
  }

  const hasDraft = section.draft !== null;
  const draftText = section.draft?.[lang] || '';

  return (
    <div className="section-editor-split h-full">
      {/* Left panel: AI Draft */}
      <div className="flex flex-col border-r border-border min-h-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-foreground mr-auto">
            {section.title}
          </h3>
          <button
            onClick={() => setLang('pt-br')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              lang === 'pt-br'
                ? 'bg-accent text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            PT-BR
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              lang === 'en'
                ? 'bg-accent text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            EN
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6 relative" ref={draftRef} onMouseUp={handleMouseUp}>
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
                    className="px-2 py-1 rounded text-xs bg-background border border-border text-foreground w-48 focus:outline-none focus:ring-1 focus:ring-accent"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRegenSelection(); }}
                  />
                </div>
              )}
              <div className="flex gap-1">
                <button
                  onClick={handleRegenSelection}
                  disabled={regenLoading}
                  className="px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-bold shadow-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {regenLoading ? '...' : 'Regerar'}
                </button>
                <button
                  onClick={handleInlineEditStart}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-lg hover:bg-blue-500 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={handleLockSelection}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold shadow-lg hover:bg-amber-400 transition-colors"
                >
                  Travar
                </button>
              </div>
            </div>
          )}

          {/* Inline edit overlay */}
          {inlineEdit && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setInlineEdit(null)}>
              <div className="bg-surface border border-border rounded-lg p-4 max-w-2xl w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-sm font-semibold text-foreground mb-2">Editar trecho selecionado</h4>
                <p className="text-xs text-muted-foreground mb-3">Original: &quot;{inlineEdit.original.slice(0, 100)}...&quot;</p>
                <textarea
                  value={inlineEdit.replacement}
                  onChange={(e) => setInlineEdit({ ...inlineEdit, replacement: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background p-3 text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[120px]"
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
                    className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          {section.status === 'pending' && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Clique em &quot;Gerar Rascunho&quot; para criar o rascunho desta secao.
            </div>
          )}

          {section.status === 'generating' && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-muted-foreground">Gerando rascunho...</span>
              </div>
            </div>
          )}

          {(section.status === 'draft' ||
            section.status === 'reviewing' ||
            section.status === 'approved') &&
            hasDraft &&
            (isEditing ? (
              <div className="flex flex-col h-full gap-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 w-full rounded-lg border border-border bg-background p-4 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors"
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
              <div className="markdown-body select-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {draftText}
                </ReactMarkdown>
              </div>
            ))}
        </div>

        {/* Footer: tokens + locked parts */}
        <div className="px-6 py-2 border-t border-border shrink-0">
          <div className="flex items-center gap-4">
            {section.tokensUsed > 0 && (
              <span className="text-xs text-muted-foreground">Tokens: {section.tokensUsed}</span>
            )}
            {lockedParts.length > 0 && (
              <span className="text-xs text-amber-400">
                {lockedParts.length} trecho(s) travado(s)
              </span>
            )}
            {hasDraft && !isEditing && (
              <span className="text-xs text-muted-foreground ml-auto">
                Selecione texto para travar
              </span>
            )}
          </div>

          {/* Locked parts list */}
          {lockedParts.length > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              {lockedParts.map((part, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded bg-amber-400/10 border border-amber-400/20 px-2 py-1"
                >
                  <span className="text-xs text-foreground flex-1 truncate">{part}</span>
                  <button
                    onClick={() => handleUnlock(i)}
                    className="text-xs text-red-400 hover:text-red-300 shrink-0"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Human Input */}
      <div className="flex flex-col min-h-0">
        <div className="px-6 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-foreground">Sua Opiniao</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {section.requiresHumanInput && section.status === 'pending' && (
            <div className="rounded-lg bg-accent/10 border border-accent/30 px-4 py-3 text-accent text-sm">
              Sua opiniao e recomendada para esta secao.
            </div>
          )}

          {section.humanMessages.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Mensagens anteriores
              </span>
              {section.humanMessages.map((msg, i) => (
                <div key={i} className="rounded-lg bg-surface border border-border px-3 py-2 text-sm text-foreground">
                  {msg}
                </div>
              ))}
            </div>
          )}

          <textarea
            rows={3}
            placeholder="Adicione sua opiniao ou instrucoes..."
            value={humanInput}
            onChange={(e) => setHumanInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-t border-border shrink-0">
          {section.status === 'pending' && (
            <button
              onClick={() => handleGenerate(false)}
              className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Gerar Rascunho
            </button>
          )}

          {(section.status === 'draft' || section.status === 'reviewing') && (
            <>
              <button
                onClick={() => handleGenerate(false)}
                className="px-4 py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 transition-colors"
              >
                Reescrever
              </button>
              <button
                onClick={() => handleGenerate(true)}
                className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
              >
                Do Zero
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
              >
                Editar
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors"
              >
                Aprovar
              </button>
            </>
          )}

          {section.status === 'approved' && (
            <span className="text-sm text-green-400 font-medium">Secao aprovada</span>
          )}

          {section.status === 'generating' && (
            <span className="text-sm text-muted-foreground animate-pulse-accent">Gerando...</span>
          )}
        </div>
      </div>
    </div>
  );
}
