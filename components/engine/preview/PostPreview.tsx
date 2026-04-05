'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePostStore } from '@/lib/engine-store';

type Lang = 'pt-br' | 'en';

export default function PostPreview({ onBack }: { onBack: () => void }) {
  const { sections, briefing, meta, setPhase } = usePostStore();
  const [lang, setLang] = useState<Lang>('pt-br');

  const approvedSections = sections.filter(
    (s) => s.status === 'approved' && s.draft,
  );

  const title = briefing
    ? `${briefing.skill} ${briefing.ascendancy} Build Guide`
    : 'Build Guide';

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Voltar ao Editor
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang('pt-br')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              lang === 'pt-br'
                ? 'bg-accent text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            PT-BR
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              lang === 'en'
                ? 'bg-accent text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setPhase('published')}
            className="ml-4 px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Publicar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <article className="max-w-3xl mx-auto py-12 px-8">
          <h1 className="text-3xl font-bold text-accent mb-2">{title}</h1>

          {/* Meta info */}
          {meta && (
            <div className="mb-8 rounded-lg bg-surface border border-border p-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                SEO Metadata
              </h3>
              {'metaDescription' in meta && meta.metaDescription ? (
                <p className="text-sm text-muted-foreground mb-1">
                  <strong className="text-foreground">Meta Description:</strong>{' '}
                  {String(meta.metaDescription)}
                </p>
              ) : null}
              {'keywords' in meta && meta.keywords ? (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Keywords:</strong>{' '}
                  {Array.isArray(meta.keywords)
                    ? (meta.keywords as string[]).join(', ')
                    : String(meta.keywords)}
                </p>
              ) : null}
            </div>
          )}

          {/* Sections */}
          {approvedSections.map((section) => (
            <section key={section.sectionId} className="mb-8">
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.draft![lang]}
                </ReactMarkdown>
              </div>
            </section>
          ))}

          {approvedSections.length === 0 && (
            <p className="text-muted-foreground text-center py-12">
              Nenhuma secao aprovada para preview.
            </p>
          )}
        </article>
      </main>
    </div>
  );
}
