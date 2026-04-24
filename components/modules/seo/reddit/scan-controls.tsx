'use client';

// ---------------------------------------------------------------------------
// ScanControls — scan keyword button + refresh button
// ---------------------------------------------------------------------------

interface ScanControlsProps {
  scanning: boolean;
  loading: boolean;
  onScan: () => void;
  onRefresh: () => void;
}

export function ScanControls({ scanning, loading, onScan, onRefresh }: ScanControlsProps) {
  return (
    <>
      <button
        onClick={onScan}
        disabled={scanning}
        className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
      >
        {scanning ? 'Scanning...' : 'Scan Keywords'}
      </button>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="px-3 py-1.5 bg-foreground/10 hover:bg-foreground/15 disabled:opacity-40 rounded text-sm text-foreground transition-colors"
      >
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </>
  );
}
