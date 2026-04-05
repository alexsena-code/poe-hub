'use client';

import { useMemo, useState } from 'react';
import { usePostStore } from '@/lib/engine-store';
import { savePost, updatePost } from '@/lib/content-api';

export default function PublishPanel() {
  const { postId, briefing, sections, meta, slug, setPhase, setSlug } = usePostStore();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const output = useMemo(() => {
    const approvedSections = sections
      .filter((s) => s.status === 'approved' && s.draft)
      .map((s) => ({
        sectionId: s.sectionId,
        title: s.title,
        content: s.draft,
        tokensUsed: s.tokensUsed,
      }));

    return {
      postId,
      briefing,
      sections: approvedSections,
      meta,
      generatedAt: new Date().toISOString(),
    };
  }, [postId, briefing, sections, meta]);

  const fileSlug = useMemo(() => {
    if (slug) return slug;
    const parts = [briefing?.skill, briefing?.ascendancy, briefing?.topic].filter(Boolean).join(' ');
    return (parts || postId || 'post')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }, [slug, briefing, postId]);

  const jsonStr = JSON.stringify(output, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave(status: 'draft' | 'published' = 'draft') {
    setSaving(true);
    try {
      const data = {
        ...output,
        slug: slug || undefined,
        status,
        phase: status === 'published' ? 'published' : 'writing',
        title: {
          'pt-br': `${briefing?.skill || briefing?.topic || ''} ${briefing?.ascendancy || ''} — ${briefing?.templateName || 'Guide'}`.trim(),
          en: `${briefing?.skill || briefing?.topic || ''} ${briefing?.ascendancy || ''} — ${briefing?.templateName || 'Guide'}`.trim(),
        },
        template: briefing?.templateName || 'Build Guide',
      };
      let result;
      if (slug) {
        result = await updatePost(slug, data);
      } else {
        result = await savePost(data);
        if (result.slug) setSlug(result.slug);
      }
      setSaveMsg(status === 'published' ? 'Publicado!' : 'Rascunho salvo!');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg('Erro ao salvar');
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadMd(lang: 'pt-br' | 'en') {
    const approvedSections = sections
      .filter((s) => s.status === 'approved' && s.draft)
      .map((s) => `## ${s.title}\n\n${s.draft?.[lang] || ''}`)
      .join('\n\n---\n\n');
    const title = briefing
      ? `# ${briefing.skill || briefing.topic || ''} ${briefing.ascendancy || ''}\n\n`
      : '';
    const md = title + approvedSections;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileSlug}-${lang}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPhase('writing')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Voltar ao Editor
          </button>
          <button
            onClick={() => setPhase('preview')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Preview
          </button>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-xs text-accent mr-2">{saveMsg}</span>}
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Salvar Rascunho'}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            Publicar
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            JSON
          </button>
          <button
            onClick={() => handleDownloadMd('pt-br')}
            className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            MD (PT)
          </button>
          <button
            onClick={() => handleDownloadMd('en')}
            className="px-3 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            MD (EN)
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Cost Summary */}
          {(() => {
            const totalTokens = sections.reduce((s, sec) => s + (sec.tokensUsed || 0), 0);
            const sectionCount = sections.filter((s) => s.status === 'approved').length;
            // Rough cost estimate: Gemini 3 Flash ~ $0.10/1M input + $0.40/1M output
            const estimatedCost = (totalTokens / 1_000_000) * 0.40;
            return (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="text-xs text-muted-foreground mb-1">Secoes Aprovadas</div>
                  <div className="text-xl font-bold text-foreground">{sectionCount}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="text-xs text-muted-foreground mb-1">Total Tokens</div>
                  <div className="text-xl font-bold text-foreground">{totalTokens.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="text-xs text-muted-foreground mb-1">Custo Estimado</div>
                  <div className="text-xl font-bold text-accent">${estimatedCost.toFixed(4)}</div>
                  <div className="text-[10px] text-muted-foreground">inclui rewrites</div>
                </div>
              </div>
            );
          })()}

          <h2 className="text-lg font-bold text-accent mb-4">
            Output Final — JSON
          </h2>
          <pre className="rounded-lg bg-surface border border-border p-6 text-sm text-foreground font-mono overflow-x-auto whitespace-pre-wrap">
            {jsonStr}
          </pre>
        </div>
      </main>
    </div>
  );
}
