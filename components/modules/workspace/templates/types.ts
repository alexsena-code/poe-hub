/** Local types for the workspace/templates module. */

export interface TemplateSection {
  id: string;
  title: string;
  instruction: string;
  queryType: string;
  ragQueries: string[];
  maxTokens: number;
  requiresHumanInput: boolean;
}

export interface TemplateSeo {
  primaryKeyword: string;
  secondaryKeywords: string[];
  schemaType: string;
}

export interface Template {
  name: string;
  slug: string;
  targetWordCount: number;
  maxTokensPerSection: number;
  sections: TemplateSection[];
  seo: TemplateSeo;
}

export interface TemplateListItem {
  name: string;
  file: string;
}

export const QUERY_TYPES = [
  'qa',
  'mechanic_question',
  'build_guide',
  'meta_report',
  'tier_list',
  'patch_analysis',
  'item_lookup',
] as const;
