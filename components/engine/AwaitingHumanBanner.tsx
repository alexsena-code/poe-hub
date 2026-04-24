'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface PendingPost {
  slug: string;
  title: { 'pt-br'?: string; en?: string };
  pendingSections: Array<{ sectionId: string; title: string; guidance?: string }>;
  updatedAt?: string;
}

interface PendingResponse {
  count: number;
  posts: PendingPost[];
}

const API = '/api/engine';

export function AwaitingHumanBanner() {
  const [data, setData] = useState<PendingResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API}/content/posts/pending-human`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as PendingResponse;
        if (!cancelled) setData(json);
      } catch {
        // silent — banner just won't show
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (dismissed || !data || data.count === 0) return null;

  const first = data.posts[0];
  const firstTitle = first?.title?.['pt-br'] || first?.title?.en || first?.slug;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div className="flex-1">
        <div className="font-medium text-amber-200">
          {data.count} {data.count === 1 ? 'seção aguarda' : 'seções aguardam'} seu input
          {data.posts.length > 1 ? ` em ${data.posts.length} posts` : ''}
        </div>
        <div className="mt-0.5 text-xs text-amber-200/70">
          {first ? (
            <>
              Próximo:{' '}
              <Link
                href={`/workspace/editor/${first.slug}`}
                className="underline underline-offset-2 hover:text-amber-100"
              >
                {firstTitle}
              </Link>
              {first.pendingSections[0] && (
                <span className="ml-1 text-amber-200/50">
                  — seção “{first.pendingSections[0].title}”
                </span>
              )}
            </>
          ) : null}
        </div>
      </div>
      <Link
        href="/workspace/guides?pending=1"
        className="shrink-0 rounded-md border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 text-xs text-amber-200 transition-colors hover:bg-amber-900/50"
      >
        Ver todos
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 px-1 text-xs text-amber-200/50 hover:text-amber-200"
        aria-label="Dispensar"
      >
        ×
      </button>
    </div>
  );
}
