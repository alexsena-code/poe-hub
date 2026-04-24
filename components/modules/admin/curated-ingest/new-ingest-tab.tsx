'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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

export function NewIngestTab() {
  const [collection, setCollection] = useState<CuratedCollection>('poe_crafting');
  const [rawText, setRawText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<CuratedIngestDraft | null>(null);

  async function handleAnalyze() {
    if (rawText.trim().length < MIN_TEXT_LEN) {
      toast.error(
        `Raw text needs at least ${MIN_TEXT_LEN} characters (got ${rawText.trim().length}).`,
      );
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeDraft({
        rawText: rawText.trim(),
        targetCollection: collection,
      });
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

            <div className="space-y-1.5">
              <Label htmlFor="rawText">Raw Text</Label>
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
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleAnalyze}
                disabled={analyzing || rawText.trim().length < MIN_TEXT_LEN}
              >
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
