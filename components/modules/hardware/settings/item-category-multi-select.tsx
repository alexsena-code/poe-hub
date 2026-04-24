"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { ITEM_CATEGORIES } from "./types";

interface ItemCategoryMultiSelectProps {
  value: string[];
  onChange: (val: string[]) => void;
}

export function ItemCategoryMultiSelect({ value, onChange }: ItemCategoryMultiSelectProps) {
  const toggle = (cat: string) => {
    onChange(value.includes(cat) ? value.filter((v) => v !== cat) : [...value, cat]);
  };

  const selectedLabels = value
    .map((v) => ITEM_CATEGORIES.find((c) => c.value === v)?.label || v)
    .join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[140px] justify-between text-xs font-normal"
        >
          <span className="truncate max-w-[160px]">
            {value.length === 0 ? "Todos" : selectedLabels}
          </span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {ITEM_CATEGORIES.map((cat) => (
            <label
              key={cat.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
            >
              <Checkbox
                checked={value.includes(cat.value)}
                onCheckedChange={() => toggle(cat.value)}
              />
              {cat.label}
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs text-muted-foreground"
            onClick={() => onChange([])}
          >
            Limpar (buscar todos)
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
