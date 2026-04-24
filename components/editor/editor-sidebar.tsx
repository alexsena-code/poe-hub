'use client';
/**
 * Right-hand sidebar meta form for the blog editor.
 *
 * Manages all Sanity post metadata: title, SEO description, slug, game version,
 * category, author, tags, main image, publish date, language.
 *
 * Architecture:
 * - react-hook-form + zod (editorMetaSchema) for validation.
 * - Shadow-syncs title + language to EditorContext via setMeta so the toolbar
 *   inline inputs stay in lockstep with the sidebar form.
 * - Category and Author rendered as native <select> elements backed by
 *   use-sanity-refs SWR hooks (no third-party async-select needed).
 * - Tags: chip input — type + Enter/comma adds chip; click removes it.
 * - MainImage: upload via POST /api/sanity/upload + preview thumbnail.
 * - Accordion sections keep the sidebar scannable: Basic | Taxonomy | SEO & Image | Schedule.
 *
 * Session 08.e.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { X, Upload, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion';
import { editorMetaSchema, editorMetaDefaults } from './editor-meta-schema';
import type { EditorMetaForm } from './editor-meta-schema';
import { slugify } from './serializer/placeholders';
import { useAuthors, useCategories } from './hooks/use-sanity-refs';
import { useEditorContext } from './editor-context';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditorSidebarProps {
  initialValues?: Partial<EditorMetaForm>;
  /** Called on every valid change so shell can keep meta in sync. */
  onMetaChange: (values: EditorMetaForm) => void;
  /** Called on every validation state change — drives publish button. */
  onValidityChange: (isValid: boolean, errors: string[]) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EditorSidebar({
  initialValues,
  onMetaChange,
  onValidityChange,
}: EditorSidebarProps) {
  const { language } = useEditorContext();
  const { authors, isLoading: authorsLoading } = useAuthors();
  const { categories, isLoading: catsLoading } = useCategories(language);

  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
    getValues,
  } = useForm<EditorMetaForm>({
    resolver: zodResolver(editorMetaSchema),
    defaultValues: { ...editorMetaDefaults, ...initialValues },
    mode: 'onChange',
  });

  // Watch all values to propagate upstream.
  const watchedValues = watch();

  // Auto-slugify title on change (only if slug not manually edited).
  const slugManualRef = useRef(false);
  const titleValue = watch('title');
  useEffect(() => {
    if (!slugManualRef.current && titleValue) {
      setValue('slug', slugify(titleValue), { shouldValidate: true });
    }
  }, [titleValue, setValue]);

  // Propagate values upstream on change.
  useEffect(() => {
    onMetaChange(getValues());
    const errs = Object.values(errors).flatMap((e) =>
      typeof e?.message === 'string' ? [e.message] : [],
    );
    onValidityChange(isValid, errs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedValues), isValid]);

  return (
    <aside className="flex flex-col gap-0 h-full overflow-y-auto border-l border-zinc-800 bg-zinc-950 w-72 shrink-0">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Metadados</h2>
      </div>

      <Accordion
        type="multiple"
        defaultValue={['basic', 'taxonomy', 'seo-image', 'schedule']}
        className="w-full"
      >
        {/* ── Basic ─────────────────────────────────────── */}
        <AccordionItem value="basic">
          <AccordionTrigger className="px-4 text-xs text-zinc-400 uppercase tracking-wider">
            Basic
          </AccordionTrigger>
          <AccordionContent className="px-4 space-y-3">
            <FieldRow label="Título" error={errors.title?.message}>
              <Input
                {...register('title')}
                placeholder="Título do post"
                className="h-8 text-sm"
              />
            </FieldRow>
            <FieldRow label="Slug" error={errors.slug?.message}>
              <Input
                {...register('slug', {
                  onChange: () => { slugManualRef.current = true; },
                })}
                placeholder="meu-post-slug"
                className="h-8 text-sm font-mono"
              />
            </FieldRow>
            <FieldRow label="Game Version" error={errors.gameVersion?.message}>
              <Controller
                name="gameVersion"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground"
                  >
                    <option value="path-of-exile-1">Path of Exile 1</option>
                    <option value="path-of-exile-2">Path of Exile 2</option>
                  </select>
                )}
              />
            </FieldRow>
          </AccordionContent>
        </AccordionItem>

        {/* ── Taxonomy ──────────────────────────────────── */}
        <AccordionItem value="taxonomy">
          <AccordionTrigger className="px-4 text-xs text-zinc-400 uppercase tracking-wider">
            Taxonomy
          </AccordionTrigger>
          <AccordionContent className="px-4 space-y-3">
            <FieldRow label="Categoria" error={errors.categoryId?.message}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    disabled={catsLoading}
                    className="w-full h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground disabled:opacity-50"
                  >
                    <option value="">
                      {catsLoading ? 'Carregando…' : 'Selecionar categoria'}
                    </option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.title ?? c.tagname}
                      </option>
                    ))}
                  </select>
                )}
              />
            </FieldRow>
            <FieldRow label="Autor" error={errors.authorId?.message}>
              <Controller
                name="authorId"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    disabled={authorsLoading}
                    className="w-full h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground disabled:opacity-50"
                  >
                    <option value="">
                      {authorsLoading ? 'Carregando…' : 'Selecionar autor'}
                    </option>
                    {authors.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </FieldRow>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tags?.message}
                />
              )}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── SEO & Image ───────────────────────────────── */}
        <AccordionItem value="seo-image">
          <AccordionTrigger className="px-4 text-xs text-zinc-400 uppercase tracking-wider">
            SEO &amp; Imagem
          </AccordionTrigger>
          <AccordionContent className="px-4 space-y-3">
            <MetadataField register={register} error={errors.metadata?.message} watchedMetadata={watchedValues.metadata} />
            <Controller
              name="mainImageAssetId"
              control={control}
              render={({ field }) => (
                <ImageUploadField
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Schedule ──────────────────────────────────── */}
        <AccordionItem value="schedule">
          <AccordionTrigger className="px-4 text-xs text-zinc-400 uppercase tracking-wider">
            Publicação
          </AccordionTrigger>
          <AccordionContent className="px-4 space-y-3">
            <FieldRow label="Data de publicação" error={errors.publishedAt?.message}>
              <Input
                type="datetime-local"
                {...register('publishedAt')}
                className="h-8 text-sm"
              />
            </FieldRow>
            <LanguageRadio control={control} error={errors.language?.message} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </aside>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-zinc-400">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MetadataField({
  register,
  error,
  watchedMetadata,
}: {
  register: ReturnType<typeof useForm<EditorMetaForm>>['register'];
  error?: string;
  watchedMetadata: string;
}) {
  const count = watchedMetadata?.length ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-zinc-400">Descrição SEO</Label>
        <span className={`text-xs ${count > 160 ? 'text-destructive' : 'text-zinc-600'}`}>
          {count}/160
        </span>
      </div>
      <Textarea
        {...register('metadata')}
        placeholder="Breve descrição para Google e redes sociais…"
        className="text-sm resize-none h-20"
        maxLength={170}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Tag chip input ───────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!tag || value.includes(tag) || value.length >= 8) return;
    onChange([...value, tag]);
    setInput('');
  };

  const removeTag = (t: string) => onChange(value.filter((v) => v !== t));

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-zinc-400">Tags</Label>
      <div className="flex flex-wrap gap-1 min-h-[32px] rounded-md border border-input bg-transparent px-2 py-1">
        {value.map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className="gap-1 text-xs px-1.5 py-0 h-5"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="hover:text-destructive"
              aria-label={`Remover tag ${t}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input) addTag(input); }}
          placeholder={value.length < 8 ? 'Adicionar tag…' : ''}
          disabled={value.length >= 8}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-zinc-600 disabled:opacity-50"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Image upload ─────────────────────────────────────────────────────────────

function ImageUploadField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são aceitas');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/sanity/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = await res.json() as { assetId: string; url: string };
      onChange(data.assetId);
      setPreviewUrl(data.url);
    } catch (err: unknown) {
      toast.error('Falha no upload', { description: err instanceof Error ? err.message : 'Erro' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-zinc-400">Imagem principal</Label>
      {previewUrl ? (
        <div className="relative rounded-md overflow-hidden border border-zinc-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview" className="w-full h-28 object-cover" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6 bg-black/60"
            onClick={() => { onChange(undefined); setPreviewUrl(null); }}
            aria-label="Remover imagem"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900 py-3 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
            : <><Upload className="h-4 w-4" /> Enviar imagem</>
          }
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value && !previewUrl && (
        <p className="text-xs text-zinc-600 truncate">Asset: {value}</p>
      )}
    </div>
  );
}

// ─── Language radio ───────────────────────────────────────────────────────────

function LanguageRadio({
  control,
  error,
}: {
  control: ReturnType<typeof useForm<EditorMetaForm>>['control'];
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-zinc-400">Idioma do documento</Label>
      <Controller
        name="language"
        control={control}
        render={({ field }) => (
          <div className="flex gap-2">
            {(['pt-br', 'en'] as const).map((lang) => (
              <label
                key={lang}
                className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-300"
              >
                <input
                  type="radio"
                  value={lang}
                  checked={field.value === lang}
                  onChange={() => field.onChange(lang)}
                  className="accent-primary"
                />
                {lang === 'pt-br' ? 'PT-BR' : 'English'}
              </label>
            ))}
          </div>
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Separator className="mt-2 bg-zinc-800" />
    </div>
  );
}
