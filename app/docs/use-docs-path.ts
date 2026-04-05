'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the base prefix for docs links.
 * On docs.pathoftrade.net → "" (clean URLs)
 * On engine.pathoftrade.net or localhost → "/docs"
 */
export function useDocsBase(): string {
  const [base, setBase] = useState('/docs');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.host.startsWith('docs.')) {
      setBase('');
    }
  }, []);

  return base;
}

/** Build a docs href that works on both subdomain and engine paths */
export function useDocsHref(slug: string): string {
  const base = useDocsBase();
  if (!slug) return base || '/';
  return `${base}/${slug}`;
}
