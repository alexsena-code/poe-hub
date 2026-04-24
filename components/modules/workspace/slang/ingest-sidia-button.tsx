'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

interface IngestResult {
  fetched: number;
  created: number;
  skipped: number;
  durationMs: number;
}

interface IngestSidiaButtonProps {
  onSuccess: () => void;
}

/** Triggers the sidia.net catalog ingest (247-term curated list) and toasts the result. */
export function IngestSidiaButton({ onSuccess }: IngestSidiaButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleIngest() {
    setLoading(true);
    try {
      const res = await fetch('/api/engine/slang/ingest/sidia', { method: 'POST' });
      if (!res.ok) {
        const err = await res.text();
        toast.error(`Ingest failed: ${err.substring(0, 120)}`);
        return;
      }
      const result: IngestResult = await res.json();
      toast.success(
        `Sidia ingest complete — ${result.fetched} fetched / ${result.created} created / ${result.skipped} skipped in ${result.durationMs}ms`,
      );
      onSuccess();
    } catch (err) {
      toast.error(`Ingest error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleIngest}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title="Fetch 247-term curated catalog from sidia.net"
    >
      <Download className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} />
      {loading ? 'Ingesting...' : 'Ingest sidia.net'}
    </button>
  );
}
