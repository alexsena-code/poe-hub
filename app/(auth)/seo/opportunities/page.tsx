'use client';

// /seo/opportunities — priority views: where to apply effort immediately
// Tabs: Striking Distance | CTR Problems | Ramping
// Stats bar: striking count + ctr count from dashboard
// Datasets lazy-load on tab activation.

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useOpportunitiesState } from '@/components/modules/seo/opportunities/use-opportunities-state';
import { StrikingDistanceTab } from '@/components/modules/seo/opportunities/striking-distance-tab';
import { CtrProblemsTab } from '@/components/modules/seo/opportunities/ctr-problems-tab';
import { RampingTab } from '@/components/modules/seo/opportunities/ramping-tab';
import { Tip } from '@/components/modules/seo/shared/seo-primitives';
import { API_URL } from '@/components/modules/seo/shared/helpers';
import type { DashboardData } from '@/components/modules/seo/shared/types';

type OpportunitiesTab = 'striking' | 'ctr' | 'ramping';

const TABS: { id: OpportunitiesTab; label: string }[] = [
  { id: 'striking', label: 'Striking Distance' },
  { id: 'ctr', label: 'CTR Problems' },
  { id: 'ramping', label: 'Ramping' },
];

export default function SeoOpportunitiesPage() {
  const [tab, setTab] = useState<OpportunitiesTab>('striking');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const state = useOpportunitiesState();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/seo/dashboard`);
      if (res.ok) setDashboard(await res.json());
    } catch { /* engine offline */ }
  }, []);

  // Load dashboard stats + first tab on mount
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { state.fetchStriking(); }, [state.fetchStriking]);

  // Lazy-load on tab switch
  useEffect(() => {
    if (tab === 'striking') state.fetchStriking();
    if (tab === 'ctr') state.fetchCtrProblems();
    if (tab === 'ramping') state.fetchRamping();
  }, [tab, state.fetchStriking, state.fetchCtrProblems, state.fetchRamping]);

  const dash = dashboard;

  return (
    <div className="flex flex-col h-full max-w-[1800px] mx-auto">
      <div className="shrink-0 pb-4">
        <PageHeader
          title="SEO Opportunities"
          description="Keywords that need action now — striking distance, CTR issues, and ramping VICE signals"
          accent="var(--color-seo)"
          className="mb-4"
        />

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-4">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="Keywords ranking position 4-20 — close to page 1, worth optimizing">
                Striking Distance
              </Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{dash?.strikingDistance.count ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="High impressions + low CTR — improve title/meta description">
                CTR Problems
              </Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{dash?.ctrProblems.count ?? '...'}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <Tip text="Keywords with significant VICE score change in the selected period">
                Ramping
              </Tip>
            </div>
            <div className="text-lg font-bold text-foreground">{state.rampingData.length > 0 ? state.rampingData.length : '...'}</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-emerald-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto scrollbar-none">
        {tab === 'striking' && (
          <StrikingDistanceTab data={state.striking} loading={state.strikingLoading} />
        )}
        {tab === 'ctr' && (
          <CtrProblemsTab data={state.ctrProblems} loading={state.ctrLoading} />
        )}
        {tab === 'ramping' && (
          <RampingTab
            data={state.rampingData}
            loading={state.rampingLoading}
            days={state.rampingDays}
            minDelta={state.rampingMinDelta}
            onDaysChange={state.setRampingDays}
            onMinDeltaChange={state.setRampingMinDelta}
            onRefresh={state.fetchRamping}
          />
        )}
      </div>
    </div>
  );
}
