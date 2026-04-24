// Stitches the structured brief (rationale + expanded briefing + keywords)
// with the user's free-form notes into a single Briefing.notes payload.
// User notes come last as "Additional guidance" — writers are told to
// treat them as addenda, not to replace the structured context.

export interface BriefData {
  title: string;
  titleEn: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  cluster: string | null;
  rationale: string;
  briefingText: string | null;
  effort: string;
  urgency: string;
  score: number;
}

/**
 * Assembles a markdown string from the SEO brief + editor addenda.
 * The structured block always precedes user notes so the LLM treats
 * editor addenda as higher-priority refinements.
 *
 * @example
 * const notes = buildStitchedNotes(brief, "Foque no público casual");
 */
export function buildStitchedNotes(brief: BriefData, userNotes: string): string {
  const parts: string[] = [
    `## Content Brief`,
    `Title (PT-BR): ${brief.title}`,
    brief.titleEn ? `Title (EN): ${brief.titleEn}` : '',
    `Primary Keyword: ${brief.primaryKeyword}`,
    brief.secondaryKeywords.length > 0
      ? `Secondary Keywords: ${brief.secondaryKeywords.join(', ')}`
      : '',
    brief.cluster ? `Cluster/Theme: ${brief.cluster}` : '',
    '',
    `## Why This Topic`,
    brief.rationale,
    '',
  ];

  if (brief.briefingText) {
    parts.push(`## Expanded Briefing`, brief.briefingText, '');
  }

  parts.push(
    `## Editorial Guidance`,
    `Effort Level: ${brief.effort}`,
    `Urgency: ${brief.urgency}`,
    `Priority Score: ${brief.score}/100`,
  );

  const trimmed = userNotes.trim();
  if (trimmed) {
    parts.push('', `## Additional guidance from the editor`, trimmed);
  }

  return parts.filter((p) => p !== null && p !== undefined).join('\n');
}
