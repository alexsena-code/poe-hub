'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getPrevNext } from './navigation';
import { useDocsBase } from './use-docs-path';

export function NavFooter() {
  const pathname = usePathname();
  const slug = pathname.replace('/docs', '').replace(/^\//, '');
  const { prev, next } = getPrevNext(slug);
  const base = useDocsBase();

  function docsHref(s: string) {
    if (!s) return base || '/';
    return `${base}/${s}`;
  }

  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
      {prev ? (
        <Link
          href={docsHref(prev.slug)}
          className="group flex flex-col items-start gap-0.5"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Anterior</span>
          <span className="text-sm text-foreground group-hover:text-accent-hover transition-colors">
            &larr; {prev.title}
          </span>
        </Link>
      ) : <div />}
      {next ? (
        <Link
          href={docsHref(next.slug)}
          className="group flex flex-col items-end gap-0.5"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Proximo</span>
          <span className="text-sm text-foreground group-hover:text-accent-hover transition-colors">
            {next.title} &rarr;
          </span>
        </Link>
      ) : <div />}
    </div>
  );
}
