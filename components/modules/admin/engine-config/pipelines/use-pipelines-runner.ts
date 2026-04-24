'use client';

// State + execution logic for the pipeline runner.
// Separates the three run modes (sse/poll/fire) from the render layer.
// pollingRef is kept here so intervals survive re-renders and are
// cleaned up on unmount without leaking.

import { useCallback, useEffect, useRef, useState } from 'react';
import { API, PIPELINES, PipelineState } from './types';

type PipelinesStates = Record<string, PipelineState>;
type PipelinesConfigs = Record<string, Record<string, unknown>>;

function buildConfigBody(
  pipeline: typeof PIPELINES[number],
  cfg: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...(pipeline.body ?? {}) };
  for (const f of pipeline.configFields) {
    if (f.type === 'number') {
      body[f.key] = Number(cfg[f.key]);
    } else if (f.type === 'boolean') {
      body[f.key] = Boolean(cfg[f.key]);
    } else if (f.key === 'seeds') {
      // seeds field expects an array of trimmed strings
      body[f.key] = String(cfg[f.key]).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      body[f.key] = cfg[f.key];
    }
  }
  return body;
}

function defaultConfig(pipeline: typeof PIPELINES[number]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const f of pipeline.configFields) {
    defaults[f.key] = f.default;
  }
  return defaults;
}

export function usePipelinesRunner() {
  const [states, setStates] = useState<PipelinesStates>({});
  const [configs, setConfigs] = useState<PipelinesConfigs>({});
  const logEndRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [, setTick] = useState(0);

  // Live timer: force re-render every second while any pipeline is running
  useEffect(() => {
    const hasRunning = Object.values(states).some(s => s.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [states]);

  // Clean up polling intervals on unmount
  useEffect(() => {
    const ref = pollingRef.current;
    return () => { Object.values(ref).forEach(clearInterval); };
  }, []);

  const getState = (id: string): PipelineState =>
    states[id] ?? { status: 'idle', logs: [] };

  const getConfig = (id: string, pipeline: typeof PIPELINES[number]): Record<string, unknown> =>
    configs[id] ?? defaultConfig(pipeline);

  const updateConfig = (id: string, key: string, value: unknown) => {
    setConfigs((prev) => {
      const pipeline = PIPELINES.find((p) => p.id === id)!;
      return { ...prev, [id]: { ...getConfig(id, pipeline), [key]: value } };
    });
  };

  const addLog = useCallback((id: string, step: string, message: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setStates((prev) => {
      const cur = prev[id] ?? { status: 'running', logs: [] };
      return { ...prev, [id]: { ...cur, logs: [...cur.logs, { time, step, message }], step } };
    });
    // Auto-scroll to bottom of this pipeline's log viewer
    setTimeout(() => {
      logEndRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, []);

  const updateState = useCallback((id: string, patch: Partial<PipelineState>) => {
    setStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { status: 'idle', logs: [] }), ...patch },
    }));
  }, []);

  const runSse = useCallback(async (pipeline: typeof PIPELINES[number], cfg: Record<string, unknown>) => {
    const { id } = pipeline;
    try {
      const body = buildConfigBody(pipeline, cfg);
      const response = await fetch(`${API}${pipeline.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = 'log';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (currentEvent === 'log') {
                addLog(id, String(data.step ?? 'info'), String(data.message ?? JSON.stringify(data)));
              } else if (currentEvent === 'result') {
                // Use functional setState to read current startedAt without stale closure
                setStates((prev) => {
                  const elapsed = Date.now() - (prev[id]?.startedAt ?? Date.now());
                  addLog(id, 'done', `Concluido em ${(elapsed / 1000).toFixed(1)}s`);
                  return { ...prev, [id]: { ...(prev[id] ?? { status: 'idle', logs: [] }), status: 'done', finishedAt: Date.now(), result: data } };
                });
              } else if (currentEvent === 'error') {
                const msg = String(data.message ?? JSON.stringify(data));
                updateState(id, { status: 'error', error: msg, finishedAt: Date.now() });
                addLog(id, 'error', msg);
              }
            } catch { /* skip malformed SSE JSON */ }
          }
        }
      }

      // If still running after stream ends, mark done
      setStates((prev) => {
        const cur = prev[id];
        if (cur?.status === 'running') {
          return { ...prev, [id]: { ...cur, status: 'done', finishedAt: Date.now() } };
        }
        return prev;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateState(id, { status: 'error', error: msg, finishedAt: Date.now() });
      addLog(id, 'error', msg);
    }
  }, [addLog, updateState]);

  const runPoll = useCallback(async (pipeline: typeof PIPELINES[number], cfg: Record<string, unknown>) => {
    const { id } = pipeline;
    try {
      const body = buildConfigBody(pipeline, cfg);
      const res = await fetch(`${API}${pipeline.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addLog(id, 'start', 'Pipeline iniciado');

      let lastLogCount = 0;
      const statusUrl = `${API}${pipeline.statusEndpoint}`;
      pollingRef.current[id] = setInterval(async () => {
        try {
          const sr = await fetch(statusUrl);
          const status = await sr.json() as {
            running: boolean; logs?: string[]; step?: string;
            progress?: number; result?: unknown;
          };

          if (status.logs && status.logs.length > lastLogCount) {
            for (let i = lastLogCount; i < status.logs.length; i++) {
              addLog(id, status.step ?? 'info', status.logs[i]);
            }
            lastLogCount = status.logs.length;
          }

          updateState(id, { progress: status.progress ?? 0, step: status.step });

          if (!status.running) {
            clearInterval(pollingRef.current[id]);
            delete pollingRef.current[id];
            setStates((prev) => {
              const elapsed = Date.now() - (prev[id]?.startedAt ?? Date.now());
              addLog(id, 'done', `Concluido em ${(elapsed / 1000).toFixed(1)}s`);
              return {
                ...prev,
                [id]: {
                  ...(prev[id] ?? { status: 'idle', logs: [] }),
                  status: status.result ? 'done' : 'error',
                  finishedAt: Date.now(),
                  result: status.result,
                },
              };
            });
          }
        } catch { /* ignore transient poll errors */ }
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateState(id, { status: 'error', error: msg, finishedAt: Date.now() });
      addLog(id, 'error', msg);
    }
  }, [addLog, updateState]);

  const runFire = useCallback(async (pipeline: typeof PIPELINES[number], cfg: Record<string, unknown>) => {
    const { id } = pipeline;
    try {
      const body = buildConfigBody(pipeline, cfg);
      const res = await fetch(`${API}${pipeline.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Record<string, unknown>;
      addLog(id, 'start', 'Pipeline disparado');
      if (data.error) {
        const errMsg = String(data.error);
        updateState(id, { status: 'error', error: errMsg, finishedAt: Date.now() });
        addLog(id, 'error', errMsg);
      } else {
        addLog(id, 'info', `Resposta: ${JSON.stringify(data)}`);
        updateState(id, { status: 'done', finishedAt: Date.now(), result: data });
        addLog(id, 'done', 'Pipeline iniciado em background (sem log em tempo real)');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateState(id, { status: 'error', error: msg, finishedAt: Date.now() });
      addLog(id, 'error', msg);
    }
  }, [addLog, updateState]);

  const runPipeline = useCallback(async (pipeline: typeof PIPELINES[number]) => {
    const cfg = getConfig(pipeline.id, pipeline);
    updateState(pipeline.id, {
      status: 'running', logs: [], startedAt: Date.now(),
      finishedAt: undefined, result: undefined, error: undefined, progress: 0,
    });
    if (pipeline.mode === 'sse') await runSse(pipeline, cfg);
    else if (pipeline.mode === 'poll') await runPoll(pipeline, cfg);
    else await runFire(pipeline, cfg);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getConfig reads configs via closure; omitting it avoids stale-closure but configs changes trigger new runPipeline anyway
  }, [runSse, runPoll, runFire, updateState, configs]);

  return { states, getState, getConfig, updateConfig, runPipeline, logEndRefs };
}
