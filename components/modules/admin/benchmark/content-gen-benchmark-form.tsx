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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ContentGenBenchmarkRequest } from "@/lib/benchmark-types";

// Essential Briefing fields only — full Briefing has many optional fields
// that are irrelevant for a quick benchmark run.
const contentGenSchema = z.object({
  skill: z.string().min(2, "Skill obrigatória"),
  ascendancy: z.string().min(2, "Ascendancy obrigatória"),
  topic: z.string().optional(),
  league: z.string().optional(),
  templateName: z.string().optional(),
  notes: z.string().optional(),
  modelOverride: z.string().optional(),
});

type ContentGenFormValues = z.infer<typeof contentGenSchema>;

interface ContentGenBenchmarkFormProps {
  loading: boolean;
  elapsedSeconds: number;
  onRun: (body: ContentGenBenchmarkRequest) => void;
}

/**
 * Form for POST /api/engine/benchmark/content-generation.
 * This endpoint runs the full content pipeline (60-180s) — shows elapsed
 * seconds in the button to give feedback during the long wait.
 */
export function ContentGenBenchmarkForm({
  loading,
  elapsedSeconds,
  onRun,
}: ContentGenBenchmarkFormProps) {
  const form = useForm<ContentGenFormValues>({
    resolver: zodResolver(contentGenSchema),
    defaultValues: {
      skill: "",
      ascendancy: "",
      topic: "",
      league: "",
      templateName: "",
      notes: "",
      modelOverride: "",
    },
  });

  function handleSubmit(values: ContentGenFormValues) {
    const body: ContentGenBenchmarkRequest = {
      briefing: {
        skill: values.skill,
        ascendancy: values.ascendancy,
      },
    };

    if (values.topic?.trim()) body.briefing.topic = values.topic.trim();
    if (values.league?.trim()) body.briefing.league = values.league.trim();
    if (values.templateName?.trim()) body.briefing.templateName = values.templateName.trim();
    if (values.notes?.trim()) body.briefing.notes = values.notes.trim();
    if (values.modelOverride?.trim()) body.modelOverride = values.modelOverride.trim();

    onRun(body);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          Este endpoint executa a pipeline completa de content generation.
          Tempo esperado: <span className="font-semibold">60-180s</span>. Timeout configurado para 200s.
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="skill"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Skill *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Righteous Fire" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ascendancy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ascendancy *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Juggernaut" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: budget league starter" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="league"
            render={({ field }) => (
              <FormItem>
                <FormLabel>League (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Settlers of Kalguur" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="templateName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: build_guide" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="modelOverride"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model Override (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: openai/gpt-4o" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes / contexto adicional (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Informações extras para o writer..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Equivale ao campo notes do Briefing — texto livre que o writer usa como contexto.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Gerando... {elapsedSeconds > 0 && `(${elapsedSeconds}s)`}
            </>
          ) : (
            "Run Content Generation"
          )}
        </Button>
      </form>
    </Form>
  );
}
