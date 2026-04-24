"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SpecFilters } from "./use-store-filters";
import type { StoreCategory } from "./types";

interface SpecFiltersProps {
  category: StoreCategory;
  specs: SpecFilters;
  specOptions: {
    vram_gb: string[];
    capacity_gb: string[];
    wattage: string[];
    socket: string[];
    memory_type: string[];
    panel: string[];
    refresh_rate: string[];
    resolution: string[];
    form_factor: string[];
    efficiency: string[];
    manufacturer: string[];
    base_model: string[];
  };
  onSetSpec: (key: keyof SpecFilters, value: string) => void;
}

function SpecSelect({
  value,
  onValueChange,
  placeholder,
  width,
  allLabel,
  options,
  renderOption,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  width: string;
  allLabel: string;
  options: string[];
  renderOption?: (v: string) => React.ReactNode;
}) {
  return (
    <Select
      value={value || "__all__"}
      onValueChange={(v) => onValueChange(v === "__all__" ? "" : v)}
    >
      <SelectTrigger className={`${width} border-border text-sm`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{allLabel}</SelectItem>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {renderOption ? renderOption(v) : v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Renders all category-conditional spec filter selects as a flat list of fragments.
 * Only selects with >1 option and matching category are shown — mirrors original behavior.
 */
export function SpecFilters({ category, specs, specOptions, onSetSpec }: SpecFiltersProps) {
  return (
    <>
      {specOptions.manufacturer.length > 1 && (
        <SpecSelect
          value={specs.manufacturer}
          onValueChange={(v) => onSetSpec("manufacturer", v)}
          placeholder="Brand"
          width="w-32"
          allLabel="All Brands"
          options={specOptions.manufacturer}
        />
      )}
      {specOptions.base_model.length > 1 && (
        <SpecSelect
          value={specs.baseModel}
          onValueChange={(v) => onSetSpec("baseModel", v)}
          placeholder="Model"
          width="w-36"
          allLabel="All Models"
          options={specOptions.base_model}
        />
      )}
      {specOptions.vram_gb.length > 1 && category === "gpu" && (
        <SpecSelect
          value={specs.vram}
          onValueChange={(v) => onSetSpec("vram", v)}
          placeholder="VRAM"
          width="w-28"
          allLabel="All VRAM"
          options={specOptions.vram_gb}
          renderOption={(v) => `${v} GB`}
        />
      )}
      {specOptions.capacity_gb.length > 1 && (category === "ram" || category === "ssd") && (
        <SpecSelect
          value={specs.capacity}
          onValueChange={(v) => onSetSpec("capacity", v)}
          placeholder="Capacity"
          width="w-28"
          allLabel="All Sizes"
          options={specOptions.capacity_gb}
          renderOption={(v) =>
            Number(v) >= 1000 ? `${Number(v) / 1000} TB` : `${v} GB`
          }
        />
      )}
      {specOptions.memory_type.length > 1 && (category === "ram" || category === "motherboard") && (
        <SpecSelect
          value={specs.memType}
          onValueChange={(v) => onSetSpec("memType", v)}
          placeholder="DDR"
          width="w-24"
          allLabel="All DDR"
          options={specOptions.memory_type}
        />
      )}
      {specOptions.socket.length > 1 && (category === "cpu" || category === "motherboard") && (
        <SpecSelect
          value={specs.socket}
          onValueChange={(v) => onSetSpec("socket", v)}
          placeholder="Socket"
          width="w-28"
          allLabel="All Sockets"
          options={specOptions.socket}
        />
      )}
      {specOptions.form_factor.length > 1 && (category === "motherboard" || category === "ssd") && (
        <SpecSelect
          value={specs.formFactor}
          onValueChange={(v) => onSetSpec("formFactor", v)}
          placeholder="Form"
          width="w-28"
          allLabel="All Forms"
          options={specOptions.form_factor}
        />
      )}
      {specOptions.wattage.length > 1 && category === "psu" && (
        <SpecSelect
          value={specs.wattage}
          onValueChange={(v) => onSetSpec("wattage", v)}
          placeholder="Watts"
          width="w-28"
          allLabel="All Watts"
          options={specOptions.wattage}
          renderOption={(v) => `${v} W`}
        />
      )}
      {specOptions.efficiency.length > 1 && category === "psu" && (
        <SpecSelect
          value={specs.efficiency}
          onValueChange={(v) => onSetSpec("efficiency", v)}
          placeholder="Efficiency"
          width="w-32"
          allLabel="All"
          options={specOptions.efficiency}
        />
      )}
      {specOptions.panel.length > 1 && category === "monitor" && (
        <SpecSelect
          value={specs.panel}
          onValueChange={(v) => onSetSpec("panel", v)}
          placeholder="Panel"
          width="w-24"
          allLabel="All"
          options={specOptions.panel}
        />
      )}
      {specOptions.resolution.length > 1 && category === "monitor" && (
        <SpecSelect
          value={specs.resolution}
          onValueChange={(v) => onSetSpec("resolution", v)}
          placeholder="Res"
          width="w-24"
          allLabel="All"
          options={specOptions.resolution}
        />
      )}
      {specOptions.refresh_rate.length > 1 && category === "monitor" && (
        <SpecSelect
          value={specs.refresh}
          onValueChange={(v) => onSetSpec("refresh", v)}
          placeholder="Hz"
          width="w-24"
          allLabel="All Hz"
          options={specOptions.refresh_rate}
          renderOption={(v) => `${v} Hz`}
        />
      )}
    </>
  );
}
