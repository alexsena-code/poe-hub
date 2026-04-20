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

  // Topic mode (no ascendancy) drives most current templates (mechanic_guide,
  // currency_guide, faq, quick_explainer, beginner_guide). Only the legacy
  // build_guide used skill+ascendancy — leaving that branch for backward
  // compatibility.
  const subject = briefing?.topic?.trim() || briefing?.skill?.trim() || '';
  const isTopicMode = !briefing?.ascendancy?.trim();
  const title = briefing
    ? isTopicMode
      ? subject || 'Untitled'
      : `${briefing.skill} ${briefing.ascendancy}`.trim()
    : 'Untitled';

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

          {/* Meta info — matches backend GeneratedPost['meta'] shape:
              { description: { 'pt-br', en }, keywords: string[], primaryKeyword, schemaType,
                internalLinks: [{ slug, url, title, language }] }. The previous version
              checked `metaDescription` which never existed, so this block was always empty. */}
          {meta && (
            <div className="mb-8 rounded-lg bg-surface border border-border p-4 space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                SEO Metadata
              </h3>
              {(() => {
                const desc = (meta as any).description;
                const descText = typeof desc === 'string'
                  ? desc
                  : desc?.[lang] || desc?.en || desc?.['pt-br'];
                return descText ? (
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Meta description:</strong> {descText}
                  </p>
                ) : null;
              })()}
              {(meta as any).primaryKeyword ? (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Primary keyword:</strong>{' '}
                  {(meta as any).primaryKeyword}
                </p>
              ) : null}
              {Array.isArray((meta as any).keywords) && (meta as any).keywords.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Keywords:</strong>{' '}
                  {(meta as any).keywords.join(', ')}
                </p>
              ) : null}
              {Array.isArray((meta as any).internalLinks) && (meta as any).internalLinks.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Internal links:</strong>
                  <ul className="mt-1 ml-4 list-disc">
                    {(meta as any).internalLinks.map((l: any, i: number) => (
                      <li key={i}>
                        {typeof l === 'string' ? (
                          <code>{l}</code>
                        ) : (
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            {l.title || l.slug}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Sections — render the section title as <h2> before the markdown
              body. Previously only the markdown was rendered, so posts that
              don't bake their heading into the body came out as a wall of
              text. The section's `title` comes from the template YAML with
              variables already substituted. */}
          {approvedSections.map((section) => (
            <section key={section.sectionId} className="mb-8">
              {section.title && (
                <h2 className="mb-3 text-2xl font-semibold text-foreground">
                  {section.title}
                </h2>
              )}
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
