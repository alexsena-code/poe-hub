'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NAV } from './navigation';
import { NavFooter } from './nav-footer';
import { useDocsBase } from './use-docs-path';

function slugFromPathname(pathname: string): string {
  return pathname.replace('/docs', '').replace(/^\//, '');
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentSlug = slugFromPathname(pathname);
  const [search, setSearch] = useState('');
  const base = useDocsBase();

  const filtered = search.trim()
    ? NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.title.toLowerCase().includes(search.toLowerCase()),
        ),
      })).filter((s) => s.items.length > 0)
    : NAV;

  function docsHref(slug: string) {
    if (!slug) return base || '/docs';
    return `${base}/${slug}`;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Docs sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="h-12 px-4 flex items-center gap-2 border-b border-border shrink-0">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Hub
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href={base || '/docs'} className="text-sm font-semibold text-foreground">
            Docs
          </Link>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2.5 py-1 rounded-md bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
          {filtered.map((section) => (
            <div key={section.title} className="mb-3">
              <div className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {section.title}
              </div>
              {section.items.map((item) => {
                const active = currentSlug === item.slug;
                return (
                  <Link
                    key={item.slug}
                    href={docsHref(item.slug)}
                    className={`block mx-2 px-2.5 py-1 rounded-md text-[13px] transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border">
          <Link href="/dashboard" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            ← Voltar ao Dashboard
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {children}
          <NavFooter />
        </div>
      </div>
    </div>
  );
}
