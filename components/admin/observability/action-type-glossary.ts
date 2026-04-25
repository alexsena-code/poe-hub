// Session 33 (BUG 2 fix): human-readable glossary for SearxNG auto-action
// types. Source of truth for what each `actionType` and `decision` value
// means in the operator-facing UI (auto-actions board + detail sheet).
//
// Keep in sync with engine actionType values written by
// SearxngAutoActionsService (packages/api/src/modules/seo/services/
// searxng-auto-actions.service.ts).

export interface ActionTypeInfo {
  label: string;
  description: string;
  examples?: string;
}

export const ACTION_TYPE_GLOSSARY: Record<string, ActionTypeInfo> = {
  competitor_discover: {
    label: "Competitor discover",
    description:
      "SearxNG encontrou um domínio novo ranqueando pras nossas keywords. " +
      "LLM classificou como possível competitor PoE. Approve = registra " +
      "em `competitors` e entra no crawl. Reject = ignora permanentemente.",
    examples: "ggwtb.com, gw2mists.com, regex101.com",
  },
  blacklist_apply: {
    label: "Blacklist apply",
    description:
      "Keyword foi marcada como off-topic (SERP dominado por domínios " +
      "fora de PoE — ex: Power-over-Ethernet, dispositivos Reolink). " +
      "Status do KeywordOpportunity já mudou pra 'rejected'.",
  },
  cross_source_promote: {
    label: "Cross-source promote",
    description:
      "Keyword apareceu em N+ fontes (Reddit + YouTube + GSC etc). " +
      "Engine boostou trendingScore em 1.2x pra refletir a confiança " +
      "vinda da agregação multi-source.",
  },
  auto_archive: {
    label: "Auto archive",
    description:
      "Keyword sem `lastSeenAt` recente (default 30 dias) foi arquivada " +
      "pra não poluir o surface principal. Reversível via /seo/keywords/" +
      ":id/status (rejected → new).",
  },
};

export const DECISION_GLOSSARY: Record<string, { label: string; description: string }> = {
  applied: {
    label: "Applied",
    description: "LLM teve confiança alta; ação foi aplicada automaticamente.",
  },
  pending_review: {
    label: "Pending review",
    description:
      "LLM hesitou (próximo do threshold de confiança). Operador decide " +
      "approve/reject manualmente.",
  },
  skipped: {
    label: "Skipped",
    description:
      "LLM rejeitou de cara (off-topic, baixa relevância PoE) ou alvo já " +
      "estava no estado desejado.",
  },
  rejected: {
    label: "Rejected",
    description:
      "Operador rejeitou manualmente uma decisão pending_review (ou ação " +
      "applied desfeita).",
  },
};

export function actionTypeLabel(actionType: string): string {
  return ACTION_TYPE_GLOSSARY[actionType]?.label ?? actionType;
}

export function actionTypeDescription(actionType: string): string {
  return ACTION_TYPE_GLOSSARY[actionType]?.description ?? "Tipo desconhecido — ver engine logs.";
}

export function decisionLabel(decision: string): string {
  return DECISION_GLOSSARY[decision]?.label ?? decision;
}
