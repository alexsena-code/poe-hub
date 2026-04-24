'use client';

// State hook for /seo/opportunities — striking distance, CTR problems, ramping.
// All three datasets lazy-load when their tab becomes active.

import { useState, useCallback } from 'react';
import type { StrikingKeyword, RampingEntry } from '../shared/types';
import { API_URL } from '../shared/helpers';

export interface OpportunitiesState {
  striking: StrikingKeyword[];
  strikingLoading: boolean;
  ctrProblems: StrikingKeyword[];
  ctrLoading: boolean;
  rampingData: RampingEntry[];
  rampingLoading: boolean;
  rampingDays: number;
  rampingMinDelta: number;
  setRampingDays: (d: number) => void;
  setRampingMinDelta: (d: number) => void;
  fetchStriking: () => Promise<void>;
  fetchCtrProblems: () => Promise<void>;
  fetchRamping: () => Promise<void>;
}

export function useOpportunitiesState(): OpportunitiesState {
  const [striking, setStriking] = useState<StrikingKeyword[]>([]);
  const [strikingLoading, setStrikingLoading] = useState(false);

  const [ctrProblems, setCtrProblems] = useState<StrikingKeyword[]>([]);
  const [ctrLoading, setCtrLoading] = useState(false);

  const [rampingData, setRampingData] = useState<RampingEntry[]>([]);
  const [rampingLoading, setRampingLoading] = useState(false);
  const [rampingDays, setRampingDays] = useState(7);
  const [rampingMinDelta, setRampingMinDelta] = useState(3);

  const fetchStriking = useCallback(async () => {
    setStrikingLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/striking-distance`);
      if (res.ok) setStriking(await res.json());
    } catch { /* engine offline */ }
    setStrikingLoading(false);
  }, []);

  const fetchCtrProblems = useCallback(async () => {
    setCtrLoading(true);
    try {
      const res = await fetch(`${API_URL}/seo/ctr-problems`);
      if (res.ok) setCtrProblems(await res.json());
    } catch { /* engine offline */ }
    setCtrLoading(false);
  }, []);

  const fetchRamping = useCallback(async () => {
    setRampingLoading(true);
    try {
      const params = new URLSearchParams({
        days: String(rampingDays),
        minDelta: String(rampingMinDelta),
      });
      const res = await fetch(`${API_URL}/seo/keywords/ramping?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRampingData(Array.isArray(data) ? data : (data.ramping ?? []));
      }
    } catch { /* engine offline */ }
    setRampingLoading(false);
  }, [rampingDays, rampingMinDelta]);

  return {
    striking,
    strikingLoading,
    ctrProblems,
    ctrLoading,
    rampingData,
    rampingLoading,
    rampingDays,
    rampingMinDelta,
    setRampingDays,
    setRampingMinDelta,
    fetchStriking,
    fetchCtrProblems,
    fetchRamping,
  };
}
