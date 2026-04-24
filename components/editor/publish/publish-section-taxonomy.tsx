'use client';
/**
 * Publish form — Taxonomy section.
 *
 * Renders: Category select (language-scoped via useSanityRefs), Author select,
 * Tags chip input (Enter/comma/blur add, click X remove, max 8 min 1).
 *
 * Category is filtered by the language field value so switching locale
 * doesn't leave orphaned cross-language categories selected.
 *
 * Session 10.b.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthors, useCategories } from '../hooks/use-sanity-refs';
import type { EditorMetaForm } from '../editor-meta-schema';
import { CreateCategoryDialog } from './create-category-dialog';

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
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-zinc-300">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

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
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-zinc-300">Tags</Label>
      <div className="flex flex-wrap gap-1 min-h-[36px] rounded-md border border-input bg-transparent px-2 py-1.5">
        {value.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 text-xs px-1.5 py-0 h-5">
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Taxonomy section: category (language-filtered), author, tags chip input.
 * Must be rendered inside a react-hook-form FormProvider (publish-form.tsx).
 */
export function PublishSectionTaxonomy() {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EditorMetaForm>();

  const language = watch('language');
  const categoryId = watch('categoryId');
  const { authors, isLoading: authorsLoading } = useAuthors();
  const { categories, isLoading: catsLoading } = useCategories(language);

  // Track the tagname + display title of the currently-selected category so
  // we can match a sibling in the other language when the operator flips
  // PT-BR ↔ EN. Update whenever the selected category is found in the
  // current list — that's our "ground truth" snapshot before the list
  // potentially refetches under a different language.
  const lastKnownRef = useRef<{ tagname: string; title: string } | null>(null);
  useEffect(() => {
    if (!categoryId) {
      lastKnownRef.current = null;
      return;
    }
    const current = categories.find((c) => c._id === categoryId);
    if (current) {
      lastKnownRef.current = {
        tagname: current.tagname,
        title: current.title ?? current.tagname,
      };
    }
  }, [categoryId, categories]);

  // Orphan-category guard: when language flips, the selected categoryId may
  // refer to a category in the previous language. Two-step recovery:
  //   1. Try sibling match by tagname (lastKnownRef captured pre-switch).
  //      Operators that name PT-BR/EN pairs with the same tagname (e.g.
  //      "noticias" in both) get auto-substitution — no toast, no extra clicks.
  //   2. If no sibling exists, clear categoryId and toast so the operator
  //      knows they need to pick a new one or create with "+ Nova categoria".
  useEffect(() => {
    if (catsLoading) return;
    if (!categoryId) return;
    if (categories.some((c) => c._id === categoryId)) return;
    const lastTag = lastKnownRef.current?.tagname;
    if (lastTag) {
      const sibling = categories.find((c) => c.tagname === lastTag);
      if (sibling) {
        setValue('categoryId', sibling._id, { shouldValidate: true, shouldDirty: true });
        return;
      }
    }
    setValue('categoryId', '', { shouldValidate: true, shouldDirty: true });
    const previousLabel = lastKnownRef.current?.title ?? 'selecionada';
    toast.warning(
      `Categoria "${previousLabel}" não tem equivalente em ${language.toUpperCase()}. Selecione uma nova ou crie com "+ Nova categoria".`,
    );
  }, [language, categoryId, categories, catsLoading, setValue]);

  return (
    <div className="space-y-4">
      <FieldRow label="Categoria" error={errors.categoryId?.message}>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={catsLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={catsLoading ? 'Carregando…' : 'Selecionar categoria'} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.title ?? c.tagname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <CreateCategoryDialog
                language={language}
                onCreated={(newId) => field.onChange(newId)}
              />
            </div>
          )}
        />
      </FieldRow>

      <FieldRow label="Autor" error={errors.authorId?.message}>
        <Controller
          name="authorId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={field.onChange}
              disabled={authorsLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={authorsLoading ? 'Carregando…' : 'Selecionar autor'} />
              </SelectTrigger>
              <SelectContent>
                {authors.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
    </div>
  );
}
