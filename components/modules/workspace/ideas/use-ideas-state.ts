'use client';

import { useState, useEffect, useCallback } from 'react';
import { ContentBrief, BriefCounts, BriefStatus, UrgencyFilter } from './types';
import { IDEAS_API, CANONICAL_DATA_SOURCES } from './constants';

interface UseIdeasStateReturn {
  briefs: ContentBrief[];
  loading: boolean;
  filterStatus: BriefStatus;
  setFilterStatus: (s: BriefStatus) => void;
  filterUrgency: UrgencyFilter;
  setFilterUrgency: (u: UrgencyFilter) => void;
  counts: BriefCounts;
  msg: string | null;
  setMsg: (m: string | null) => void;
  setBriefs: React.Dispatch<React.SetStateAction<ContentBrief[]>>;
  fetchBriefs: () => void;
  updateStatus: (id: number, status: string) => Promise<void>;
  toggleDataSource: (id: number, key: string) => Promise<void>;
  clearBriefs: () => Promise<void>;
  exportContent: (id: number, format: 'json' | 'md' | 'md-pt' | 'md-en') => void;
  deleteGeneratedPost: (id: number) => Promise<void>;
  generatedPosts: Record<number, unknown>;
  setGeneratedPosts: React.Dispatch<React.SetStateAction<Record<number, unknown>>>;
}

export function useIdeasState(): UseIdeasStateReturn {
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<BriefStatus>('all');
  const [filterUrgency, setFilterUrgency] = useState<UrgencyFilter>('all');
  const [msg, setMsg] = useState<string | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<Record<number, unknown>>({});

  const fetchBriefs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterUrgency !== 'all') params.set('urgency', filterUrgency);
      const res = await fetch(`${IDEAS_API}/ideation/briefs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBriefs(Array.isArray(data) ? data : data.briefs ?? []);
      }
    } catch { /* swallowed — network errors surface as empty list */ }
    setLoading(false);
  }, [filterStatus, filterUrgency]);

  useEffect(() => { fetchBriefs(); }, [fetchBriefs]);

  async function updateStatus(id: number, status: string) {
    try {
      await fetch(`${IDEAS_API}/ideation/briefs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchBriefs();
    } catch { /* */ }
  }

  async function toggleDataSource(id: number, key: string) {
    const brief = briefs.find((x) => x.id === id);
    if (!brief) return;
    // Merge canonical keys so toggling a missing source adds it as false first
    const base: Record<string, boolean> = {};
    for (const k of CANONICAL_DATA_SOURCES) base[k] = false;
    const merged: Record<string, boolean> = { ...base, ...(brief.dataSources || {}) };
    merged[key] = !merged[key];

    // Optimistic update — revert on failure
    setBriefs((prev) => prev.map((x) => (x.id === id ? { ...x, dataSources: merged } : x)));
    try {
      const res = await fetch(`${IDEAS_API}/ideation/briefs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSources: merged }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setBriefs((prev) =>
        prev.map((x) => (x.id === id ? { ...x, dataSources: brief.dataSources } : x)),
      );
      setMsg('Falha ao atualizar data sources');
    }
  }

  async function clearBriefs() {
    if (!confirm('Clear all pending/superseded briefs? Accepted briefs will be kept.')) return;
    try {
      await fetch(`${IDEAS_API}/ideation/briefs?status=pending`, { method: 'DELETE' });
      await fetch(`${IDEAS_API}/ideation/briefs?status=superseded`, { method: 'DELETE' });
      setMsg('Cleared');
      fetchBriefs();
    } catch { setMsg('Failed to clear'); }
  }

  function exportContent(id: number, format: 'json' | 'md' | 'md-pt' | 'md-en') {
    window.open(`${IDEAS_API}/ideation/briefs/${id}/export?format=${format}`, '_blank');
  }

  async function deleteGeneratedPost(id: number) {
    if (!confirm('Delete the generated post files? The brief will be reset to "accepted" so you can regenerate.')) return;
    try {
      const res = await fetch(`${IDEAS_API}/ideation/briefs/${id}/generated-post`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if ((data as { error?: string }).error) {
        setMsg(`Delete failed: ${(data as { error: string }).error}`);
      } else {
        const d = data as { deletedFiles?: unknown[] };
        setMsg(`Deleted ${d.deletedFiles?.length ?? 0} file(s)`);
        setGeneratedPosts(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        fetchBriefs();
      }
    } catch {
      setMsg('Failed to delete generated post');
    }
  }

  const counts: BriefCounts = {
    all: briefs.length,
    pending: briefs.filter(b => b.status === 'pending').length,
    accepted: briefs.filter(b => b.status === 'accepted').length,
    rejected: briefs.filter(b => b.status === 'rejected').length,
    generated: briefs.filter(b => b.status === 'generated').length,
  };

  return {
    briefs,
    loading,
    filterStatus,
    setFilterStatus,
    filterUrgency,
    setFilterUrgency,
    counts,
    msg,
    setMsg,
    setBriefs,
    fetchBriefs,
    updateStatus,
    toggleDataSource,
    clearBriefs,
    exportContent,
    deleteGeneratedPost,
    generatedPosts,
    setGeneratedPosts,
  };
}
