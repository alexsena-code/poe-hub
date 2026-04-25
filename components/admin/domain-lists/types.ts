// Session 31 (A): shared types for the domain-lists editor.

export type ListType = "off-topic" | "social" | "marketplace-rmt" | "generic-news";

export type DomainListsAll = Record<ListType, string[]>;

export const LIST_TYPE_ORDER: ListType[] = [
  "off-topic",
  "social",
  "marketplace-rmt",
  "generic-news",
];

export const LIST_LABEL: Record<ListType, string> = {
  "off-topic": "Off-topic",
  "social": "Social",
  "marketplace-rmt": "Marketplace / RMT",
  "generic-news": "News genérico",
};

export const LIST_HELP: Record<ListType, string> = {
  "off-topic": "Domínios não-PoE detectados em SERPs (ex: eufy.com, reolink.com — Power-over-Ethernet).",
  "social": "Sites sociais que sobem em SERPs sem agregar conteúdo (twitter.com, x.com, reddit.com).",
  "marketplace-rmt": "Marketplaces de RMT proibidos (g2g.com, igvault.com, mmoga.com).",
  "generic-news": "Sites de news genéricos sem foco em PoE (cnn.com, theverge.com).",
};

export const MAX_DOMAINS_PER_LIST = 500;
