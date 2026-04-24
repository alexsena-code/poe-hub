'use client';
/**
 * Publish form — SEO & Image section.
 *
 * Renders: Metadata description (Textarea, 20–160 chars counter color-coded),
 * Cover image upload (POST /api/sanity/upload, preview thumbnail).
 *
 * Cover image is optional — posts can publish without a hero image.
 * Character counter turns destructive when >160.
 *
 * Session 10.b.
 */

import React, { useState, useRef } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Upload, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { EditorMetaForm } from '../editor-meta-schema';

// ─── Image upload sub-component ───────────────────────────────────────────────

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
      if (!res.ok) throw new Error(`Upload falhou: ${res.statusText}`);
      const data = await res.json() as { assetId: string; url: string };
      onChange(data.assetId);
      setPreviewUrl(data.url);
    } catch (err: unknown) {
      toast.error('Falha no upload', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-zinc-300">Imagem principal</Label>
      {previewUrl ? (
        <div className="relative rounded-md overflow-hidden border border-zinc-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview da capa" className="w-full h-32 object-cover" />
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
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-700 bg-zinc-900 py-4 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
            : <><Upload className="h-4 w-4" /> Enviar imagem (opcional)</>
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * SEO section: description textarea with char counter + cover image upload.
 * Must be rendered inside a react-hook-form FormProvider (publish-form.tsx).
 */
export function PublishSectionSeo() {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<EditorMetaForm>();

  const metadataValue = watch('metadata');
  const count = metadataValue?.length ?? 0;

  const counterColor =
    count > 160 ? 'text-destructive' :
    count < 20 ? 'text-amber-500' :
    'text-zinc-500';

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium text-zinc-300">Descrição SEO</Label>
          <span className={`text-xs ${counterColor}`}>{count}/160</span>
        </div>
        <Textarea
          {...register('metadata')}
          placeholder="Breve descrição para Google e redes sociais…"
          className="resize-none h-24 text-sm"
          maxLength={170}
        />
        {errors.metadata?.message && (
          <p className="text-xs text-destructive">{errors.metadata.message}</p>
        )}
      </div>

      <Controller
        name="mainImageAssetId"
        control={control}
        render={({ field }) => (
          <ImageUploadField value={field.value} onChange={field.onChange} />
        )}
      />
    </div>
  );
}
