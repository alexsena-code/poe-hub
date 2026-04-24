"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Power, Trash2 } from "lucide-react";
import { ItemCategoryMultiSelect } from "./item-category-multi-select";
import { SUGGESTED_CATEGORIES } from "./types";
import type { OlxCategory } from "./types";

interface CategoriesCardProps {
  categories: OlxCategory[];
  loading: boolean;
  newCatPath: string;
  setNewCatPath: (v: string) => void;
  newCatLabel: string;
  setNewCatLabel: (v: string) => void;
  newCatAllowed: string[];
  setNewCatAllowed: (v: string[]) => void;
  onAdd: (path: string, label: string, allowed?: string[]) => Promise<void>;
  onUpdateAllowed: (id: number, allowed: string[]) => Promise<void>;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function CategoriesCard({
  categories,
  loading,
  newCatPath,
  setNewCatPath,
  newCatLabel,
  setNewCatLabel,
  newCatAllowed,
  setNewCatAllowed,
  onAdd,
  onUpdateAllowed,
  onToggle,
  onDelete,
}: CategoriesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">OLX Search Categories</CardTitle>
        <CardDescription>
          Categories where the scraper searches for deals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <div className="flex gap-2 flex-wrap items-end">
          <Input
            placeholder="/path"
            value={newCatPath}
            onChange={(e) => setNewCatPath(e.target.value)}
            className="w-48"
          />
          <Input
            placeholder="Label"
            value={newCatLabel}
            onChange={(e) => setNewCatLabel(e.target.value)}
            className="w-48"
          />
          <ItemCategoryMultiSelect value={newCatAllowed} onChange={setNewCatAllowed} />
          <Button
            size="sm"
            disabled={!newCatPath.trim() || !newCatLabel.trim()}
            onClick={() => onAdd(newCatPath.trim(), newCatLabel.trim(), newCatAllowed)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Quick-add suggestions */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground self-center">Quick add:</span>
          {SUGGESTED_CATEGORIES.map((s) => {
            const exists = categories.some((c) => c.path === s.path);
            return (
              <Button
                key={s.path}
                variant="outline"
                size="sm"
                disabled={exists}
                className="text-xs"
                onClick={() => onAdd(s.path, s.label)}
              >
                {s.path}
              </Button>
            );
          })}
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No categories configured yet.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Tipos de Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-mono text-sm">{cat.path}</TableCell>
                    <TableCell>{cat.label}</TableCell>
                    <TableCell>
                      <ItemCategoryMultiSelect
                        value={cat.allowed_item_categories || []}
                        onChange={(val) => onUpdateAllowed(cat.id, val)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cat.is_active ? "default" : "secondary"}
                        className={cat.is_active ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {cat.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggle(cat.id)}
                          title={cat.is_active ? "Disable" : "Enable"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(cat.id)}
                          title="Delete"
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
