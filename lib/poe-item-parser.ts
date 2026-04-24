import type { PobItem, ParsedMod } from "@/lib/pob-types";

/**
 * Parser for the Path of Exile raw item clipboard format (Ctrl+C on an item).
 *
 * Port of poetrade-dev/lib/poe-item-parser.ts — identical logic, only the
 * import path for PobItem/ParsedMod is adjusted to the hub's lib/ location.
 *
 * Session 08.d.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROPERTY_PATTERN =
  /^(Item Level|Quality|Sockets|Requirements|Level|Str|Dex|Int|Armour|Evasion Rating|Energy Shield|Ward|Block Chance|Critical Strike Chance|Attacks per Second|Physical Damage|Elemental Damage|Fire Damage|Cold Damage|Lightning Damage|Chaos Damage|Weapon Range|Stack Size|Map Tier|Item Quantity|Item Rarity|Monster Pack Size|Flask Charges|Duration|Mana Recovered|Life Recovered|Charges per use|Capacity|Grants)[\s:]/i;

const FOOTER_KEYWORDS = new Set([
  "Corrupted",
  "Synthesised Item",
  "Fractured Item",
  "Mirrored",
  "Split",
  "Unidentified",
  "Veiled",
]);

const INFLUENCE_MAP: Record<string, string> = {
  "Shaper Item": "shaper",
  "Elder Item": "elder",
  "Crusader Item": "crusader",
  "Redeemer Item": "redeemer",
  "Hunter Item": "hunter",
  "Warlord Item": "warlord",
  "Searing Exarch Item": "searing",
  "Eater of Worlds Item": "eater",
};

function parseMod(text: string): { mod: ParsedMod; wasImplicit: boolean } {
  const wasImplicit = /\(implicit\)/i.test(text);
  const isEnchant = /\(enchant\)/i.test(text);
  const isCrafted = /\(crafted\)/i.test(text);
  const isFractured = /\(fractured\)/i.test(text);
  const isScourge = /\(scourge\)/i.test(text);

  const cleanText = text
    .replace(/\s*\((implicit|enchant|crafted|fractured|scourge)\)\s*$/i, "")
    .trim();

  let type: ParsedMod["type"] = "normal";
  if (isEnchant) type = "enchant";
  else if (isCrafted) type = "crafted";
  else if (isFractured) type = "fractured";
  else if (isScourge) type = "scourge";

  return { mod: { text: cleanText, type }, wasImplicit };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a PoE item rawText (game clipboard format) into a structured PobItem.
 * Returns null when the text is not recognisable as a PoE item block.
 *
 * @example
 * const item = parseRawPoeItem("Rarity: Currency\nChaos Orb\n--------\n...");
 */
export function parseRawPoeItem(raw: string): PobItem | null {
  if (!raw?.trim()) return null;

  const sections = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/^--------\s*$/m)
    .map((s) =>
      s
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .filter((s) => s.length > 0);

  if (!sections[0]?.length) return null;

  const header = sections[0];
  const rarityLine = header.find((l) => l.startsWith("Rarity:"));
  if (!rarityLine) return null;

  const rarity = rarityLine.replace("Rarity:", "").trim();
  const nonRarityLines = header.filter((l) => !l.startsWith("Rarity:"));

  let name = "";
  let baseName = "";

  if (rarity === "Unique" || rarity === "Rare") {
    name = nonRarityLines[0] ?? "";
    baseName = nonRarityLines[1] ?? name;
  } else {
    name = nonRarityLines[0] ?? "";
    baseName = name;
  }

  let itemLevel: number | undefined;
  let quality: number | undefined;
  let sockets: string | undefined;
  let armour: number | undefined;
  let evasion: number | undefined;
  let energyShield: number | undefined;
  let physDamage: [number, number] | undefined;
  let eleDamage: [number, number] | undefined;
  let chaosDamage: [number, number] | undefined;
  let critChance: number | undefined;
  let aps: number | undefined;
  let requiredLevel: number | undefined;
  let requiredStr: number | undefined;
  let requiredDex: number | undefined;
  let requiredInt: number | undefined;
  let corrupted = false;
  let mirrored = false;
  let split = false;
  let fractured = false;
  const influences: string[] = [];
  const modSections: string[][] = [];

  const parseInt0 = (s: string): number | undefined => {
    const n = parseInt(s.trim(), 10);
    return isNaN(n) ? undefined : n;
  };

  const parseFloat0 = (s: string): number | undefined => {
    const n = parseFloat(s.trim());
    return isNaN(n) ? undefined : n;
  };

  const stripAnnotations = (s: string): string =>
    s.replace(/\s*\((augmented|unmet|fractured|crafted)\)\s*/gi, "").trim();

  for (const section of sections.slice(1)) {
    const footerLines = section.filter(
      (l) => FOOTER_KEYWORDS.has(l) || INFLUENCE_MAP[l],
    );

    if (footerLines.length > 0) {
      if (section.includes("Corrupted")) corrupted = true;
      if (section.includes("Fractured Item")) fractured = true;
      if (section.includes("Mirrored")) mirrored = true;
      if (section.includes("Split")) split = true;
      for (const l of section) {
        if (INFLUENCE_MAP[l]) influences.push(INFLUENCE_MAP[l]);
      }
      continue;
    }

    if (section[0]?.startsWith("Requirements:")) {
      for (const line of section.slice(1)) {
        const bare = stripAnnotations(line);
        if (bare.startsWith("Level:")) {
          requiredLevel = parseInt0(bare.slice("Level:".length));
        } else if (bare.startsWith("Str:") || bare.startsWith("Strength:")) {
          requiredStr = parseInt0(bare.slice(bare.indexOf(":") + 1));
        } else if (bare.startsWith("Dex:") || bare.startsWith("Dexterity:")) {
          requiredDex = parseInt0(bare.slice(bare.indexOf(":") + 1));
        } else if (bare.startsWith("Int:") || bare.startsWith("Intelligence:")) {
          requiredInt = parseInt0(bare.slice(bare.indexOf(":") + 1));
        }
      }
      continue;
    }

    const modLines: string[] = [];
    for (const line of section) {
      if (line.startsWith("Item Level:")) {
        itemLevel = parseInt0(line.slice("Item Level:".length));
      } else if (line.startsWith("Quality:")) {
        const m = line.match(/\+?(\d+)%/);
        if (m) quality = parseInt(m[1]);
      } else if (line.startsWith("Sockets:")) {
        sockets = line.replace("Sockets:", "").trim();
      } else if (line.startsWith("Armour:")) {
        armour = extractLeadingNumber(stripAnnotations(line.slice("Armour:".length)));
      } else if (line.startsWith("Evasion Rating:")) {
        evasion = extractLeadingNumber(stripAnnotations(line.slice("Evasion Rating:".length)));
      } else if (line.startsWith("Energy Shield:")) {
        energyShield = extractLeadingNumber(stripAnnotations(line.slice("Energy Shield:".length)));
      } else if (line.startsWith("Physical Damage:")) {
        physDamage = extractDmgRange(line.slice("Physical Damage:".length)) ?? physDamage;
      } else if (line.startsWith("Elemental Damage:")) {
        eleDamage = sumDmgRanges(line.slice("Elemental Damage:".length)) ?? eleDamage;
      } else if (line.startsWith("Chaos Damage:")) {
        chaosDamage = extractDmgRange(line.slice("Chaos Damage:".length)) ?? chaosDamage;
      } else if (line.startsWith("Critical Strike Chance:")) {
        critChance = parseFloat0(line.replace("Critical Strike Chance:", "").replace("%", ""));
      } else if (line.startsWith("Attacks per Second:")) {
        aps = parseFloat0(line.slice("Attacks per Second:".length));
      } else if (!PROPERTY_PATTERN.test(line)) {
        modLines.push(line);
      }
    }

    if (modLines.length > 0) {
      modSections.push(modLines);
    }
  }

  const implicits: ParsedMod[] = [];
  const explicits: ParsedMod[] = [];

  if (modSections.length === 1) {
    for (const line of modSections[0]) {
      const { mod, wasImplicit } = parseMod(line);
      if (wasImplicit || /\(enchant\)/i.test(line)) {
        implicits.push(mod);
      } else {
        explicits.push(mod);
      }
    }
  } else if (modSections.length >= 2) {
    for (const line of modSections[0]) {
      implicits.push(parseMod(line).mod);
    }
    for (const section of modSections.slice(1)) {
      for (const line of section) {
        explicits.push(parseMod(line).mod);
      }
    }
  }

  return {
    slot: "",
    name,
    baseName,
    rarity,
    itemLevel,
    quality,
    sockets,
    armour,
    evasion,
    energyShield,
    physDamage,
    eleDamage,
    chaosDamage,
    critChance,
    aps,
    requiredLevel,
    requiredStr,
    requiredDex,
    requiredInt,
    corrupted,
    mirrored,
    split,
    fractured,
    influences: influences.length > 0 ? influences : undefined,
    implicits,
    explicits,
  };
}

// ─── Numeric helpers ──────────────────────────────────────────────────────────

function extractLeadingNumber(s: string): number | undefined {
  const m = s.trim().match(/(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return isNaN(n) ? undefined : Math.round(n);
}

function extractDmgRange(s: string): [number, number] | undefined {
  const m = s.trim().match(/(-?\d+)\s*-\s*(-?\d+)/);
  if (!m) return undefined;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

function sumDmgRanges(s: string): [number, number] | undefined {
  const ranges = s
    .split(",")
    .map((p) => extractDmgRange(p))
    .filter((r): r is [number, number] => !!r);
  if (!ranges.length) return undefined;
  return ranges.reduce<[number, number]>(
    (acc, r) => [acc[0] + r[0], acc[1] + r[1]],
    [0, 0],
  );
}
