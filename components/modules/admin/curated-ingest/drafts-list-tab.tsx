'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { RefreshCw } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { DraftDetail } from './draft-detail';
import { listDrafts } from './api';
import type { CuratedIngestDraft, DraftStatus } from './types';
import { COLLECTION_LABELS } from './types';

interface DraftsListTabProps {
  /** Which statuses to include. */
  statuses: DraftStatus[];
  /** When true, hides approve/reject/clarify controls in the detail dialog. */
  readOnly?: boolean;
  /** Empty-state copy. */
  emptyLabel: string;
}

export function DraftsListTab({ statuses, readOnly = false, emptyLabel }: DraftsListTabProps) {
  const [drafts, setDrafts] = useState<CuratedIngestDraft[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CuratedIngestDraft | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await listDrafts({ status: statuses, limit: 100 });
      setDrafts(results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load drafts');
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [statuses]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleDraftUpdate(next: CuratedIngestDraft) {
    setSelected(next);
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((d) => (d.id === next.id ? next : d));
    });
  }

  if (!drafts) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        <Spinner size="sm" className="mx-auto mb-2" />
        Loading drafts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground italic">
            {emptyLabel}
          </CardContent>
        </Card>
      ) : (
        <DraftsTable drafts={drafts} onView={setSelected} />
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Draft #{selected?.id}
              {selected && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {COLLECTION_LABELS[selected.targetCollection]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <DraftDetail
              draft={selected}
              onDraftUpdate={handleDraftUpdate}
              readOnly={readOnly}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DraftsTableProps {
  drafts: CuratedIngestDraft[];
  onView: (draft: CuratedIngestDraft) => void;
}

function DraftsTable({ drafts, onView }: DraftsTableProps) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Collection</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drafts.map((draft) => (
            <DraftRow key={draft.id} draft={draft} onView={onView} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function DraftRow({
  draft,
  onView,
}: {
  draft: CuratedIngestDraft;
  onView: (draft: CuratedIngestDraft) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">{draft.id}</TableCell>
      <TableCell>
        <StatusBadge status={draft.status} />
      </TableCell>
      <TableCell className="text-xs">
        <span className="font-mono">{draft.targetCollection}</span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
        {draft.sourceUrl ?? `(${draft.sourceType})`}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(draft.createdAt).toLocaleString('pt-BR')}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" onClick={() => onView(draft)}>
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
