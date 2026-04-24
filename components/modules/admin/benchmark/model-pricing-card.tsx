'use client';
/**
 * ModelPricingCard — renders live OpenRouter pricing for a given model id.
 *
 * Used by the benchmark form to preview the cost of the model the operator
 * is about to test, sourced from the hub's cached proxy route.
 *
 * @example
 * <ModelPricingCard modelId="moonshotai/kimi-k2-thinking" />
 */
import { Card, CardContent } from '@/components/ui/card';
import { useOpenRouterModel } from './use-openrouter-model';

interface ModelPricingCardProps {
  modelId: string;
}

function formatPrice(n: number): string {
  // Show up to 4 significant digits so "$0.0006" renders as "$0.0006" not "$0.00".
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card className="border-destructive">
      <CardContent className="pt-4">
        <p className="text-sm text-destructive">{message}</p>
      </CardContent>
    </Card>
  );
}

export function ModelPricingCard({ modelId }: ModelPricingCardProps) {
  const { model, isLoading, error } = useOpenRouterModel(modelId || null);

  // Empty modelId → render nothing; the form hasn't selected a model yet.
  if (!modelId) return null;

  if (isLoading) return <LoadingState />;

  if (error) {
    const isNotFound = error.message === 'NOT_FOUND';
    const message = isNotFound
      ? 'Model not found on OpenRouter'
      : `Failed to load model info: ${error.message}`;
    return <ErrorState message={message} />;
  }

  if (!model) return null;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm">{model.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{model.id}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-mono">
            <span>ctx={model.contextLength.toLocaleString('en-US')}</span>
            <span>{formatPrice(model.inputPricePer1M)}/1M in</span>
            <span>{formatPrice(model.outputPricePer1M)}/1M out</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
