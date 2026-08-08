export interface NavItem {
  title: string;
  slug: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Inicio',
    items: [
      { title: 'Bem-vindo', slug: '' },
      { title: 'Arquitetura', slug: 'architecture' },
      { title: 'Infraestrutura', slug: 'infrastructure' },
    ],
  },
  {
    title: 'Content Engine',
    items: [
      { title: 'Pipeline Diario', slug: 'engine/pipeline' },
      { title: 'VICE Scoring', slug: 'engine/vice' },
      { title: 'RAG & Contexto', slug: 'engine/rag' },
      { title: 'Qdrant Collections', slug: 'engine/collections' },
      { title: 'Templates & Style', slug: 'engine/templates' },
      { title: 'LLM Providers', slug: 'engine/llm' },
    ],
  },
  {
    title: 'poe-hub',
    items: [
      { title: 'Visao Geral', slug: 'hub/overview' },
      { title: 'Bots', slug: 'hub/bots' },
      { title: 'Precos (G2G)', slug: 'hub/prices' },
      { title: 'Vendas & Simulacoes', slug: 'hub/sales' },
      { title: 'Monitoramento', slug: 'hub/monitor' },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Content API', slug: 'api/content' },
      { title: 'Knowledge API', slug: 'api/knowledge' },
      { title: 'SEO & Keywords', slug: 'api/seo' },
      { title: 'Config API', slug: 'api/config' },
      { title: 'poe-hub API', slug: 'api/hub' },
    ],
  },
  {
    title: 'Como Usar',
    items: [
      { title: 'Criando Conteudo', slug: 'guide/content' },
      { title: 'Pipeline SEO', slug: 'guide/seo' },
      { title: 'Publicando Guides', slug: 'guide/publishing' },
      { title: 'Configuracao', slug: 'guide/config' },
    ],
  },
];

export function flatNav(): NavItem[] {
  return NAV.flatMap((s) => s.items);
}

export function findNavIndex(slug: string): number {
  return flatNav().findIndex((item) => item.slug === slug);
}

export function getPrevNext(slug: string) {
  const flat = flatNav();
  const idx = flat.findIndex((item) => item.slug === slug);
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}
