"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit2, Save, X, Trash2 } from "lucide-react";
import { formatPriceBrl, categoryLabel } from "./helpers";
import type { HardwareConfigItem, ManualPrice } from "./types";

interface ManualPricesTabProps {
  items: HardwareConfigItem[];
  manualPrices: ManualPrice[];
  onSaveManualPrice: (itemName: string, values: Partial<ManualPrice>) => void;
  onDeleteManualPrice: (itemName: string) => void;
  onDeleteItem: (itemId: number) => void;
}

/**
 * Manual Prices tab — inline-edit table for reference prices per item.
 * Editing state is local; save/delete bubble up to the page via callbacks
 * so the page can POST to the hardware API and re-fetch.
 */
export function ManualPricesTab({
  items,
  manualPrices,
  onSaveManualPrice,
  onDeleteManualPrice,
  onDeleteItem,
}: ManualPricesTabProps) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ManualPrice>>({});

  const startEditing = (item: HardwareConfigItem) => {
    const mp = manualPrices.find((p) => p.item_name === item.name);
    setEditingItem(item.name);
    setEditValues({
      price_new: mp?.price_new ?? null,
      price_aliexpress: mp?.price_aliexpress ?? null,
      price_reference: mp?.price_reference ?? null,
      notes: mp?.notes ?? "",
    });
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditValues({});
  };

  const handleSave = (itemName: string) => {
    onSaveManualPrice(itemName, editValues);
    setEditingItem(null);
    setEditValues({});
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground">
          Manual Reference Prices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>New Price</TableHead>
                <TableHead>AliExpress</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const mp = manualPrices.find((p) => p.item_name === item.name);
                const isEditing = editingItem === item.name;

                return (
                  <TableRow
                    key={item.name}
                    className="border-border hover:bg-foreground/5"
                  >
                    <TableCell className="font-medium text-card-foreground">
                      {item.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {categoryLabel(item.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          className="w-24 h-8 bg-background border-border"
                          defaultValue={mp?.price_new ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              price_new: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            }))
                          }
                        />
                      ) : (
                        <span className="text-sm">
                          {mp?.price_new ? formatPriceBrl(mp.price_new) : "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          className="w-24 h-8 bg-background border-border"
                          defaultValue={mp?.price_aliexpress ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              price_aliexpress: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            }))
                          }
                        />
                      ) : (
                        <span className="text-sm">
                          {mp?.price_aliexpress
                            ? formatPriceBrl(mp.price_aliexpress)
                            : "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          className="w-24 h-8 bg-background border-border"
                          defaultValue={mp?.price_reference ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              price_reference: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            }))
                          }
                        />
                      ) : (
                        <span className="text-sm">
                          {mp?.price_reference
                            ? formatPriceBrl(mp.price_reference)
                            : "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          className="w-32 h-8 bg-background border-border"
                          defaultValue={mp?.notes ?? ""}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              notes: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                          {mp?.notes || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSave(item.name)}
                            className="h-7 w-7 p-0"
                          >
                            <Save className="h-3.5 w-3.5 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEditing}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(item)}
                            className="h-7 w-7 p-0"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {mp && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteManualPrice(item.name)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteItem(item.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                            title="Delete item from DB"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
