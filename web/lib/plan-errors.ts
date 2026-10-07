// Client-safe mapping of database plan-limit errors (migration 012 triggers)
// to the upgrade message shown to the user.

const MESSAGES: Record<string, string> = {
  plan_limit_properties:
    "Llegaste al límite de propiedades de tu plan. Actualiza tu plan para añadir más.",
  plan_limit_contracts:
    "Llegaste al límite de contratos de este mes en tu plan. Actualiza tu plan para crear más.",
};

export function planLimitMessage(error: unknown): string | null {
  const message =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null)?.message ?? "";
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : null;
}
