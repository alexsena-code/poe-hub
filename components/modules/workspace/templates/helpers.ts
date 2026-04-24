/** Pure conversion/factory functions for workspace/templates. No side effects. */

import type { Template, TemplateSection } from './types';

/** Convert API YAML shape → frontend Template shape */
export function apiToTemplate(data: Record<string, unknown>): Template {
  const t = (data.template as Record<string, unknown>) || {};
  const rawLength = String(
    (t.target_length_words as string | undefined) ?? '2000',
  );
  const targetWordCount = parseInt(rawLength.split('-').pop() ?? '2000', 10);

  const sections = ((data.sections as unknown[]) || []).map((raw) => {
    const s = raw as Record<string, unknown>;
    return {
      id: String(s.id ?? ''),
      title: String(s.title ?? ''),
      instruction: String(s.instruction ?? ''),
      queryType: String(s.query_type ?? 'qa'),
      ragQueries: (s.rag_queries as string[]) ?? [],
      maxTokens: Number(s.max_tokens ?? 0),
      requiresHumanInput:
        s.requires_human_input === true ||
        s.requires_human_input === 'recommended',
    };
  });

  const seoRaw = (data.seo as Record<string, unknown>) ?? {};

  return {
    name: String(t.name ?? ''),
    slug: String(t.slug_pattern ?? ''),
    targetWordCount,
    maxTokensPerSection: Number(t.max_tokens_per_section ?? 3000),
    sections,
    seo: {
      primaryKeyword: String(seoRaw.primary_keyword ?? ''),
      secondaryKeywords: (seoRaw.secondary_keywords as string[]) ?? [],
      schemaType: String(seoRaw.schema_type ?? 'Article'),
    },
  };
}

/** Convert frontend Template shape → API YAML shape */
export function templateToApi(t: Template): Record<string, unknown> {
  const low = Math.round(t.targetWordCount * 0.6);
  return {
    template: {
      name: t.name,
      slug_pattern: t.slug,
      target_length_words: `${low}-${t.targetWordCount}`,
      output_languages: ['pt-br', 'en'],
      ...(t.maxTokensPerSection
        ? { max_tokens_per_section: t.maxTokensPerSection }
        : {}),
    },
    sections: t.sections.map((s) => ({
      id: s.id,
      title: s.title,
      instruction: s.instruction,
      query_type: s.queryType,
      rag_queries: s.ragQueries,
      ...(s.maxTokens ? { max_tokens: s.maxTokens } : {}),
      requires_human_input: s.requiresHumanInput,
    })),
    seo: {
      primary_keyword: t.seo.primaryKeyword,
      secondary_keywords: t.seo.secondaryKeywords,
      schema_type: t.seo.schemaType,
    },
  };
}

/** Factory — blank section for a given position index. */
export function emptySection(index: number): TemplateSection {
  return {
    id: `section_${index}`,
    title: '',
    instruction: '',
    queryType: 'qa',
    ragQueries: [],
    maxTokens: 500,
    requiresHumanInput: false,
  };
}

/** Factory — blank template ready to edit. */
export function emptyTemplate(): Template {
  return {
    name: 'New Template',
    slug: 'new-template',
    targetWordCount: 2000,
    maxTokensPerSection: 500,
    sections: [emptySection(1)],
    seo: {
      primaryKeyword: '',
      secondaryKeywords: [],
      schemaType: 'Article',
    },
  };
}
