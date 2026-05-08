'use client';
/**
 * Editor shell — top-level orchestrator for the blog post editor.
 *
 * Modes:
 *   single    — one Tiptap pane (only mode pre-S21)
 *   bilingual — two Tiptap panes loaded from the post + its translation
 *               sibling. Only ONE pane is visible at a time; a toggle in the
 *               top bar (PT / EN) switches focus. Both panes stay mounted in
 *               the DOM so each can keep its own autosave running. Image
 *               pastes go only into the active pane — broadcast was tried but
 *               the position heuristic ("end of doc") was confusing, so the
 *               operator inserts images per-language as needed.
 *
 * Composes:
 *   EditorProvider  — exposes the *active* pane to children
 *   EditorTitleBar  — title editor for the active pane
 *   EditorToolbar   — formatting + autosave + phase toggle
 *   LanguageToggle  — PT / EN switch (bilingual only)
 *   EditorBody      — two Tiptap views, one hidden via CSS at any moment
 *   PreviewPane     — replaces body when phase === 'preview'
 *   RightRail       — bound to active pane's draftId
 *
 * Sessions 08.e (single) → 21 (bilingual added).
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { ContentScoreReport, SlangReport } from '@/lib/engine-types';
import type { PortableTextContent } from '@/lib/sanity/types';
import { EditorProvider } from './editor-context';
import { EditorTitleBar } from './editor-title-bar';
import { EditorToolbar } from './editor-toolbar';
import { EditorBody } from './editor-body';
import { RightRail } from './right-rail';
import { PreviewPane } from './preview/preview-pane';
import { useEditorPane } from './hooks/use-editor-pane';
import type { EditorPane } from './hooks/use-editor-pane';
import { openImageFilePicker } from './extensions/image-upload';
import { tiptapToPortable } from './serializer/tiptap-to-portable';
import type { TiptapDoc } from './serializer/tiptap-to-portable';
import type { EditorMetaForm } from './editor-meta-schema';
import type { EditorPhase } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditorShellSibling {
  initialMeta?: Partial<EditorMetaForm>;
  initialBody?: PortableTextContent[];
  draftId: string;
  language: 'pt-br' | 'en';
}

export interface EditorShellProps {
  initialMeta?: Partial<EditorMetaForm>;
  initialBody?: PortableTextContent[];
  draftId: string;
  defaultLanguage?: 'pt-br' | 'en';
  contentScore?: ContentScoreReport;
  slangReport?: SlangReport;
  /**
   * When provided, mounts a second Tiptap pane for the sibling-language
   * draft. The two panes alternate via the language toggle; both stay
   * mounted so autosave runs in the background and image pastes are
   * broadcast to both.
   */
  sibling?: EditorShellSibling;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EditorShell({
  initialMeta,
  initialBody,
  draftId,
  defaultLanguage = 'pt-br',
  contentScore,
  slangReport,
  sibling,
}: EditorShellProps) {
  const isBilingual = !!sibling;

  const primary = useEditorPane({
    initialMeta,
    initialBody,
    draftId,
    defaultLanguage,
  });

  const secondary = useEditorPane({
    initialMeta: sibling?.initialMeta,
    initialBody: sibling?.initialBody,
    draftId: sibling?.draftId ?? '',
    defaultLanguage: sibling?.language ?? 'en',
    enabled: isBilingual,
  });

  const [phase, setPhase] = useState<EditorPhase>('draft');
  const [activePane, setActivePane] = useState<'primary' | 'secondary'>('primary');

  const togglePhase = useCallback(() => {
    setPhase((p) => (p === 'draft' ? 'preview' : 'draft'));
  }, []);

  // Wire the slash-command '/image' and toolbar Image button to the *active*
  // pane so the inserted image lands where the operator currently is.
  useEffect(() => {
    const active = activePane === 'primary' ? primary.editor : secondary.editor;
    if (!active) return;
    const handler = openImageFilePicker(active.view);
    window.addEventListener('editor:open-image-picker', handler);
    return () => window.removeEventListener('editor:open-image-picker', handler);
  }, [activePane, primary.editor, secondary.editor]);

  // Toggle `editor-fullscreen` on #app-main so the auth layout drops its
  // padding while the editor is mounted.
  useEffect(() => {
    const main = document.getElementById('app-main');
    main?.classList.add('editor-fullscreen');
    return () => main?.classList.remove('editor-fullscreen');
  }, []);

  // Pick which pane drives the shared shell context (title, toolbar, autosave).
  const active: EditorPane = activePane === 'primary' ? primary : secondary;

  const contextValue = {
    editor: active.editor,
    meta: active.meta,
    setMeta: active.setMeta,
    draftId: active.draftId,
    language: active.language,
    contentScore,
    slangReport,
  };

  const previewBody = useMemo(
    () => tiptapToPortable(active.bodyJson as TiptapDoc),
    [active.bodyJson],
  );

  return (
    <EditorProvider value={contextValue}>
      <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
        <EditorTitleBar />
        <EditorToolbar
          phase={phase}
          onPhaseToggle={togglePhase}
          autosaveStatus={active.autosaveStatus}
          lastSavedAt={active.lastSavedAt}
        />

        {isBilingual && (
          <LanguageToggle
            primaryLanguage={primary.language}
            secondaryLanguage={secondary.language}
            active={activePane}
            primaryStatus={primary.autosaveStatus}
            secondaryStatus={secondary.autosaveStatus}
            onChange={setActivePane}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
            {phase === 'preview' ? (
              <PreviewPane
                title={active.meta.title}
                body={previewBody}
                metadata={active.meta.metadata}
                gameVersion={active.meta.gameVersion}
                locale={active.language}
              />
            ) : (
              <>
                {/* Both Tiptaps stay mounted; the inactive one is hidden via CSS
                    so its editor instance/view persists, autosave keeps running,
                    and the image-paste broadcast still targets both. */}
                <div className={activePane === 'primary' ? 'flex-1' : 'hidden'}>
                  <EditorBody editor={primary.editor} />
                </div>
                {isBilingual && (
                  <div className={activePane === 'secondary' ? 'flex-1' : 'hidden'}>
                    <EditorBody editor={secondary.editor} />
                  </div>
                )}
              </>
            )}
          </main>

          <RightRail draftId={active.draftId} />
        </div>
      </div>
    </EditorProvider>
  );
}

// ─── Language toggle ──────────────────────────────────────────────────────────

interface LanguageToggleProps {
  primaryLanguage: 'pt-br' | 'en';
  secondaryLanguage: 'pt-br' | 'en';
  active: 'primary' | 'secondary';
  primaryStatus: EditorPane['autosaveStatus'];
  secondaryStatus: EditorPane['autosaveStatus'];
  onChange: (pane: 'primary' | 'secondary') => void;
}

function LanguageToggle({
  primaryLanguage,
  secondaryLanguage,
  active,
  primaryStatus,
  secondaryStatus,
  onChange,
}: LanguageToggleProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
      <span className="mr-2 text-xs uppercase tracking-wide text-zinc-500">Idioma:</span>
      <LangButton
        label={languageLabel(primaryLanguage)}
        active={active === 'primary'}
        status={primaryStatus}
        onClick={() => onChange('primary')}
      />
      <LangButton
        label={languageLabel(secondaryLanguage)}
        active={active === 'secondary'}
        status={secondaryStatus}
        onClick={() => onChange('secondary')}
      />
    </div>
  );
}

function LangButton({
  label,
  active,
  status,
  onClick,
}: {
  label: string;
  active: boolean;
  status: EditorPane['autosaveStatus'];
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-7 gap-1.5 text-xs"
      onClick={onClick}
    >
      {label}
      <StatusDot status={status} />
    </Button>
  );
}

function StatusDot({ status }: { status: EditorPane['autosaveStatus'] }) {
  const color =
    status === 'saving'
      ? 'bg-amber-500'
      : status === 'error'
        ? 'bg-destructive'
        : status === 'saved'
          ? 'bg-emerald-500'
          : 'bg-zinc-600';
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />;
}

function languageLabel(lang: 'pt-br' | 'en'): string {
  return lang === 'pt-br' ? 'PT-BR' : 'EN';
}
