'use client';
/**
 * Editor title bar — discreet editable title that sits above the formatting
 * toolbar (Notion / Ghost style). Reads/writes meta.title via useEditorContext.
 *
 * S10 (post-approval polish).
 */

import React from 'react';
import { useEditorContext } from './editor-context';

export function EditorTitleBar() {
  const { meta, setMeta } = useEditorContext();

  return (
    <div className="bg-zinc-950 px-6 pt-3 pb-1">
      <input
        type="text"
        value={meta.title}
        onChange={(e) => setMeta({ title: e.target.value })}
        placeholder="Título do post…"
        aria-label="Título do post"
        className="w-full bg-transparent text-base font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
      />
    </div>
  );
}
