'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { StatusBadge } from './status-badge';
import { approveDraft, clarifyDraft, rejectDraft } from './api';
import type {
  ClarificationGap,
  CuratedIngestDraft,
  ProposedChunk,
  ResolvedClarification,
} from './types';
import { COLLECTION_LABELS } from './types';

interface DraftDetailProps {
  draft: CuratedIngestDraft;
  /** Called with the updated draft after clarify/approve/reject. */
  onDraftUpdate: (next: CuratedIngestDraft) => void;
  /** When true, hides approve/reject/clarify controls (used by History tab). */
  readOnly?: boolean;
}

export function DraftDetail({ draft, onDraftUpdate, readOnly = false }: DraftDetailProps) {
  return (
    <div className="space-y-4">
      <Header draft={draft} />
      <SummaryCard summary={draft.llmAnalysis.summary} />
      <ProposedChunksCard chunks={draft.llmAnalysis.proposedChunks} />
      {!readOnly && draft.status === 'needs_clarification' && (
        <ClarifyForm
          draftId={draft.id}
          gaps={draft.llmAnalysis.gaps}
          existingAnswers={draft.clarifications ?? []}
          onUpdate={onDraftUpdate}
        />
      )}
      {!readOnly && draft.status === 'ready_to_approve' && (
        <ApproveRejectRow draft={draft} onUpdate={onDraftUpdate} />
      )}
      {readOnly && <QdrantPointIdsCard ids={draft.qdrantPointIds} />}
    </div>
  );
}

function Header({ draft }: { draft: CuratedIngestDraft }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground">#{draft.id}</span>
        <StatusBadge status={draft.status} />
        <Badge variant="outline">{COLLECTION_LABELS[draft.targetCollection]}</Badge>
      </div>
      <span className="text-xs text-muted-foreground">
        {new Date(draft.updatedAt).toLocaleString('pt-BR')}
      </span>
    </div>
  );
}

function SummaryCard({ summary }: { summary: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary}</p>
      </CardContent>
    </Card>
  );
}

function ProposedChunksCard({ chunks }: { chunks: ProposedChunk[] }) {
  if (chunks.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground italic">
          No chunks proposed yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Proposed Chunks ({chunks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {chunks.map((chunk, i) => (
          <ChunkCard key={i} chunk={chunk} index={i} />
        ))}
      </CardContent>
    </Card>
  );
}

function ChunkCard({ chunk, index }: { chunk: ProposedChunk; index: number }) {
  const preview =
    chunk.content.length > 300 ? chunk.content.slice(0, 300) + '…' : chunk.content;
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">#{index + 1}</span>
          <span className="text-sm font-medium text-foreground">{chunk.title}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{preview}</p>
      {(chunk.tags.length > 0 || chunk.entities.length > 0) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {chunk.tags.map((t) => (
            <Badge key={`tag-${t}`} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
          {chunk.entities.map((e) => (
            <Badge key={`ent-${e}`} variant="outline" className="text-[10px]">
              {e}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClarifyFormProps {
  draftId: number;
  gaps: ClarificationGap[];
  existingAnswers: ResolvedClarification[];
  onUpdate: (next: CuratedIngestDraft) => void;
}

function ClarifyForm({ draftId, gaps, existingAnswers, onUpdate }: ClarifyFormProps) {
  const existingMap = new Map(existingAnswers.map((a) => [a.questionId, a.answer]));
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const gap of gaps) base[gap.id] = existingMap.get(gap.id) ?? '';
    return base;
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const payload: ResolvedClarification[] = gaps
      .map((gap) => ({ questionId: gap.id, answer: (answers[gap.id] ?? '').trim() }))
      .filter((a) => a.answer.length > 0);

    if (payload.length === 0) {
      toast.error('Answer at least one question before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const next = await clarifyDraft(draftId, payload);
      toast.success(
        next.status === 'ready_to_approve'
          ? 'All gaps resolved — ready to approve.'
          : 'Answers saved; LLM raised more questions.',
      );
      onUpdate(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit clarifications');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-amber-400">
          Clarification Questions ({gaps.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {gaps.map((gap) => (
          <div key={gap.id} className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-1">
                {gap.topic}
              </span>
              <label className="text-sm font-medium text-foreground">{gap.question}</label>
            </div>
            <Textarea
              value={answers[gap.id] ?? ''}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [gap.id]: e.target.value }))
              }
              placeholder="Your answer..."
              className="min-h-[60px]"
            />
          </div>
        ))}
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Submitting...
            </>
          ) : (
            'Submit Answers'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface ApproveRejectRowProps {
  draft: CuratedIngestDraft;
  onUpdate: (next: CuratedIngestDraft) => void;
}

function ApproveRejectRow({ draft, onUpdate }: ApproveRejectRowProps) {
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<'approve' | 'reject' | null>(null);

  async function runApprove() {
    setPending('approve');
    try {
      const next = await approveDraft(draft.id);
      toast.success(`Approved — ${next.qdrantPointIds.length} chunks written to Qdrant.`);
      onUpdate(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setPending(null);
      setConfirmOpen(null);
    }
  }

  async function runReject() {
    setPending('reject');
    try {
      const next = await rejectDraft(draft.id);
      toast.success('Draft rejected.');
      onUpdate(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setPending(null);
      setConfirmOpen(null);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setConfirmOpen('approve')} disabled={pending !== null}>
          {pending === 'approve' && <Spinner size="sm" className="mr-2" />}
          Approve & Ingest
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmOpen('reject')}
          disabled={pending !== null}
        >
          {pending === 'reject' && <Spinner size="sm" className="mr-2" />}
          Reject
        </Button>
      </div>

      <AlertDialog
        open={confirmOpen !== null}
        onOpenChange={(open) => !open && setConfirmOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmOpen === 'approve' ? 'Approve and ingest?' : 'Reject this draft?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOpen === 'approve' ? (
                <>
                  This writes {draft.llmAnalysis.proposedChunks.length} chunk(s) to the{' '}
                  <code className="text-xs">{draft.targetCollection}</code> Qdrant collection.
                  The draft becomes read-only after approval.
                </>
              ) : (
                <>
                  The draft will be marked rejected. No data is written to Qdrant. You can
                  still view it from the History tab.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmOpen === 'approve') runApprove();
                else if (confirmOpen === 'reject') runReject();
              }}
            >
              {confirmOpen === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function QdrantPointIdsCard({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Qdrant Point IDs ({ids.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-0.5 text-xs font-mono text-muted-foreground max-h-40 overflow-y-auto">
          {ids.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
