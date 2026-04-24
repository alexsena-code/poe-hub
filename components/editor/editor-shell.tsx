'use client';
/**
 * Editor shell — top-level orchestrator for the blog post editor.
 *
 * Composes:
 *   EditorProvider  — shared context (editor, meta, draftId, language)
 *   EditorToolbar   — title, formatting actions, publish button
 *   EditorBody      — Tiptap contenteditable + bubble/floating menus
 *   EditorSidebar   — meta form (category, author, tags, image, SEO)
 *   PreviewPane     — replaces body when phase === 'preview'
 *
 * Slots for future waves:
 *   slotSidePanels  — S08.h mounts Q&A + Assets panels here
 *
 * Autosave: useAutosave({ draftId, meta, bodyJson, language }) runs in
 * background on every edit; debounced 5s.
 *
 * Publish: confirm dialog → usePublish() → /api/sanity/publish → navigate.
 *
 * Load existing: useEffect converts initialPost.body (Portable Text) to
 * Tiptap JSON via portableToTiptap() on mount.
 *
 * Session 08.e.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { JSONContent } from '@tiptap/core';
import type { SanityPost } from '@/lib/sanity/types';
import { EditorProvider } from './editor-context';
import { EditorToolbar } from './editor-toolbar';
import { EditorBody } from './editor-body';
import { EditorSidebar } from './editor-sidebar';
import { PreviewPane } from './preview/preview-pane';
import { useTiptapEditor } from './hooks/use-tiptap-editor';
import { useAutosave } from './hooks/use-autosave';
import { usePublish } from './hooks/use-publish';
import { tiptapToPortable } from './serializer/tiptap-to-portable';
import { portableToTiptap } from './serializer/portable-to-tiptap';
import type { TiptapDoc } from './serializer/tiptap-to-portable';
import type { EditorMetaForm } from './editor-meta-schema';
import { editorMetaDefaults } from './editor-meta-schema';
import type { EditorPhase } from './types';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditorShellProps {
  /** Existing Sanity post to edit — undefined for new post. */
  initialPost?: SanityPost;
  /** Draft document ID — used for autosave and draft deletion after publish. */
  draftId: string;
  /** Starting language — overridden by initialPost.language when editing. */
  defaultLanguage?: 'pt-br' | 'en';
  /**
   * Slot for S08.h: Q&A panel, Assets panel mounted by the page-level shell.
   * Rendered beside the sidebar when provided.
   */
  slotSidePanels?: React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialMeta(post?: SanityPost): Partial<EditorMetaForm> {
  if (!post) return {};
  return {
    title: post.title,
    metadata: post.metadata,
    slug: post.slug.current,
    gameVersion: post.gameVersion,
    categoryId: post.category._ref,
    authorId: post.author._ref,
    tags: post.tags,
    mainImageAssetId: post.mainImage?.asset._ref,
    publishedAt: post.publishedAt,
    language: post.language,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Full-page blog post editor. Mount once per route — /workspace/blog/new
 * and /workspace/blog/[id]/edit both render this component with different props.
 */
export function EditorShell({
  initialPost,
  draftId,
  defaultLanguage = 'pt-br',
  slotSidePanels,
}: EditorShellProps) {
  // ── State ────────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<EditorPhase>('draft');
  const [meta, setMetaState] = useState<EditorMetaForm>({
    ...editorMetaDefaults,
    language: initialPost?.language ?? defaultLanguage,
    ...buildInitialMeta(initialPost),
  });
  const [bodyJson, setBodyJson] = useState<JSONContent>({ type: 'doc', content: [] });
  const [isFormValid, setIsFormValid] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Track whether the initial content has been loaded into the editor.
  const initialContentLoaded = useRef(false);

  // ── Patch meta (partial update from toolbar language pill or sidebar) ────────
  const setMeta = useCallback((patch: Partial<EditorMetaForm>) => {
    setMetaState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Tiptap editor ────────────────────────────────────────────────────────────
  const editor = useTiptapEditor({
    onUpdate: (json) => setBodyJson(json),
  });

  // ── Load initial post body into Tiptap ───────────────────────────────────────
  useEffect(() => {
    if (!editor || !initialPost?.body || initialContentLoaded.current) return;
    const tiptapDoc = portableToTiptap(initialPost.body);
    editor.commands.setContent(tiptapDoc);
    // Capture the initial JSON state so autosave has a baseline.
    setBodyJson(editor.getJSON());
    initialContentLoaded.current = true;
  }, [editor, initialPost]);

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const { status: autosaveStatus, lastSavedAt } = useAutosave({
    draftId,
    meta,
    bodyJson,
    language: meta.language,
  });

  // ── Publish ──────────────────────────────────────────────────────────────────
  const { publish, publishing } = usePublish();

  const handlePublishConfirm = useCallback(async () => {
    setPublishDialogOpen(false);
    const body = tiptapToPortable(bodyJson as TiptapDoc);
    await publish({ meta, body, draftId });
  }, [meta, bodyJson, draftId, publish]);

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
          onPublish={() => setPublishDialogOpen(true)}
          isFormValid={isFormValid}
          formErrors={formErrors}
          autosaveStatus={autosaveStatus}
          lastSavedAt={lastSavedAt}
          publishing={publishing}
        />

        {/* 3-column grid: [side panels] | main content | sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Optional side panels slot — S08.f/g/h mount Q&A + Assets here */}
          {slotSidePanels}

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

          {/* Right sidebar — meta form */}
          <EditorSidebar
            initialValues={buildInitialMeta(initialPost)}
            onMetaChange={(values) => setMetaState(values)}
            onValidityChange={(valid, errs) => {
              setIsFormValid(valid);
              setFormErrors(errs);
            }}
          />
        </div>
      </div>

      {/* Publish confirmation dialog */}
      <PublishDialog
        open={publishDialogOpen}
        onCancel={() => setPublishDialogOpen(false)}
        onConfirm={handlePublishConfirm}
        meta={meta}
        publishing={publishing}
      />
    </EditorProvider>
  );
}

// ─── Publish confirmation dialog ──────────────────────────────────────────────

interface PublishDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  meta: EditorMetaForm;
  publishing: boolean;
}

function PublishDialog({
  open,
  onCancel,
  onConfirm,
  meta,
  publishing,
}: PublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar post</DialogTitle>
          <DialogDescription>
            O post será publicado no Sanity e ficará disponível no site.
            Esta ação não pode ser desfeita facilmente.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 space-y-1 text-sm">
          <dl className="space-y-1">
            <MetaRow label="Título" value={meta.title} />
            <MetaRow label="Slug" value={`/blog/${meta.slug}`} mono />
            <MetaRow label="Idioma" value={meta.language.toUpperCase()} />
            <MetaRow label="Game" value={meta.gameVersion === 'path-of-exile-1' ? 'PoE 1' : 'PoE 2'} />
          </dl>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={publishing}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={publishing}>
            {publishing ? 'Publicando…' : 'Confirmar publicação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500 w-16 shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono text-zinc-300' : 'text-zinc-300'}>{value}</dd>
    </div>
  );
}
