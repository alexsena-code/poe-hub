'use client';

// CrawlErrorsDialog — shows the errors[] array from a crawl run in a scrollable dialog.
// The badge trigger displays the error count. If the full error list isn't already
// available (unlikely given our list endpoint returns errors[]), we could fetch
// GET /crawl-runs/:id, but the list payload already includes errors[], so we
// always have the full list on hand.

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CrawlErrorsDialogProps {
  errors: string[];
  runId: string;
  domain: string | null;
}

export function CrawlErrorsDialog({ errors, runId, domain }: CrawlErrorsDialogProps) {
  const [open, setOpen] = useState(false);

  if (errors.length === 0) return null;

  const label = domain ?? 'todos';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          {errors.length} erro{errors.length !== 1 ? 's' : ''}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Erros — {label} <span className="text-muted-foreground font-mono text-[10px]">#{runId.slice(0, 8)}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto mt-2">
          <ol className="space-y-1.5">
            {errors.map((err, idx) => (
              <li key={idx} className="flex gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{idx + 1}.</span>
                <span className="font-mono text-red-300/90 break-all">{err}</span>
              </li>
            ))}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
