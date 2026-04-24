'use client';

import { useState, useRef, useEffect } from 'react';
import { IDEAS_API, MODEL_OPTIONS } from './constants';

interface UseGenerateFlowProps {
  selectedModel: number;
  editorialBriefing: string;
  selectedTemplates: string[];
  setMsg: (msg: string | null) => void;
  fetchBriefs: () => void;
}

interface UseGenerateFlowReturn {
  generating: boolean;
  generatingContent: number | null;
  handleGenerate: () => Promise<void>;
  generateContent: (id: number) => Promise<void>;
}

export function useGenerateFlow({
  selectedModel,
  editorialBriefing,
  selectedTemplates,
  setMsg,
  fetchBriefs,
}: UseGenerateFlowProps): UseGenerateFlowReturn {
  const [generating, setGenerating] = useState(false);
  const [generatingContent, setGeneratingContent] = useState<number | null>(null);

  // Track polling intervals so we can clean up on unmount
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
    };
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMsg(null);
    try {
      const opt = MODEL_OPTIONS[selectedModel];
      const res = await fetch(`${IDEAS_API}/ideation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opt.model || undefined,
          briefing: editorialBriefing || undefined,
          templates: selectedTemplates.length > 0 ? selectedTemplates : undefined,
        }),
      });
      const data = await res.json() as { error?: string; jobId?: string };
      if (data.error) {
        setMsg(`Error: ${data.error}`);
        setGenerating(false);
        return;
      }
      const { jobId } = data;
      setMsg('Generating... 0%');

      // Poll for job status
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${IDEAS_API}/ideation/jobs/${jobId}`);
          const job = await pollRes.json() as {
            status: string;
            progress?: number;
            error?: string;
            result?: { briefCount?: number; briefs?: unknown[]; count?: number; model?: string; costUsd?: number; cost?: number };
          };

          if (job.status === 'active' || job.status === 'waiting') {
            setMsg(`Generating... ${job.progress ?? 0}%`);
          } else if (job.status === 'completed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            const result = job.result ?? {};
            const count = result.briefCount ?? result.briefs?.length ?? result.count ?? 0;
            const mdl = result.model ?? opt.model;
            const cost = result.costUsd ?? result.cost ?? 0;
            setMsg(`Generated ${count} briefs (${mdl}) — $${Number(cost).toFixed(4)}`);
            fetchBriefs();
            setGenerating(false);
          } else if (job.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setMsg(`Error: ${job.error ?? 'Generation failed'}`);
            setGenerating(false);
          }
        } catch {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setMsg('Failed to check job status');
          setGenerating(false);
        }
      }, 2000);
    } catch {
      setMsg('Failed to generate');
      setGenerating(false);
    }
  }

  async function generateContent(id: number) {
    setGeneratingContent(id);
    setMsg(null);
    try {
      const res = await fetch(`${IDEAS_API}/ideation/briefs/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json() as { error?: string; jobId?: string };
      if (data.error) {
        setMsg(`Generation failed: ${data.error}`);
        setGeneratingContent(null);
        return;
      }
      const { jobId } = data;
      setMsg('Generating content... 0%');

      // Poll for job status
      if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
      contentPollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${IDEAS_API}/ideation/jobs/${jobId}`);
          const job = await pollRes.json() as {
            status: string;
            progress?: number;
            error?: string;
            result?: { post?: { slug?: string } };
          };

          if (job.status === 'active' || job.status === 'waiting') {
            setMsg(`Generating content... ${job.progress ?? 0}%`);
          } else if (job.status === 'completed') {
            if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
            contentPollIntervalRef.current = null;
            const result = job.result ?? {};
            setMsg(`Content generated: "${result.post?.slug || 'done'}"`);
            fetchBriefs();
            setGeneratingContent(null);
          } else if (job.status === 'failed') {
            if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
            contentPollIntervalRef.current = null;
            setMsg(`Generation failed: ${job.error ?? 'Unknown error'}`);
            setGeneratingContent(null);
          }
        } catch {
          if (contentPollIntervalRef.current) clearInterval(contentPollIntervalRef.current);
          contentPollIntervalRef.current = null;
          setMsg('Failed to check job status');
          setGeneratingContent(null);
        }
      }, 2000);
    } catch {
      setMsg('Failed to generate content');
      setGeneratingContent(null);
    }
  }

  return { generating, generatingContent, handleGenerate, generateContent };
}
