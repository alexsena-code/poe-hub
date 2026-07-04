"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Save } from "lucide-react";

interface CxParamRow {
  id: string;
  scope: string;
  scopeKey: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

export function ParamsPanel() {
  const [params, setParams] = useState<CxParamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form de upsert (também usado pra "editar": preencher com a linha)
  const [formScope, setFormScope] = useState("global");
  const [formScopeKey, setFormScopeKey] = useState("*");
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formPushTo, setFormPushTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cx/params");
      if (res.ok) {
        const json = await res.json();
        setParams(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function editRow(p: CxParamRow) {
    setFormScope(p.scope);
    setFormScopeKey(p.scopeKey);
    setFormKey(p.key);
    setFormValue(JSON.stringify(p.value));
  }

  async function save() {
    if (!formKey) {
      toast.error("Informe a chave");
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(formValue);
    } catch {
      // valor não-JSON vira string literal (conveniência: 0.05, "texto", true já parseiam)
      value = formValue;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cx/params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: formScope,
          scopeKey: formScopeKey || "*",
          key: formKey,
          value,
          ...(formPushTo ? { pushTo: formPushTo } : {}),
        }),
      });
      if (res.ok) {
        toast.success(
          formPushTo ? "Parâmetro salvo e push enfileirado" : "Parâmetro salvo"
        );
        load();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(`Falha ao salvar: ${err?.error ?? res.status}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Parâmetros</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-6">
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={formScope} onValueChange={setFormScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">global</SelectItem>
                <SelectItem value="executor">executor</SelectItem>
                <SelectItem value="item">item</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scope key</Label>
            <Input
              value={formScopeKey}
              onChange={(e) => setFormScopeKey(e.target.value)}
              placeholder="* / executorId / item"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Chave</Label>
            <Input
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
              placeholder="ex.: max_capital_div"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valor (JSON)</Label>
            <Input
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              placeholder='ex.: 0.5 ou {"a":1}'
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Push pro executor (opcional)</Label>
            <Input
              value={formPushTo}
              onChange={(e) => setFormPushTo(e.target.value)}
              placeholder="executorId"
              className="font-mono"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="mr-2 h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {params.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum parâmetro definido."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Scope key</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {params.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.scope}</TableCell>
                  <TableCell className="font-mono text-xs">{p.scopeKey}</TableCell>
                  <TableCell className="font-mono text-xs">{p.key}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[16rem] truncate">
                    {JSON.stringify(p.value)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(p.updatedAt).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => editRow(p)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
