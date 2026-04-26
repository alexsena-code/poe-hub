'use client';

// ---------------------------------------------------------------------------
// useOperations — central state hook for the Operations control center.
//
// Owns: trigger requests, per-action live status (polled at 2s for actions
// with `statusEndpoint`), and recent PipelineRun history (polled at 5s).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, ActionStatus, PipelineRun } from './types';
import { ACTIONS } from './types';

const API_URL = '/api/engine';
const STATUS_POLL_MS = 2000;
const RUNS_POLL_MS = 5000;

export interface ActionState {
  running: boolean;
  lastError: string | null;
  lastResult: string | null;
  status: ActionStatus | null;
}

const EMPTY_STATE: ActionState = {
  running: false,
  lastError: null,
  lastResult: null,
  status: null,
};

export function useOperations() {
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Recent runs poller — always on.
  useEffect(() => {
    let cancelled = false;
    async function fetchRuns() {
      try {
        const res = await fetch(`${API_URL}/seo/cron/runs?limit=20`);
        if (!res.ok) return;
        const data = (await res.json()) as PipelineRun[];
        if (!cancelled) setRuns(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setRunsLoading(false);
      }
    }
    void fetchRuns();
    const id = setInterval(fetchRuns, RUNS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Cleanup any in-flight pollers on unmount.
  useEffect(() => {
    return () => {
      for (const id of Object.values(pollersRef.current)) clearInterval(id);
    };
  }, []);

  function patchState(actionId: string, patch: Partial<ActionState>) {
    setStates((prev) => ({
      ...prev,
      [actionId]: { ...EMPTY_STATE, ...prev[actionId], ...patch },
    }));
  }

  /**
   * Begin polling `statusEndpoint` for an action that's running. Stops on
   * the first response with `running=false` and stores the final result on
   * the action state.
   */
  function startStatusPoll(action: Action) {
    if (!action.statusEndpoint) return;
    if (pollersRef.current[action.id]) clearInterval(pollersRef.current[action.id]);

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}${action.statusEndpoint}`);
        if (!res.ok) return;
        const status = (await res.json()) as ActionStatus;
        patchState(action.id, { status });
        if (!status.running) {
          clearInterval(pollersRef.current[action.id]);
          delete pollersRef.current[action.id];
          patchState(action.id, {
            running: false,
            lastResult: summarizeResult(status.result),
          });
        }
      } catch {
        /* network blip — keep polling */
      }
    };

    pollersRef.current[action.id] = setInterval(poll, STATUS_POLL_MS);
    void poll();
  }

  const trigger = useCallback(async (action: Action, body?: Record<string, unknown>) => {
    patchState(action.id, {
      running: true,
      lastError: null,
      lastResult: null,
      status: null,
    });
    try {
      const init: RequestInit = { method: action.method };
      const payload = body ?? action.defaultBody;
      if (payload && action.method !== 'DELETE') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(payload);
      }
      const res = await fetch(`${API_URL}${action.endpoint}`, init);
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        patchState(action.id, {
          running: false,
          lastError: typeof data.error === 'string' ? data.error : `HTTP ${res.status}`,
        });
        return;
      }
      // If the endpoint exposes a status poller, leave running=true and start polling.
      // Otherwise mark complete with the response payload as the result.
      if (action.statusEndpoint) {
        startStatusPoll(action);
      } else {
        patchState(action.id, {
          running: false,
          lastResult: summarizeResult(data),
        });
      }
    } catch (e) {
      patchState(action.id, {
        running: false,
        lastError: (e as Error).message,
      });
    }
  // startStatusPoll uses a ref + setStates which are stable; no deps needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getState(actionId: string): ActionState {
    return states[actionId] ?? EMPTY_STATE;
  }

  return {
    actions: ACTIONS,
    getState,
    trigger,
    runs,
    runsLoading,
  };
}

/**
 * Render a small one-line summary of a result payload for the toast row.
 * Handles the common engine response shapes (`{status:'started'}`,
 * `{imported, skipped}`, `{snapshotCount, date}`, `{deleted}`, etc.).
 */
function summarizeResult(result: unknown): string {
  if (result == null) return 'OK';
  if (typeof result !== 'object') return String(result);
  const r = result as Record<string, unknown>;
  if (r.status === 'started') return 'Started (running in background)';
  if (typeof r.snapshotCount === 'number') return `Saved ${r.snapshotCount} snapshots`;
  if (typeof r.imported === 'number' || typeof r.skipped === 'number') {
    return `Imported ${r.imported ?? 0}, skipped ${r.skipped ?? 0}`;
  }
  if (typeof r.newKeywords === 'number') {
    return `New: ${r.newKeywords}, rejected: ${r.rejected ?? 0}`;
  }
  if (typeof r.deleted === 'number') return `Deleted ${r.deleted}`;
  return 'OK';
}
