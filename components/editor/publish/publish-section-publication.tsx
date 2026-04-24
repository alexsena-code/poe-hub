'use client';
/**
 * Publish form — Publication section.
 *
 * Renders: Published at (datetime-local, defaults to current time),
 * Language (RadioGroup pt-br / en).
 *
 * Language is controlled here but also syncs to taxonomy (category filter
 * watches it in publish-section-taxonomy.tsx). Because react-hook-form
 * FormProvider propagates changes, no extra wiring is needed.
 *
 * Session 10.b.
 */

import React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EditorMetaForm } from '../editor-meta-schema';

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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Publication section: published-at datetime + language radio.
 * Must be rendered inside a react-hook-form FormProvider (publish-form.tsx).
 */
export function PublishSectionPublication() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<EditorMetaForm>();

  return (
    <div className="space-y-4">
      <FieldRow label="Data de publicação" error={errors.publishedAt?.message}>
        <Input
          type="datetime-local"
          {...register('publishedAt')}
          className="h-9"
        />
      </FieldRow>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-zinc-300">Idioma</Label>
        <Controller
          name="language"
          control={control}
          render={({ field }) => (
            <div className="flex gap-4">
              {(['pt-br', 'en'] as const).map((lang) => (
                <label
                  key={lang}
                  className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300"
                >
                  <input
                    type="radio"
                    value={lang}
                    checked={field.value === lang}
                    onChange={() => field.onChange(lang)}
                    className="accent-primary h-4 w-4"
                  />
                  {lang === 'pt-br' ? 'PT-BR' : 'English'}
                </label>
              ))}
            </div>
          )}
        />
        {errors.language?.message && (
          <p className="text-xs text-destructive">{errors.language.message}</p>
        )}
      </div>
    </div>
  );
}
