'use client';
/**
 * Editor shell — top-level orchestrator for the blog post editor.
 *
 * Composes:
 *   EditorProvider  — shared context (editor, meta, draftId, language)
 *   EditorToolbar   — formatting actions + "Prosseguir →" button
 *   EditorBody      — Tiptap contenteditable + bubble/floating menus
 *   RightRail       — Q&A, Score, Slang Report, Assets, Slang Lookup
 *   PreviewPane     — replaces body when phase === 'preview'
 *
 * S10.b: EditorSidebar removed — meta form migrated to /publish route.
 * Toolbar now only carries formatting + autosave + phase toggle + proceed button.
 * Publish dialog also removed — publish happens in the /publish page.
 *
 * Autosave: useAutosave({ draftId, meta, bodyJson, language }) debounced 5s.
 *
 * Session 08.e → updated S10.b.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
// useCallback retained: setMeta is memoized to avoid re-renders on every keystroke.
import type { JSONContent } from '@tiptap/core';
import type { ContentScoreReport, SlangReport } from '@/lib/engine-types';
import type { PortableTextContent } from '@/lib/sanity/types';
import { EditorProvider } from './editor-context';
import { EditorToolbar } from './editor-toolbar';
import { EditorBody } from './editor-body';
import { RightRail } from './right-rail';
import { PreviewPane } from './preview/preview-pane';
import { useTiptapEditor } from './hooks/use-tiptap-editor';
import { useAutosave } from './hooks/use-autosave';
import { tiptapToPortable } from './serializer/tiptap-to-portable';
import type { TiptapDoc } from './serializer/tiptap-to-portable';
import { portableToTiptap } from './serializer/portable-to-tiptap';
import type { EditorMetaForm } from './editor-meta-schema';
import { editorMetaDefaults } from './editor-meta-schema';
import type { EditorPhase } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditorShellProps {
  /**
   * Pre-loaded meta values from /api/sanity/draft/[id] GET response.
   * Undefined for a new (blank) post.
   *
   * S10.b: changed from `initialPost: SanityPost` (raw Sanity shape) to
   * `initialMeta: Partial<EditorMetaForm>` so the edit page no longer needs
   * to reconstruct a SanityPost from the editor-native API response.
   */
  initialMeta?: Partial<EditorMetaForm>;
  /**
   * Pre-loaded body from the API in Portable Text shape (canonical Sanity
   * format). Converted to Tiptap JSON on mount via portableToTiptap().
   *
   * Why Portable Text and not Tiptap JSON: autosave converts Tiptap →
   * Portable Text before PUT (use-autosave#buildDraftPayload), and the
   * Sanity dataset stores Portable Text so the poetrade-dev frontend can
   * render via @portabletext/react. Body coming back from GET is therefore
   * always Portable Text, including drafts seeded by /api/sanity/draft-from-guide.
   */
  initialBody?: PortableTextContent[];
  /** Draft document ID — used for autosave. */
  draftId: string;
  /** Starting language — overridden by initialMeta.language when editing. */
  defaultLanguage?: 'pt-br' | 'en';
  /**
   * Content Score from engine Fase C — exposed via EditorContext to right rail.
   */
  contentScore?: ContentScoreReport;
  /**
   * Slang Report from engine Fase C — exposed via EditorContext to right rail.
   */
  slangReport?: SlangReport;
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Full-page blog post editor. Mount once per route — /workspace/blog/new
 * and /workspace/blog/[id]/edit both render this component with different props.
 */
export function EditorShell({
  initialMeta,
  initialBody,
  draftId,
  defaultLanguage = 'pt-br',
  contentScore,
  slangReport,
}: EditorShellProps) {
  // ── State ────────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<EditorPhase>('draft');
  const [meta, setMetaState] = useState<EditorMetaForm>({
    ...editorMetaDefaults,
    language: defaultLanguage,
    ...initialMeta,
  });
  const [bodyJson, setBodyJson] = useState<JSONContent>({ type: 'doc', content: [] });

  // Track whether the initial content has been loaded into the editor.
  const initialContentLoaded = useRef(false);

  // ── Patch meta (partial update — kept for context consumers like RightRail) ──
  const setMeta = useCallback((patch: Partial<EditorMetaForm>) => {
    setMetaState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Tiptap editor ────────────────────────────────────────────────────────────
  const editor = useTiptapEditor({
    onUpdate: (json) => setBodyJson(json),
  });

  // ── Load initial body into Tiptap ────────────────────────────────────────────
  useEffect(() => {
    if (!editor || !initialBody || initialContentLoaded.current) return;
    const tiptapDoc = portableToTiptap(initialBody);
    editor.commands.setContent(tiptapDoc as JSONContent);
    setBodyJson(editor.getJSON());
    initialContentLoaded.current = true;
  }, [editor, initialBody]);

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const { status: autosaveStatus, lastSavedAt } = useAutosave({
    draftId,
    meta,
    bodyJson,
    language: meta.language,
  });

  // ── Phase toggle ─────────────────────────────────────────────────────────────
  const togglePhase = useCallback(() => {
    setPhase((p) => (p === 'draft' ? 'preview' : 'draft'));
  }, []);

  // ── Context value ────────────────────────────────────────────────────────────
  const contextValue = {
    editor,
    meta,
    setMeta,
    draftId,
    language: meta.language,
    contentScore,
    slangReport,
  };

  // ── Preview data ─────────────────────────────────────────────────────────────
  const previewBody = tiptapToPortable(bodyJson as TiptapDoc);

  return (
    <EditorProvider value={contextValue}>
      <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
        {/* Toolbar spans full width at the top */}
        <EditorToolbar
          phase={phase}
          onPhaseToggle={togglePhase}
          autosaveStatus={autosaveStatus}
          lastSavedAt={lastSavedAt}
        />

        {/* 2-column layout: editor body | right rail */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main content area: editor body or preview */}
          <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
            {phase === 'preview' ? (
              <PreviewPane
                title={meta.title}
                body={previewBody}
                metadata={meta.metadata}
                gameVersion={meta.gameVersion}
                locale={meta.language}
              />
            ) : (
              <EditorBody editor={editor} />
            )}
          </main>

          {/* Right rail — Q&A, Score, Slang Report, Assets, Slang Lookup */}
          <RightRail draftId={draftId} />
        </div>
      </div>
    </EditorProvider>
  );
}

