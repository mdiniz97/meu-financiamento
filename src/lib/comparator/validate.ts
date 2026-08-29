import type { ComparatorFee, ComparatorInput, ComparatorProposal, ProposalError } from './types';

export class ComparatorValidationError extends Error {}

const num = (v: unknown, field: string, label: string): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new ComparatorValidationError(`${label} inválido`);
  return n;
};

export function normalizeProposal(raw: Record<string, unknown>): ComparatorProposal {
  const bank = String(raw.bank ?? '').trim();
  if (!bank) throw new ComparatorValidationError('Informe o banco da proposta.');
  const propertyValue = num(raw.propertyValue, 'propertyValue', 'Valor do imóvel');
  const downPayment = num(raw.downPayment, 'downPayment', 'Entrada');
  const months = num(raw.months, 'months', 'Prazo');
  const annualRate = num(raw.annualRate, 'annualRate', 'Taxa');
  const cetInformed = num(raw.cetInformed, 'cetInformed', 'CET');
  const trMonthly = num(raw.trMonthly, 'trMonthly', 'TR');
  const insuranceMonthly = num(raw.insuranceMonthly, 'insuranceMonthly', 'Seguro');
  if (!(propertyValue > 0)) throw new ComparatorValidationError('Valor do imóvel deve ser maior que zero.');
  if (!(downPayment >= 0 && downPayment < propertyValue)) throw new ComparatorValidationError('Entrada deve ser menor que o valor do imóvel.');
  if (!(months >= 1 && months <= 600)) throw new ComparatorValidationError('Prazo deve estar entre 1 e 600 meses.');
  if (!(annualRate > 0 && annualRate <= 1)) throw new ComparatorValidationError('Taxa contratual deve estar entre 0 e 100% a.a.');
  if (!(cetInformed >= 0 && cetInformed <= 1)) throw new ComparatorValidationError('CET deve estar entre 0 e 100% a.a.');
  if (!(trMonthly >= 0 && trMonthly <= 1)) throw new ComparatorValidationError('TR mensal inválida.');
  if (!(insuranceMonthly >= 0)) throw new ComparatorValidationError('Seguro mensal não pode ser negativo.');
  if (raw.system !== 'SAC' && raw.system !== 'PRICE') throw new ComparatorValidationError('Sistema deve ser SAC ou PRICE.');
  const fees: ComparatorFee[] = Array.isArray(raw.fees)
    ? raw.fees.map((f, i) => {
        const fee = (f ?? {}) as Record<string, unknown>;
        const amount = num(fee.amount, 'fee', 'Tarifa');
        const label = String(fee.label ?? '').trim() || `Tarifa ${i + 1}`;
        if (!(amount >= 0)) throw new ComparatorValidationError(`Tarifa "${label}" não pode ser negativa.`);
        return { id: String(fee.id ?? `f${i}`), label, amount, includeInCet: Boolean(fee.includeInCet) };
      })
    : [];
  let principal = propertyValue - downPayment;
  if (raw.principalManual != null && raw.principalManual !== '') {
    principal = num(raw.principalManual, 'principalManual', 'Valor financiado');
    if (!(principal > 0)) throw new ComparatorValidationError('Valor financiado deve ser maior que zero.');
  }
  return {
    id: String(raw.id ?? 'p'),
    bank,
    name: raw.name ? String(raw.name).trim() : undefined,
    propertyValue,
    downPayment,
    principal,
    system: raw.system as 'SAC' | 'PRICE',
    months,
    annualRate,
    cetInformed,
    trMonthly,
    insuranceMonthly,
    fees,
  };
}

export function validateComparator(input: ComparatorInput): ProposalError[] {
  const errors: ProposalError[] = [];
  if (input.proposals.length < 2 || input.proposals.length > 3) {
    errors.push({ id: '__global__', message: 'Compare entre 2 e 3 propostas.' });
  }
  if (!(input.monthlyBudget > 0)) {
    errors.push({ id: '__global__', message: 'Informe o orçamento mensal (maior que zero).' });
  }
  for (const p of input.proposals) {
    try {
      normalizeProposal(p as unknown as Record<string, unknown>);
    } catch (e) {
      if (e instanceof ComparatorValidationError) errors.push({ id: p.id, message: e.message });
      else throw e;
    }
  }
  return errors;
}

export function assertAtMostThree(proposals: unknown[]): void {
  if (proposals.length > 3) throw new ComparatorValidationError('Máximo de 3 propostas por comparação.');
}
