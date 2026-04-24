'use client';

// ---------------------------------------------------------------------------
// Shared Reddit page primitives — Badge, Tip, SortHeader, useSort
// These are small enough that co-locating them avoids over-splitting.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import type { SortDir } from './types';

export function RedditBadge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {children}
    </span>
  );
}

export function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = React.useRef<HTMLSpanElement>(null);

  function handleEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top - 6, left: rect.left + rect.width / 2 });
    }
    setShow(true);
  }

  return (
    <span
      ref={ref}
      className="cursor-help border-b border-dotted border-muted/40"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="fixed z-[9999] px-2 py-1 bg-black/80 text-white/70 text-[9px] leading-snug rounded pointer-events-none max-w-xs text-center normal-case tracking-normal"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)' }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function SortHeader({
  label,
  active,
  dir,
  onToggle,
  className,
  tip,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
  className?: string;
  tip?: string;
}) {
  const arrow = active ? (dir === 'asc' ? '↑' : '↓') : '';
  const content = (
    <span
      onClick={onToggle}
      className={`cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${active ? 'text-foreground' : ''}`}
    >
      {label}{arrow && <span className="text-[8px] ml-0.5 opacity-60">{arrow}</span>}
    </span>
  );
  return (
    <th className={className}>
      {tip ? <Tip text={tip}>{content}</Tip> : content}
    </th>
  );
}

/** Client-side sort hook used for the build-posts tab (small dataset). */
export function useClientSort<T>(data: T[], defaultKey: keyof T, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(key: keyof T) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return { sorted, sortKey, sortDir, toggle };
}
