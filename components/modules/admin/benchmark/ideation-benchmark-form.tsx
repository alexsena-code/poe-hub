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
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { IdeationBenchmarkRequest } from "@/lib/benchmark-types";

const ideationSchema = z.object({
  editorialBriefing: z.string().optional(),
  // Comma-separated list stored as string; parsed to string[] on submit.
  templateFilterRaw: z.string().optional(),
  modelOverride: z.string().optional(),
});

type IdeationFormValues = z.infer<typeof ideationSchema>;

interface IdeationBenchmarkFormProps {
  loading: boolean;
  onRun: (body: IdeationBenchmarkRequest) => void;
}

/**
 * Form for POST /api/engine/benchmark/ideation.
 * templateFilter is entered as comma-separated template names and parsed
 * to string[] before submission.
 */
export function IdeationBenchmarkForm({ loading, onRun }: IdeationBenchmarkFormProps) {
  const form = useForm<IdeationFormValues>({
    resolver: zodResolver(ideationSchema),
    defaultValues: { editorialBriefing: "", templateFilterRaw: "", modelOverride: "" },
  });

  function handleSubmit(values: IdeationFormValues) {
    const body: IdeationBenchmarkRequest = {};

    if (values.editorialBriefing?.trim()) {
      body.editorialBriefing = values.editorialBriefing.trim();
    }

    if (values.templateFilterRaw?.trim()) {
      body.templateFilter = values.templateFilterRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    if (values.modelOverride?.trim()) {
      body.modelOverride = values.modelOverride.trim();
    }

    onRun(body);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="editorialBriefing"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Editorial Briefing (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva o foco editorial para geração de ideias..."
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Contexto editorial livre para o gerador de ideias. Omitir usa o padrão do engine.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="templateFilterRaw"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template Filter (opcional, vírgula-separado)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: build_guide, league_starter" {...field} />
                </FormControl>
                <FormDescription>
                  Filtra geração para estes templates. Vazio = todos.
                </FormDescription>
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

        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading && <Spinner size="sm" className="mr-2" />}
          Run Ideation
        </Button>
      </form>
    </Form>
  );
}
