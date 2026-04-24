'use client';

// Keyword + locale selector input bar for /seo/analysis.
// Shared across both analysis actions (SERP fetch and competitor analysis).

import React from 'react';

interface KeywordInputProps {
  keyword: string;
  locale: string;
  onKeywordChange: (v: string) => void;
  onLocaleChange: (v: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}

const LOCALE_OPTIONS = [
  { value: 'en/us', label: 'EN (US)' },
  { value: 'en/gb', label: 'EN (UK)' },
  { value: 'pt/br', label: 'PT (BR)' },
  { value: 'pt/pt', label: 'PT (PT)' },
  { value: 'es/es', label: 'ES (Spain)' },
  { value: 'de/de', label: 'DE (Germany)' },
  { value: 'fr/fr', label: 'FR (France)' },
  { value: 'ru/ru', label: 'RU (Russia)' },
];

export function KeywordInput({ keyword, locale, onKeywordChange, onLocaleChange, onAnalyze, loading }: KeywordInputProps) {
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && keyword.trim()) onAnalyze();
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Enter keyword to analyze (e.g., poe righteous fire build guide)"
        className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50"
      />
      <select
        value={locale}
        onChange={(e) => onLocaleChange(e.target.value)}
        className="bg-background border border-border rounded px-2 py-2 text-sm text-foreground"
      >
        {LOCALE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={onAnalyze}
        disabled={loading || !keyword.trim()}
        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
      >
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>
    </div>
  );
}
