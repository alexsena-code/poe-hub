"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";

const schema = z.object({
  slug: z
    .string()
    .min(2, "Slug deve ter pelo menos 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
});

type FormValues = z.infer<typeof schema>;

export function CreateBuildOverviewDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { slug: "" },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/sanity/build-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: values.slug }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erro ao criar build overview");
        return;
      }
      toast.success(`Build overview "${values.slug}" criado`);
      setOpen(false);
      form.reset();
      router.refresh();
    } catch {
      toast.error("Erro ao criar build overview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Build Overview</DialogTitle>
          <DialogDescription>
            O slug deve bater com o slug da build no Supabase.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ex: lightning-strike-trickster"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
