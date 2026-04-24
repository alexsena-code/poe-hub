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
import type { QaBenchmarkRequest } from "@/lib/benchmark-types";

const qaSchema = z.object({
  question: z.string().min(5, "Mínimo 5 caracteres"),
  queryType: z.string().optional(),
  language: z.enum(["pt", "en", "auto"]).default("auto"),
  modelOverride: z.string().optional(),
});

type QaFormValues = z.infer<typeof qaSchema>;

interface QaBenchmarkFormProps {
  loading: boolean;
  onRun: (body: QaBenchmarkRequest) => void;
}

/**
 * Form for the QA benchmark endpoint (POST /api/engine/benchmark/qa).
 * queryType is a free-text field because the set of valid values depends on
 * the engine config and is not static enough to enumerate here.
 */
export function QaBenchmarkForm({ loading, onRun }: QaBenchmarkFormProps) {
  const form = useForm<QaFormValues>({
    resolver: zodResolver(qaSchema),
    defaultValues: { question: "", queryType: "", language: "auto", modelOverride: "" },
  });

  function handleSubmit(values: QaFormValues) {
    const body: QaBenchmarkRequest = {
      question: values.question,
      language: values.language,
    };
    if (values.queryType?.trim()) body.queryType = values.queryType.trim();
    if (values.modelOverride?.trim()) body.modelOverride = values.modelOverride.trim();
    onRun(body);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
          Run QA
        </Button>
      </form>
    </Form>
  );
}
