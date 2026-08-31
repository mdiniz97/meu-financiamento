export type RateKind = 'effective-annual' | 'nominal-annual' | 'effective-monthly';

export function isRateKind(value: unknown): value is RateKind {
  return value === 'effective-annual' || value === 'nominal-annual' || value === 'effective-monthly';
}

export function normalizeRate(percent: number, kind: RateKind) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 1200) {
    throw new Error('Informe uma taxa válida.');
  }
  if (!isRateKind(kind)) throw new Error('Tipo de taxa inválido.');
  if (kind === 'effective-annual') {
    const effectiveAnnual = percent / 100;
    return { effectiveAnnual, effectiveMonthly: (1 + effectiveAnnual) ** (1 / 12) - 1 };
  }
  const effectiveMonthly = kind === 'nominal-annual' ? percent / 1200 : percent / 100;
  return { effectiveAnnual: (1 + effectiveMonthly) ** 12 - 1, effectiveMonthly };
}
