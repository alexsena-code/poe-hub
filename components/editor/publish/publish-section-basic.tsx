'use client';
/**
 * Publish form — Basic section.
 *
 * Renders: Title, Slug (with auto-slugify from title unless manually edited),
 * Game Version select.
 *
 * Auto-slugify: mirrors the sidebar's behaviour from S08.e — slug is derived
 * from title unless the operator has manually touched the slug field.
 *
 * Session 10.b.
 */

import React, { useRef, useEffect } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { slugify } from '../serializer/placeholders';
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
 * Basic section: title, slug, game version.
 * Must be rendered inside a react-hook-form FormProvider (publish-form.tsx).
 */
export function PublishSectionBasic() {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EditorMetaForm>();

  // Track manual edits to slug — if the operator has typed in slug directly,
  // stop auto-deriving it from title changes.
  const slugManualRef = useRef(false);
  const titleValue = watch('title');

  useEffect(() => {
    if (!slugManualRef.current && titleValue) {
      setValue('slug', slugify(titleValue), { shouldValidate: true });
    }
  }, [titleValue, setValue]);

  return (
    <div className="space-y-4">
      <FieldRow label="Título" error={errors.title?.message}>
        <Input
          {...register('title')}
          placeholder="Título do post"
          className="h-9"
        />
      </FieldRow>

      <FieldRow label="Slug" error={errors.slug?.message}>
        <Input
          {...register('slug', {
            onChange: () => { slugManualRef.current = true; },
          })}
          placeholder="meu-post-slug"
          className="h-9 font-mono text-sm"
        />
      </FieldRow>

      <FieldRow label="Game Version" error={errors.gameVersion?.message}>
        <Controller
          name="gameVersion"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="path-of-exile-1">Path of Exile 1</option>
              <option value="path-of-exile-2">Path of Exile 2</option>
            </select>
          )}
        />
      </FieldRow>
    </div>
  );
}
