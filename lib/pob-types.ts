/**
 * Public types for PoB item data used in the preview pane.
 *
 * Port of poetrade-dev/lib/pob-types.ts — only the types needed by
 * lib/poe-item-parser.ts and components/editor/preview/poe-item-card.tsx.
 *
 * Session 08.d.
 */

export interface ParsedMod {
  text: string;
  type: "normal" | "crafted" | "fractured" | "enchant" | "scourge";
}

export interface PobItem {
  slot: string;
  name: string;
  baseName: string;
  rarity: string;
  sockets?: string;
  quality?: number;
  itemLevel?: number;
  armour?: number;
  evasion?: number;
  energyShield?: number;
  physDamage?: [number, number];
  eleDamage?: [number, number];
  chaosDamage?: [number, number];
  critChance?: number;
  aps?: number;
  requiredLevel?: number;
  requiredStr?: number;
  requiredDex?: number;
  requiredInt?: number;
  corrupted?: boolean;
  mirrored?: boolean;
  split?: boolean;
  fractured?: boolean;
  influences?: string[];
  implicits: ParsedMod[];
  explicits: ParsedMod[];
  iconUrl?: string;
}
