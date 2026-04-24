import { describe, it, expect } from 'vitest';
import { buildStitchedNotes, type BriefData } from './stitch-notes';

function makeBrief(overrides: Partial<BriefData> = {}): BriefData {
  return {
    title: 'Guia de RF',
    titleEn: 'Righteous Fire Guide',
    primaryKeyword: 'righteous fire',
    secondaryKeywords: ['rf chieftain', 'endgame rf'],
    cluster: 'fire builds',
    rationale: 'Muito buscado na liga.',
    briefingText: 'Texto expandido do brief.',
    effort: 'medium',
    urgency: 'high',
    score: 85,
    ...overrides,
  };
}

describe('buildStitchedNotes', () => {
  it('includes all core sections with base brief', () => {
    const result = buildStitchedNotes(makeBrief(), '');
    expect(result).toContain('## Content Brief');
    expect(result).toContain('Title (PT-BR): Guia de RF');
    expect(result).toContain('Title (EN): Righteous Fire Guide');
    expect(result).toContain('Primary Keyword: righteous fire');
    expect(result).toContain('Secondary Keywords: rf chieftain, endgame rf');
    expect(result).toContain('Cluster/Theme: fire builds');
    expect(result).toContain('## Why This Topic');
    expect(result).toContain('Muito buscado na liga.');
    expect(result).toContain('## Expanded Briefing');
    expect(result).toContain('Texto expandido do brief.');
    expect(result).toContain('## Editorial Guidance');
    expect(result).toContain('Priority Score: 85/100');
  });

  it('appends user notes as Additional guidance when provided', () => {
    const result = buildStitchedNotes(makeBrief(), 'Foque no público casual de 15 div/hora');
    expect(result).toContain('## Additional guidance from the editor');
    expect(result).toContain('Foque no público casual de 15 div/hora');
  });

  it('does NOT include Additional guidance section when userNotes is empty', () => {
    const result = buildStitchedNotes(makeBrief(), '');
    expect(result).not.toContain('## Additional guidance');
  });

  it('does NOT include Additional guidance section when userNotes is whitespace-only', () => {
    const result = buildStitchedNotes(makeBrief(), '   \n  ');
    expect(result).not.toContain('## Additional guidance');
  });

  it('omits Expanded Briefing section when briefingText is null', () => {
    const result = buildStitchedNotes(makeBrief({ briefingText: null }), '');
    expect(result).not.toContain('## Expanded Briefing');
    // Core sections still present
    expect(result).toContain('## Editorial Guidance');
  });

  it('omits Secondary Keywords line when array is empty', () => {
    const result = buildStitchedNotes(makeBrief({ secondaryKeywords: [] }), '');
    expect(result).not.toContain('Secondary Keywords');
  });

  it('omits Cluster line when cluster is null', () => {
    const result = buildStitchedNotes(makeBrief({ cluster: null }), '');
    expect(result).not.toContain('Cluster/Theme');
  });

  it('omits titleEn line when titleEn is empty string', () => {
    const result = buildStitchedNotes(makeBrief({ titleEn: '' }), '');
    expect(result).not.toContain('Title (EN)');
  });

  it('places user notes AFTER editorial guidance (correct ordering)', () => {
    const result = buildStitchedNotes(makeBrief(), 'minha nota');
    const guidanceIdx = result.indexOf('## Editorial Guidance');
    const addendaIdx = result.indexOf('## Additional guidance');
    expect(guidanceIdx).toBeLessThan(addendaIdx);
  });
});
