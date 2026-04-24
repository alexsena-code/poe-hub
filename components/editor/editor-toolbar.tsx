'use client';
/**
 * Top bar for the blog editor.
 *
 * Layout:
 *   Left   — inline title input + slug preview + language pill toggle
 *   Center — formatting quick-actions (H1/H2/H3 group, B, I, Link, Quote,
 *             Bullet, Ordered, Code block)
 *   Right  — autosave status, Draft↔Preview toggle, Publish button
 *
 * All formatting buttons call editor commands via useEditorContext().
 * The inline title input is a controlled value from meta — it feeds the
 * same state as the sidebar title field via setMeta.
 *
 * Session 08.e.
 */

import React from 'react';
import {
  Bold, Italic, Link2, Quote, List, ListOrdered,
  Code2, Heading1, Heading2, Heading3,
  Eye, EyeOff, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useEditorContext } from './editor-context';
import type { EditorPhase } from './types';
import type { AutosaveStatus } from './hooks/use-autosave';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorToolbarProps {
  phase: EditorPhase;
  onPhaseToggle: () => void;
  onPublish: () => void;
  isFormValid: boolean;
  formErrors: string[];
  autosaveStatus: AutosaveStatus;
  lastSavedAt: Date | null;
  publishing: boolean;
}

// ─── Autosave status display ──────────────────────────────────────────────────

function AutosaveIndicator({
  status,
  lastSavedAt,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
}) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando...
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3 w-3" />
        Erro ao salvar
      </span>
    );
  }
  if (status === 'saved' && lastSavedAt) {
    const secsAgo = Math.round((Date.now() - lastSavedAt.getTime()) / 1000);
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-500">
        <CheckCircle2 className="h-3 w-3 text-green-500" />
        Salvo há {secsAgo}s
      </span>
    );
  }
  return null;
}

// ─── Formatting button ────────────────────────────────────────────────────────

interface FmtButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FmtButton({ label, active, onClick, children }: FmtButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="icon"
          className="h-7 w-7"
          onClick={onClick}
          type="button"
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Top editor toolbar — title input, formatting quick actions, phase toggle,
 * publish button.
 *
 * The publish button is disabled when the form is invalid; tooltip explains
 * which fields are still required.
 */
export function EditorToolbar({
  phase,
  onPhaseToggle,
  onPublish,
  isFormValid,
  formErrors,
  autosaveStatus,
  lastSavedAt,
  publishing,
}: EditorToolbarProps) {
  const { editor, meta, setMeta, language } = useEditorContext();

  const cmd = (fn: () => boolean) => {
    fn();
  };

  const isPreview = phase === 'preview';

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-1 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        {/* Row 1: title + slug + language + publish controls */}
        <div className="flex items-center gap-3 min-w-0">
          {/* ── Left: title + slug ── */}
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <Input
              value={meta.title}
              onChange={(e) => setMeta({ title: e.target.value })}
              placeholder="Título do post"
              className="h-8 border-none bg-transparent px-0 text-base font-semibold text-white placeholder:text-zinc-600 focus-visible:ring-0 shadow-none"
              aria-label="Título do post"
            />
            <SlugPreview slug={meta.slug} />
          </div>

          {/* ── Language pill ── */}
          <LanguagePill language={language} setMeta={setMeta} />

          <Separator orientation="vertical" className="h-6 bg-zinc-700" />

          {/* ── Autosave status ── */}
          <AutosaveIndicator status={autosaveStatus} lastSavedAt={lastSavedAt} />

          {/* ── Phase toggle ── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onPhaseToggle}
                type="button"
                className="h-7 gap-1.5 text-xs"
              >
                {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {isPreview ? 'Editar' : 'Preview'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPreview ? 'Voltar ao editor' : 'Visualizar post'}</TooltipContent>
          </Tooltip>

          {/* ── Publish button ── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onPublish}
                  disabled={!isFormValid || publishing}
                  type="button"
                >
                  {publishing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Publicar
                </Button>
              </span>
            </TooltipTrigger>
            {!isFormValid && formErrors.length > 0 && (
              <TooltipContent className="max-w-48">
                <p className="font-medium mb-1">Campos pendentes:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {formErrors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Row 2: formatting quick actions (hidden in preview mode) */}
        {!isPreview && (
          <div className="flex items-center gap-0.5 flex-wrap">
            <FmtButton
              label="Heading 1"
              active={editor?.isActive('heading', { level: 1 })}
              onClick={() => cmd(() => editor?.chain().focus().setHeading({ level: 1 }).run() ?? false)}
            >
              <Heading1 className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Heading 2"
              active={editor?.isActive('heading', { level: 2 })}
              onClick={() => cmd(() => editor?.chain().focus().setHeading({ level: 2 }).run() ?? false)}
            >
              <Heading2 className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Heading 3"
              active={editor?.isActive('heading', { level: 3 })}
              onClick={() => cmd(() => editor?.chain().focus().setHeading({ level: 3 }).run() ?? false)}
            >
              <Heading3 className="h-3.5 w-3.5" />
            </FmtButton>

            <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

            <FmtButton
              label="Negrito (Ctrl+B)"
              active={editor?.isActive('bold')}
              onClick={() => cmd(() => editor?.chain().focus().toggleBold().run() ?? false)}
            >
              <Bold className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Itálico (Ctrl+I)"
              active={editor?.isActive('italic')}
              onClick={() => cmd(() => editor?.chain().focus().toggleItalic().run() ?? false)}
            >
              <Italic className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Link"
              active={editor?.isActive('link')}
              onClick={() => {
                const url = window.prompt('URL do link:');
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
            >
              <Link2 className="h-3.5 w-3.5" />
            </FmtButton>

            <Separator orientation="vertical" className="h-5 mx-0.5 bg-zinc-700" />

            <FmtButton
              label="Citação"
              active={editor?.isActive('blockquote')}
              onClick={() => cmd(() => editor?.chain().focus().toggleBlockquote().run() ?? false)}
            >
              <Quote className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Lista bullet"
              active={editor?.isActive('bulletList')}
              onClick={() => cmd(() => editor?.chain().focus().toggleBulletList().run() ?? false)}
            >
              <List className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Lista numerada"
              active={editor?.isActive('orderedList')}
              onClick={() => cmd(() => editor?.chain().focus().toggleOrderedList().run() ?? false)}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </FmtButton>
            <FmtButton
              label="Bloco de código"
              active={editor?.isActive('codeBlock')}
              onClick={() => cmd(() => editor?.chain().focus().toggleCodeBlock().run() ?? false)}
            >
              <Code2 className="h-3.5 w-3.5" />
            </FmtButton>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SlugPreview({ slug }: { slug: string }) {
  if (!slug) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-zinc-600 truncate">
      <span className="text-zinc-700">/blog/</span>
      <Badge
        variant="outline"
        className="text-xs border-zinc-700 text-zinc-500 px-1 py-0 font-mono"
      >
        {slug}
      </Badge>
    </span>
  );
}

interface LanguagePillProps {
  language: 'pt-br' | 'en';
  setMeta: (patch: Partial<{ language: 'pt-br' | 'en' }>) => void;
}

function LanguagePill({ language, setMeta }: LanguagePillProps) {
  return (
    <div className="flex items-center rounded-md border border-zinc-700 bg-zinc-900 p-0.5 gap-0.5 shrink-0">
      {(['pt-br', 'en'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setMeta({ language: lang })}
          className={[
            'px-2 py-0.5 rounded text-xs font-medium transition-colors',
            language === lang
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
          aria-pressed={language === lang}
        >
          {lang === 'pt-br' ? 'PT-BR' : 'EN'}
        </button>
      ))}
    </div>
  );
}
