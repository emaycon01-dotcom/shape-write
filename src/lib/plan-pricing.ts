/** Descontos por plano aplicados em todo o sistema (também validados no servidor). */
export const PLAN_DISCOUNTS: Record<string, number> = {
  free: 0,
  dealer: 0.25,
  master: 0.5,
  diamond: 1,
};

export function planDiscount(plano?: string | null): number {
  return PLAN_DISCOUNTS[(plano || "free").toLowerCase()] ?? 0;
}

/** Preço final (em créditos) de uma operação para o plano do usuário. */
export function planCost(base: number, plano?: string | null): number {
  const value = base * (1 - planDiscount(plano));
  return Math.round(value * 100) / 100;
}

export function formatCredits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}
