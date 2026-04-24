'use client';
/**
 * Hook that wires slash commands + mention-at + image-upload extensions
 * into a single array for merging with buildEditorExtensions().
 *
 * Usage pattern (S08.e mounts this):
 *   const extraExtensions = useSlashCommands();
 *   const editor = useTiptapEditor({ extraExtensions, ... });
 *
 * Or statically (preferred — extensions are stable):
 *   import { buildSlashExtension } from '../extensions/slash-commands';
 *   import { buildMentionExtension } from '../extensions/mention-at';
 *   import { buildImageUploadExtension } from '../extensions/image-upload';
 *   extensions: [...buildEditorExtensions(), ...buildSlashExtension(), ...]
 *
 * This hook exists so S08.e can import a single entry-point rather than
 * wiring each extension independently.
 *
 * NOTE: Extensions returned here must NOT duplicate anything in buildEditorExtensions()
 * (use-tiptap-editor.ts). In particular, the base Image extension is already
 * registered there — ImageUploadExtension augments it, not replaces it.
 */

import type { Extension } from '@tiptap/core';
import { buildSlashExtension } from '../extensions/slash-commands';
import { buildMentionExtension } from '../extensions/mention-at';
import { buildImageUploadExtension } from '../extensions/image-upload';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface SlashCommandsWiring {
  /** Extension list to spread into the editor's extension array. */
  extensions: Extension[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the stable set of extensions for slash commands, @-mention, and
 * image upload. Stable across renders — safe to pass to useEditor() deps array.
 *
 * @example
 * const { extensions: slashExtensions } = useSlashCommands();
 * const editor = useEditor({ extensions: [...baseExtensions, ...slashExtensions] });
 */
export function useSlashCommands(): SlashCommandsWiring {
  // These factories are pure and return new arrays of stable extension objects.
  // No state or effects needed — just compose the three extension sets.
  const extensions: Extension[] = [
    ...buildSlashExtension(),
    ...buildMentionExtension(),
    ...buildImageUploadExtension(),
  ];

  return { extensions };
}
