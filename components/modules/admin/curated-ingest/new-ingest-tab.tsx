'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { DraftDetail } from './draft-detail';
import { analyzeDraft } from './api';
import {
  COLLECTION_LABELS,
  CURATED_COLLECTIONS,
  type CuratedCollection,
  type CuratedIngestDraft,
} from './types';

const MIN_TEXT_LEN = 100;

type SourceMode = 'text' | 'url';

export function NewIngestTab() {
  const [collection, setCollection] = useState<CuratedCollection>('poe_crafting');
  const [mode, setMode] = useState<SourceMode>('text');
  const [rawText, setRawText] = useState('');
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<CuratedIngestDraft | null>(null);

  const canSubmit =
    mode === 'text'
      ? rawText.trim().length >= MIN_TEXT_LEN
      : url.trim().length > 0 && /^https?:\/\//i.test(url.trim());

  async function handleAnalyze() {
    if (!canSubmit) {
      toast.error(
        mode === 'text'
          ? `Raw text needs at least ${MIN_TEXT_LEN} characters (got ${rawText.trim().length}).`
          : 'Enter a valid URL (http:// or https://).',
      );
      return;
    }
    setAnalyzing(true);
    try {
      const payload =
        mode === 'text'
          ? { rawText: rawText.trim(), targetCollection: collection }
          : { url: url.trim(), targetCollection: collection };
      const result = await analyzeDraft(payload);
      setDraft(result);
      toast.success(
        result.status === 'ready_to_approve'
          ? 'Analysis complete — ready to approve.'
          : `Analysis complete — ${result.llmAnalysis.gaps.length} clarification(s) needed.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analyze failed');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleReset() {
    setDraft(null);
    setRawText('');
    setUrl('');
  }

  return (
    <div className="space-y-6">
      {!draft && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">New Ingest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="collection">Target Collection</Label>
              <Select
                value={collection}
                onValueChange={(v) => setCollection(v as CuratedCollection)}
              >
                <SelectTrigger id="collection" className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURATED_COLLECTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="font-mono text-xs mr-2">{c}</span>
                      <span className="text-muted-foreground">{COLLECTION_LABELS[c]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as SourceMode)}>
              <TabsList>
                <TabsTrigger value="text">Raw Text</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4 space-y-1.5">
                <Label htmlFor="rawText">Paste the content</Label>
                <Textarea
                  id="rawText"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste the raw content you want ingested into the vector DB..."
                  className="min-h-[240px] font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  {rawText.trim().length} chars (min {MIN_TEXT_LEN})
                </p>
              </TabsContent>

              <TabsContent value="url" className="mt-4 space-y-1.5">
                <Label htmlFor="url">Source URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=...  or  https://poewiki.net/wiki/..."
                />
                <p className="text-[11px] text-muted-foreground">
                  YouTube URLs → transcript via <code>youtube_transcript_api</code>.
                  Other URLs → HTML fetch + strip (works for wiki/blog/reddit;
                  SPAs may return empty shell — paste the text manually if so).
                </p>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button onClick={handleAnalyze} disabled={analyzing || !canSubmit}>
                {analyzing ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Analyzing...
                  </>
                ) : (
                  'Analyze'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Analysis Result</h3>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Start over
            </Button>
          </div>
          <DraftDetail draft={draft} onDraftUpdate={setDraft} />
        </div>
      )}
    </div>
  );
}
