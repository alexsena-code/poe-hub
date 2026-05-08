'use client';
/**
 * Encapsulates the state for a single editor pane: Tiptap instance, meta form,
 * body JSON, autosave status. Used twice by EditorShell when running in
 * bilingual mode (PT pane + EN pane), once otherwise.
 *
 * Why a hook and not just inline state: extracting it lets EditorShell call it
 * twice without duplicating ~40 lines of state wiring. The two panes own
 * independent autosave streams — each PUTs to its own draftId — so they can
 * never overwrite each other.
 *
 * Session 21 (bilingual editor).
 */

import { useState, useCallback, useEffect } from 'react';
import type { JSONContent } from '@tiptap/core';
import type { PortableTextContent } from '@/lib/sanity/types';
import { useTiptapEditor } from './use-tiptap-editor';
import { useAutosave, type AutosaveStatus } from './use-autosave';
import { portableToTiptap } from '../serializer/portable-to-tiptap';
import { editorMetaDefaults } from '../editor-meta-schema';
import type { EditorMetaForm } from '../editor-meta-schema';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface UseEditorPaneOptions {
  initialMeta?: Partial<EditorMetaForm>;
  initialBody?: PortableTextContent[];
  draftId: string;
  defaultLanguage?: 'pt-br' | 'en';
  /**
   * When false, the pane skips Tiptap initialisation and autosave.
   * Used by EditorShell when sibling is undefined — the second pane stays
   * dormant so React hook order is preserved without persisting noise.
   */
  enabled?: boolean;
}

export interface EditorPane {
  editor: ReturnType<typeof useTiptapEditor>;
  meta: EditorMetaForm;
  setMeta: (patch: Partial<EditorMetaForm>) => void;
  bodyJson: JSONContent;
  draftId: string;
  language: 'pt-br' | 'en';
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Wires up Tiptap + meta state + autosave for one editor pane.
 *
 * @example
 * const primary = useEditorPane({ draftId: id, initialMeta, initialBody });
 * const secondary = useEditorPane({
 *   draftId: sibling?.draftId ?? '',
 *   initialMeta: sibling?.initialMeta,
 *   initialBody: sibling?.initialBody,
 *   enabled: !!sibling,
 * });
 */
export function useEditorPane({
  initialMeta,
  initialBody,
  draftId,
  defaultLanguage = 'pt-br',
  enabled = true,
}: UseEditorPaneOptions): EditorPane {
  const [meta, setMetaState] = useState<EditorMetaForm>({
    ...editorMetaDefaults,
    language: defaultLanguage,
    ...initialMeta,
  });
  const [bodyJson, setBodyJson] = useState<JSONContent>({ type: 'doc', content: [] });
  const [initialContentLoaded, setInitialContentLoaded] = useState(false);

  const setMeta = useCallback((patch: Partial<EditorMetaForm>) => {
    setMetaState((prev) => ({ ...prev, ...patch }));
  }, []);

  const editor = useTiptapEditor({
    onUpdate: (json) => setBodyJson(json),
  });

  // Load initial body into Tiptap once the editor is ready.
  useEffect(() => {
    if (!enabled) return;
    if (!editor) return;
    if (initialContentLoaded) return;
    if (initialBody === undefined) {
      setInitialContentLoaded(true);
      return;
    }
    const tiptapDoc = portableToTiptap(initialBody);
    editor.commands.setContent(tiptapDoc as JSONContent);
    setBodyJson(editor.getJSON());
    setInitialContentLoaded(true);
  }, [editor, initialBody, initialContentLoaded, enabled]);

  const { status: autosaveStatus, lastSavedAt } = useAutosave({
    draftId,
    meta,
    bodyJson,
    language: meta.language,
    enabled: enabled && initialContentLoaded,
  });

  return {
    editor,
    meta,
    setMeta,
    bodyJson,
    draftId,
    language: meta.language,
    autosaveStatus,
    lastSavedAt,
  };
}
