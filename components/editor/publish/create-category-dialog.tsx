'use client';
/**
 * Inline dialog to create a new Sanity category from the publish form.
 *
 * Auto-derives tagname from title (lowercase + hyphens) but lets the operator
 * override. Calls POST /api/sanity/categories then mutates the SWR cache so
 * the parent select picks up the new option without a page refresh.
 *
 * S10 hotfix.
 */

import React, { useState } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateCategoryDialogProps {
  language: 'pt-br' | 'en';
  onCreated?: (newId: string) => void;
}

function slugifyTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function CreateCategoryDialog({ language, onCreated }: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [tagname, setTagname] = useState('');
  const [tagnameTouched, setTagnameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { mutate } = useSWRConfig();

  const effectiveTagname = tagnameTouched ? tagname : slugifyTitle(title);
  const canSubmit = title.trim().length >= 2 && effectiveTagname.length >= 2;

  const reset = () => {
    setTitle('');
    setTagname('');
    setTagnameTouched(false);
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/sanity/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), tagname: effectiveTagname, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `Falha ao criar categoria (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      toast.success(`Categoria "${title}" criada`);
      // Invalidate the categories SWR cache for this language so the select
      // re-fetches and picks up the new option.
      await mutate(`/api/sanity/refs?kind=categories&language=${language}`);
      onCreated?.(data.category._id);
      setOpen(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao criar categoria: ${msg}`);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus className="h-3 w-3" />
          Nova categoria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova categoria ({language.toUpperCase()})</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-title" className="text-xs">Título</Label>
            <Input
              id="cat-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Notícias"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-tagname" className="text-xs">Tagname (slug)</Label>
            <Input
              id="cat-tagname"
              value={effectiveTagname}
              onChange={(e) => { setTagnameTouched(true); setTagname(e.target.value); }}
              placeholder="ex: noticias"
            />
            <p className="text-xs text-muted-foreground">Apenas lowercase, números e hífens.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit || submitting}>
              {submitting ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
