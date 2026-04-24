"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ModelPricingCard } from "./model-pricing-card";
import { PresetBar } from "./preset-bar";
import type { QaBenchmarkRequest } from "@/lib/benchmark-types";

const qaSchema = z.object({
  question: z.string().min(5, "Mínimo 5 caracteres"),
  queryType: z.string().optional(),
  language: z.enum(["pt", "en", "auto"]).default("auto"),
  modelOverride: z.string().optional(),
  modelOverrides: z.object({ write: z.string().optional() }).optional(),
});

type QaFormValues = z.infer<typeof qaSchema>;

interface QaBenchmarkFormProps {
  loading: boolean;
  onRun: (body: QaBenchmarkRequest, presetId?: string) => void;
}

/**
 * Form for the QA benchmark endpoint (POST /api/engine/benchmark/qa).
 * queryType is a free-text field because the set of valid values depends on
 * the engine config and is not static enough to enumerate here.
 */
export function QaBenchmarkForm({ loading, onRun }: QaBenchmarkFormProps) {
  const form = useForm<QaFormValues>({
    resolver: zodResolver(qaSchema),
    defaultValues: {
      question: "",
      queryType: "",
      language: "auto",
      modelOverride: "",
      modelOverrides: { write: "" },
    },
  });

  const modelOverride = form.watch("modelOverride");
  const writeOverride = form.watch("modelOverrides.write");

  function handleLoad(payload: unknown, presetId: string) {
    form.reset(payload as QaFormValues);
    // presetId forwarded via closure on next submit — stored in form state
    // by resetting so we can read it back in handleSubmit if needed.
    // The parent receives it through onRun's second argument.
    form.setValue("__presetId" as never, presetId as never);
  }

  function handleSubmit(values: QaFormValues) {
    const body: QaBenchmarkRequest = { question: values.question, language: values.language };
    if (values.queryType?.trim()) body.queryType = values.queryType.trim();
    if (values.modelOverride?.trim()) body.modelOverride = values.modelOverride.trim();
    if (values.modelOverrides?.write?.trim()) {
      (body as QaBenchmarkRequest & { modelOverrides?: Record<string, string> }).modelOverrides = {
        write: values.modelOverrides.write.trim(),
      };
    }
    // __presetId is a hidden field we stuffed in via setValue above (ignored by zod).
    const presetId = (form.getValues() as Record<string, unknown>)["__presetId"] as
      | string
      | undefined;
    onRun(body, presetId);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <PresetBar type="qa" currentValues={form.getValues()} onLoad={handleLoad} />

        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pergunta</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ex: What are the best flasks for RF Juggernaut?"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="queryType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Query Type (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: build_qa, league" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idioma</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="modelOverride"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Override global (todos os nodes)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: openai/gpt-4o" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {modelOverride && <ModelPricingCard modelId={modelOverride} />}

        <FormField
          control={form.control}
          name="modelOverrides.write"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Writer model (só aplica ao node <code>write</code>)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: anthropic/claude-opus-4-5" {...field} />
              </FormControl>
              <FormDescription>
                Isola a troca no <code>write</code> node sem afetar{" "}
                <code>critique</code>, <code>summarize</code>, etc.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {writeOverride && <ModelPricingCard modelId={writeOverride} />}

        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading && <Spinner size="sm" className="mr-2" />}
          Run QA
        </Button>
      </form>
    </Form>
  );
}
