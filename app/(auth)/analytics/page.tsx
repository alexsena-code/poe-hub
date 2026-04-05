'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const AnalyticsTab = dynamic(() => import('./analytics-tab'), { loading: () => <Loading /> });
const LlmUsageTab = dynamic(() => import('./llm-tab'), { loading: () => <Loading /> });
const LogsTab = dynamic(() => import('./logs-tab'), { loading: () => <Loading /> });

function Loading() {
  return <div className="py-12 text-center text-muted-foreground">Carregando...</div>;
}

const TABS = [
  { id: 'analytics', label: 'SEO & Keywords' },
  { id: 'llm', label: 'LLM Usage' },
  { id: 'logs', label: 'Logs & History' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<TabId>('analytics');

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="sticky top-0 z-10 bg-background pb-0 pt-2">
        <h1 className="text-2xl font-bold mb-1">Analytics</h1>
        <p className="text-sm text-muted-foreground mb-4">SEO, custos LLM e historico de pipeline</p>

        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'llm' && <LlmUsageTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  );
}
