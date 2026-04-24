'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';

const API_URL = '/api/engine';

interface BulkApprovePayload {
  ids?: number[];
  source?: string;
  category?: string;
  reviewerNotes?: string;
}

interface BulkApproveResult {
  approved: number;
}

/** Calls approve-bulk endpoint and returns the count of approved items. */
async function postBulkApprove(payload: BulkApprovePayload): Promise<number> {
  const res = await fetch(`${API_URL}/slang/approve-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`approve-bulk returned ${res.status}: ${text.substring(0, 120)}`);
  }
  const data: BulkApproveResult = await res.json();
  return data.approved;
}

interface BulkActionBarProps {
  selectedIds: Set<number>;
  onClearSelection: () => void;
  onApproveComplete: () => void;
}

/**
 * Sticky action bar that appears when selectedIds.size > 0.
 * Lets the operator enter optional reviewer notes and approve the whole selection at once.
 */
export function BulkActionBar({
  selectedIds,
  onClearSelection,
  onApproveComplete,
}: BulkActionBarProps) {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (selectedIds.size === 0) return null;

  async function handleApproveSelected() {
    setLoading(true);
    try {
      const count = await postBulkApprove({
        ids: [...selectedIds],
        reviewerNotes: notes.trim() || undefined,
      });
      toast.success(`Approved ${count} slang term${count !== 1 ? 's' : ''}`);
      setNotes('');
      onClearSelection();
      onApproveComplete();
    } catch (err) {
      toast.error(`Bulk approve failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 p-3 mb-4 bg-primary/10 border border-primary/30 rounded-lg shadow-sm">
      <span className="text-sm font-medium text-foreground">
        {selectedIds.size} selected
      </span>

      {/* Optional reviewer notes — compact textarea */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reviewer notes (optional)"
        rows={1}
        className="flex-1 min-w-[180px] rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent resize-none"
      />

      <button
        onClick={handleApproveSelected}
        disabled={loading}
        className="px-4 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Approving...' : 'Approve selected'}
      </button>

      <button
        onClick={onClearSelection}
        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ApproveAllButtonProps {
  label: string;
  payload: BulkApprovePayload;
  onApproveComplete: () => void;
}

/**
 * Standalone "Approve all …" button used for source- and category-scoped bulk approvals.
 * Shows a native confirm() dialog before firing to prevent accidental mass-approval.
 */
export function ApproveAllButton({
  label,
  payload,
  onApproveComplete,
}: ApproveAllButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm(`${label} — are you sure?`)) return;
    setLoading(true);
    try {
      const count = await postBulkApprove(payload);
      toast.success(`Approved ${count} slang term${count !== 1 ? 's' : ''}`);
      onApproveComplete();
    } catch (err) {
      toast.error(`Bulk approve failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1.5 rounded-md text-xs bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Approving...' : label}
    </button>
  );
}
