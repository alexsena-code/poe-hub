"use client";

/**
 * Simplified inline PoE item card for the hub's preview pane.
 *
 * Port of poetrade-dev/components/poe/PoeItemBlogCard.tsx — adapted to:
 *   - Not depend on poetrade-dev's SmartTooltip / ItemTooltip / GemTooltip /
 *     CurrencyTooltip (those pull in heavy poe.ninja data dependencies).
 *   - Use shadcn/ui Tooltip primitives instead.
 *   - Keep the same inline visual: icon + name coloured by rarity.
 *   - Tooltip shows a simple stat block derived from parseRawPoeItem.
 *
 * Three tooltip variants are rendered:
 *   - currency/fragment: icon + description lines
 *   - gem: gem name header (coloured by attribute) + stat lines
 *   - item (unique/rare): name + base + explicit mods
 *
 * Session 08.d.
 */

import React, { useMemo } from "react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseRawPoeItem } from "@/lib/poe-item-parser";

// ─── Rarity colour map ────────────────────────────────────────────────────────

const RARITY_HSL: Record<string, string> = {
  Unique: "25, 65%, 42%",
  Rare: "60, 100%, 73%",
  Magic: "240, 100%, 77%",
  Normal: "0, 0%, 78%",
  Gem: "176, 71%, 37%",
  Currency: "40, 22%, 60%",
  Notable: "45, 85%, 62%",
  Keystone: "45, 85%, 62%",
  Ascendancy: "280, 70%, 60%",
  Passive: "45, 85%, 62%",
};

const GEM_ATTRIBUTE_COLOR: Record<string, string> = {
  Strength: "#e87474",
  Dexterity: "#7ce074",
  Intelligence: "#7ec3ff",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoeItemCardValue {
  _type: "poeItem";
  rawText: string;
  iconUrl?: string | null;
  isCurrency?: boolean;
  isGem?: boolean;
  primaryAttribute?: "Strength" | "Dexterity" | "Intelligence" | null;
  isAwakened?: boolean;
  isVaal?: boolean;
  itemName?: string;
}

// ─── Tooltip bodies ──────────────────────────────────────────────────────────

function CurrencyTooltipBody({
  rawText,
  iconUrl,
  name,
}: {
  rawText: string;
  iconUrl: string | null;
  name: string;
}) {
  // Currency rawText is just the description lines after the header
  const descLines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Rarity:") && l !== name);

  return (
    <div className="flex flex-col items-center gap-2 p-2 max-w-xs">
      {iconUrl && (
        <Image
          src={iconUrl}
          alt={name}
          width={48}
          height={48}
          className="object-contain"
          unoptimized
        />
      )}
      <p className="text-center font-semibold text-sm" style={{ color: `hsl(${RARITY_HSL.Currency})` }}>
        {name}
      </p>
      {descLines.slice(0, 6).map((line, i) => (
        <p key={i} className="text-xs text-zinc-300 text-center leading-tight">
          {line}
        </p>
      ))}
    </div>
  );
}

function GemTooltipBody({
  name,
  primaryAttribute,
  isAwakened,
  isVaal,
  rawText,
}: {
  name: string;
  primaryAttribute?: "Strength" | "Dexterity" | "Intelligence" | null;
  isAwakened?: boolean;
  isVaal?: boolean;
  rawText: string;
}) {
  const headerColor = isAwakened
    ? "#cf996a"
    : isVaal
      ? "#7ce074"
      : primaryAttribute
        ? GEM_ATTRIBUTE_COLOR[primaryAttribute]
        : "#7ec3ff";

  const statLines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("Rarity:") && l !== name)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-1 p-2 max-w-xs">
      <p className="font-bold text-sm" style={{ color: headerColor }}>
        {name}
      </p>
      {statLines.map((line, i) => (
        <p key={i} className="text-xs" style={{ color: `hsl(${RARITY_HSL.Magic})` }}>
          {line}
        </p>
      ))}
    </div>
  );
}

function ItemTooltipBody({
  name,
  rarity,
  rawText,
}: {
  name: string;
  rarity: string;
  rawText: string;
}) {
  const parsed = parseRawPoeItem(rawText);
  const rarityHsl = RARITY_HSL[rarity] ?? RARITY_HSL.Normal;

  return (
    <div className="flex flex-col gap-1 p-2 max-w-xs">
      <p className="font-bold text-sm" style={{ color: `hsl(${rarityHsl})` }}>
        {name}
      </p>
      {parsed?.baseName && parsed.baseName !== name && (
        <p className="text-xs text-zinc-400">{parsed.baseName}</p>
      )}
      {parsed?.implicits.slice(0, 3).map((m, i) => (
        <p key={`imp-${i}`} className="text-xs" style={{ color: `hsl(${RARITY_HSL.Magic})` }}>
          {m.text}
        </p>
      ))}
      {parsed?.explicits.slice(0, 6).map((m, i) => (
        <p key={`exp-${i}`} className="text-xs" style={{ color: `hsl(${RARITY_HSL.Magic})` }}>
          {m.text}
        </p>
      ))}
      {parsed?.corrupted && (
        <p className="text-xs text-red-400">Corrupted</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Inline item chip with hover tooltip. Used by the poeItem mark handler in
 * portable-text-components.tsx.
 *
 * @example
 * <PoeItemCard value={{ _type: 'poeItem', rawText: '...', isCurrency: true }} />
 */
export function PoeItemCard({ value }: { value: PoeItemCardValue }) {
  const item = useMemo(() => parseRawPoeItem(value.rawText), [value.rawText]);
  if (!item) return null;

  const iconUrl = value.iconUrl ?? item.iconUrl ?? null;
  const rarityHsl = RARITY_HSL[item.rarity] ?? RARITY_HSL.Normal;

  const gemNameColor = value.isGem
    ? (value.isAwakened
        ? "#cf996a"
        : value.isVaal
          ? "#7ce074"
          : value.primaryAttribute
            ? GEM_ATTRIBUTE_COLOR[value.primaryAttribute]
            : "#7ec3ff")
    : null;

  const tooltipBody = value.isGem ? (
    <GemTooltipBody
      name={item.name}
      primaryAttribute={value.primaryAttribute}
      isAwakened={value.isAwakened}
      isVaal={value.isVaal}
      rawText={value.rawText}
    />
  ) : value.isCurrency ? (
    <CurrencyTooltipBody
      rawText={value.rawText}
      iconUrl={iconUrl}
      name={item.name}
    />
  ) : (
    <ItemTooltipBody name={item.name} rarity={item.rarity} rawText={value.rawText} />
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="not-prose inline-flex items-center cursor-pointer gap-1.5 align-middle"
            role="button"
            tabIndex={0}
          >
            {iconUrl && (
              <span className="relative inline-block shrink-0" style={{ width: "1.7em", height: "1.7em" }}>
                <Image
                  src={iconUrl}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-contain"
                  unoptimized
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              </span>
            )}
            <span
              className="font-semibold"
              style={{ color: gemNameColor ?? `hsl(${rarityHsl})` }}
            >
              {item.name}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-zinc-900 border border-zinc-700 text-zinc-100 shadow-xl p-0 min-w-[180px]"
        >
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
