/**
 * Módulos do sistema — usado em Tasks para categorização.
 * Para adicionar/remover módulos: edite esta lista E o enum TaskModule no prisma/schema.prisma
 */
export const TASK_MODULES = [
  { value: "bots", label: "Bots" },
  { value: "prices", label: "Preços" },
  { value: "sales", label: "Vendas" },
  { value: "simulations", label: "Simulações" },
  { value: "infra", label: "Infra" },
  { value: "other", label: "Outro" },
] as const;

export type TaskModuleValue = (typeof TASK_MODULES)[number]["value"];
