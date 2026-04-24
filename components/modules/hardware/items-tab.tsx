"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Edit2,
  Save,
  X,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Monitor, Cpu, MemoryStick, Package } from "lucide-react";
import {
  formatPriceBrl,
  categoryLabel,
  generateKeywords,
  specsFieldsForCategory,
} from "./helpers";
import type { HardwareConfigItem } from "./types";

interface ItemsTabProps {
  items: HardwareConfigItem[];
  scrapingItemId: number | null;
  onSaveItem: (
    payload: Omit<HardwareConfigItem, "id">,
    editingId: number | null
  ) => void;
  onDeleteItem: (itemId: number) => void;
  onScrapeItem: (itemId: number, itemName: string) => void;
  // Called from Store tab when "Add Item" is clicked on a product.
  // The parent passes down a pre-filled form state via this ref-like callback.
  prefillRef?: React.MutableRefObject<((values: PrefilledItemValues) => void) | null>;
}

export interface PrefilledItemValues {
  name: string;
  category: string;
  maxPrice: string;
  keywords: string[];
  specs: Record<string, string>;
  scrapeEnabled: boolean;
}

function categoryIcon(cat: string) {
  switch (cat) {
    case "gpu":
      return <Monitor className="h-4 w-4" />;
    case "cpu-kit":
      return <Cpu className="h-4 w-4" />;
    case "ram":
      return <MemoryStick className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

/**
 * Items tab — CRUD for hardware config items (the items the scraper tracks).
 * Form state is local; save/delete bubble up via callbacks.
 * The prefillRef allows the Store tab to populate this form programmatically
 * when the operator clicks "Add Item" on a store product.
 */
export function ItemsTab({
  items,
  scrapingItemId,
  onSaveItem,
  onDeleteItem,
  onScrapeItem,
  prefillRef,
}: ItemsTabProps) {
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingConfigItem, setEditingConfigItem] =
    useState<HardwareConfigItem | null>(null);
  const [itemFormName, setItemFormName] = useState("");
  const [itemFormCategory, setItemFormCategory] = useState("gpu");
  const [itemFormMaxPrice, setItemFormMaxPrice] = useState("");
  const [itemFormKeywords, setItemFormKeywords] = useState<string[]>([]);
  const [itemFormKeywordInput, setItemFormKeywordInput] = useState("");
  const [itemFormSpecs, setItemFormSpecs] = useState<Record<string, string>>({});
  const [itemFormScrapeEnabled, setItemFormScrapeEnabled] = useState(true);
  const [showSpecs, setShowSpecs] = useState(false);

  const resetItemForm = () => {
    setItemFormName("");
    setItemFormCategory("gpu");
    setItemFormMaxPrice("");
    setItemFormKeywords([]);
    setItemFormKeywordInput("");
    setItemFormSpecs({});
    setItemFormScrapeEnabled(true);
    setShowSpecs(false);
    setEditingConfigItem(null);
  };

  // Expose prefill function to the Store tab via ref.
  if (prefillRef) {
    prefillRef.current = (values: PrefilledItemValues) => {
      resetItemForm();
      setItemFormName(values.name);
      setItemFormCategory(values.category);
      setItemFormMaxPrice(values.maxPrice);
      setItemFormKeywords(values.keywords);
      setItemFormScrapeEnabled(values.scrapeEnabled);
      if (Object.keys(values.specs).length > 0) {
        setItemFormSpecs(values.specs);
        setShowSpecs(true);
      }
      setShowItemForm(true);
    };
  }

  const handleItemFormNameChange = (name: string) => {
    setItemFormName(name);
    // Auto-generate keywords only for new items, not edits.
    if (!editingConfigItem) {
      setItemFormKeywords(generateKeywords(name));
    }
  };

  const handleAddKeyword = () => {
    const kw = itemFormKeywordInput.trim().toLowerCase();
    if (kw && !itemFormKeywords.includes(kw)) {
      setItemFormKeywords([...itemFormKeywords, kw]);
    }
    setItemFormKeywordInput("");
  };

  const handleRemoveKeyword = (kw: string) => {
    setItemFormKeywords(itemFormKeywords.filter((k) => k !== kw));
  };

  const handleSaveItem = () => {
    const specs: Record<string, number | string> = {};
    for (const [key, val] of Object.entries(itemFormSpecs)) {
      if (val.trim()) {
        const num = parseFloat(val);
        specs[key] = isNaN(num) ? val.trim() : num;
      }
    }
    onSaveItem(
      {
        name: itemFormName.trim(),
        category: itemFormCategory,
        max_price: parseFloat(itemFormMaxPrice),
        keywords: itemFormKeywords,
        specs,
        scrape_enabled: itemFormScrapeEnabled,
      },
      editingConfigItem?.id ?? null
    );
    resetItemForm();
    setShowItemForm(false);
  };

  const handleEditConfigItem = (item: HardwareConfigItem) => {
    setEditingConfigItem(item);
    setItemFormName(item.name);
    setItemFormCategory(item.category);
    setItemFormMaxPrice(String(item.max_price));
    setItemFormKeywords(item.keywords || []);
    setItemFormSpecs(
      Object.fromEntries(
        Object.entries(item.specs || {}).map(([k, v]) => [k, String(v)])
      )
    );
    setShowSpecs(Object.keys(item.specs || {}).length > 0);
    setItemFormScrapeEnabled(item.scrape_enabled !== false);
    setShowItemForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Add Item button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            if (showItemForm && !editingConfigItem) {
              setShowItemForm(false);
            } else {
              resetItemForm();
              setShowItemForm(true);
            }
          }}
          className="bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </div>

      {/* Add/Edit form */}
      {showItemForm && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-card-foreground">
              {editingConfigItem
                ? `Edit: ${editingConfigItem.name}`
                : "Add New Item"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Item Name</label>
                <Input
                  placeholder="e.g. RTX 3060 12GB"
                  value={itemFormName}
                  onChange={(e) => handleItemFormNameChange(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Category</label>
                <Select
                  value={itemFormCategory}
                  onValueChange={setItemFormCategory}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpu">GPU</SelectItem>
                    <SelectItem value="cpu-kit">CPU Kit</SelectItem>
                    <SelectItem value="ram">RAM</SelectItem>
                    <SelectItem value="psu">PSU (Fonte)</SelectItem>
                    <SelectItem value="ssd">SSD</SelectItem>
                    <SelectItem value="motherboard">Placa Mae</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Max Price (R$)</label>
                <Input
                  type="number"
                  placeholder="e.g. 1500"
                  value={itemFormMaxPrice}
                  onChange={(e) => setItemFormMaxPrice(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Keywords</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {itemFormKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs gap-1 pr-1">
                    {kw}
                    <button
                      onClick={() => handleRemoveKeyword(kw)}
                      className="ml-0.5 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {itemFormKeywords.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Type an item name above to auto-generate keywords
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom keyword..."
                  value={itemFormKeywordInput}
                  onChange={(e) => setItemFormKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  className="bg-background border-border flex-1 max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddKeyword}
                  className="border-border"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Specs (collapsible) */}
            <div className="space-y-1.5">
              <button
                onClick={() => setShowSpecs(!showSpecs)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSpecs ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Specs (optional)
              </button>
              {showSpecs && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  {specsFieldsForCategory(
                    itemFormCategory,
                    Object.keys(itemFormSpecs)
                  ).map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        {field.label}
                      </label>
                      <Input
                        placeholder={field.label}
                        value={itemFormSpecs[field.key] || ""}
                        onChange={(e) =>
                          setItemFormSpecs((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="bg-background border-border h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scrape toggle */}
            <div className="flex items-center gap-2 pt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemFormScrapeEnabled}
                  onChange={(e) => setItemFormScrapeEnabled(e.target.checked)}
                  className="rounded border-border"
                />
                Enable scraping for this item
              </label>
              <span className="text-xs text-muted-foreground">
                (disable for manual-price-only items like PSU, SSD)
              </span>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={handleSaveItem}
                className="bg-primary text-primary-foreground"
              >
                <Save className="h-4 w-4 mr-1" />
                {editingConfigItem ? "Update Item" : "Save Item"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetItemForm();
                  setShowItemForm(false);
                }}
                className="border-border"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-card-foreground">
            {items.length} items configured
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Max Price</TableHead>
                  <TableHead>Specs</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No items configured. Add one to start tracking deals.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="border-border hover:bg-foreground/5"
                    >
                      <TableCell className="font-medium text-card-foreground">
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {categoryIcon(item.category)}
                          <Badge variant="outline" className="text-xs">
                            {categoryLabel(item.category)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[250px]">
                          {(item.keywords || []).map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                          {(!item.keywords || item.keywords.length === 0) && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {formatPriceBrl(item.max_price)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {Object.entries(item.specs || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ") || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditConfigItem(item)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onScrapeItem(item.id, item.name)}
                            disabled={scrapingItemId === item.id}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-green-400"
                            title="Scrape this item"
                          >
                            {scrapingItemId === item.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Search className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteItem(item.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
