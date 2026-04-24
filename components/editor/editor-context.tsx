'use client';
/**
 * React context that gives all child editor islands (toolbar, sidebar, body,
 * S08.f side panels, S08.g extensions) access to the shared editor state.
 *
 * Design:
 * - EditorProvider is mounted BEFORE any children inside editor-shell.tsx.
 * - S08.f (side-panel-qa, side-panel-assets) consumes useEditorContext() to
 *   call editor commands like editor.commands.insertPoeItem().
 * - S08.g (slash-commands, mention-at, image-upload) reads editor to add
 *   suggestion plugins and extension-level state.
 *
 * The context intentionally does NOT hold bodyJson — that lives as local state
 * in the shell and flows down through props to avoid re-rendering the whole
 * tree on every keystroke.
 */

import React, { createContext, useContext } from 'react';
import type { Editor } from '@tiptap/react';
import type { EditorMetaForm } from './editor-meta-schema';

// ─── Context value shape ───────────────────────────────────────────────────────

export interface EditorContextValue {
  /** Tiptap editor instance — null only before hydration (SSR-safe). */
  editor: Editor | null;
  /** Current meta form values (controlled by react-hook-form in editor-sidebar). */
  meta: EditorMetaForm;
  /** Callback to imperatively update one or more meta fields. */
  setMeta: (patch: Partial<EditorMetaForm>) => void;
  /** Draft document ID — used by use-autosave and use-publish hooks. */
  draftId: string;
  /** Active language — determines Sanity locale and GROQ category filter. */
  language: 'pt-br' | 'en';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const EditorCtx = createContext<EditorContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the editor context value.
 * Throws if called outside EditorProvider — surfaces a useful error message
 * rather than silent null propagation.
 *
 * @example
 * const { editor } = useEditorContext();
 * editor?.chain().focus().toggleBold().run();
 */
export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorCtx);
  if (!ctx) {
    throw new Error(
      'useEditorContext called outside <EditorProvider>. ' +
      'Wrap the component tree with EditorProvider (see editor-shell.tsx).',
    );
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface EditorProviderProps {
  value: EditorContextValue;
  children: React.ReactNode;
}

/**
 * Wraps the editor shell children with shared editor state.
 * Mount order matters — provider must enclose toolbar, body, sidebar,
 * and any future side panels before they call useEditorContext().
 */
export function EditorProvider({ value, children }: EditorProviderProps) {
  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}
