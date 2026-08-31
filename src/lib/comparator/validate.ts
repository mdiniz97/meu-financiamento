import type { ComparatorFee, ComparatorInput, ComparatorProposal, ProposalError } from './types';
import { isRateKind, normalizeRate, type RateKind } from '@/lib/finance/rates';

export class ComparatorValidationError extends Error {}

export const COMPARATOR_LIMITS = {
  minProposals: 2,
  maxProposals: 3,
  maxFeesPerProposal: 20,
  maxStringLength: 100,
  legacyMaxFeesPerProposal: 100,
  legacyMaxStringLength: 1000,
} as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export interface ComparatorValidationOptions {
  legacy?: boolean;
}

function limitedString(value: unknown, label: string, required = false, options: ComparatorValidationOptions = {}): string {
  if (value === undefined || value === null) {
    if (required) throw new ComparatorValidationError(`${label} inválido.`);
    return '';
  }
  if (typeof value !== 'string') throw new ComparatorValidationError(`${label} inválido.`);
  const result = value.trim();
  if (required && !result) throw new ComparatorValidationError(`Informe ${label.toLowerCase()}.`);
  const maxLength = options.legacy ? COMPARATOR_LIMITS.legacyMaxStringLength : COMPARATOR_LIMITS.maxStringLength;
  if (result.length > maxLength) {
    throw new ComparatorValidationError(`${label} deve ter no máximo ${maxLength} caracteres.`);
  }
  return result;
}

const num = (v: unknown, field: string, label: string): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) throw new ComparatorValidationError(`${label} inválido`);
  return n;
};

export function normalizeProposal(raw: Record<string, unknown>, options: ComparatorValidationOptions = {}): ComparatorProposal {
  const id = limitedString(raw.id ?? 'p', 'Identificador', true, options);
  if (!options.legacy && !SAFE_ID.test(id)) throw new ComparatorValidationError('Identificador da proposta inválido.');
  const bank = limitedString(raw.bank, 'Banco da proposta', true, options);
  const name = limitedString(raw.name, 'Nome da proposta', false, options);
  const propertyValue = num(raw.propertyValue, 'propertyValue', 'Valor do imóvel');
  const downPayment = num(raw.downPayment, 'downPayment', 'Entrada');
  const months = num(raw.months, 'months', 'Prazo');
  const annualRate = num(raw.annualRate, 'annualRate', 'Taxa');
  const cetInformed = num(raw.cetInformed, 'cetInformed', 'CET');
  const trMonthly = num(raw.trMonthly, 'trMonthly', 'TR');
  const insuranceMonthly = num(raw.insuranceMonthly, 'insuranceMonthly', 'Seguro');
  if (!(propertyValue > 0)) throw new ComparatorValidationError('Valor do imóvel deve ser maior que zero.');
  if (!(downPayment >= 0 && downPayment < propertyValue)) throw new ComparatorValidationError('Entrada deve ser menor que o valor do imóvel.');
  if (!(Number.isInteger(months) && months >= 1 && months <= 600)) throw new ComparatorValidationError('Prazo deve ser inteiro entre 1 e 600 meses.');
  if (!(annualRate > 0 && annualRate <= 1)) throw new ComparatorValidationError('Taxa contratual deve estar entre 0 e 100% a.a.');
  if (!(cetInformed >= 0 && cetInformed <= 1)) throw new ComparatorValidationError('CET deve estar entre 0 e 100% a.a.');
  if (!(trMonthly >= 0 && trMonthly <= 0.1)) throw new ComparatorValidationError('TR mensal inválida.');
  if (!(insuranceMonthly >= 0)) throw new ComparatorValidationError('Seguro mensal não pode ser negativo.');
  if (raw.system !== 'SAC' && raw.system !== 'PRICE') throw new ComparatorValidationError('Sistema deve ser SAC ou PRICE.');
  if (!Array.isArray(raw.fees)) throw new ComparatorValidationError('Tarifas inválidas.');
  const maxFees = options.legacy ? COMPARATOR_LIMITS.legacyMaxFeesPerProposal : COMPARATOR_LIMITS.maxFeesPerProposal;
  if (raw.fees.length > maxFees) {
    throw new ComparatorValidationError(`Máximo de ${maxFees} tarifas por proposta.`);
  }
  const fees: ComparatorFee[] = raw.fees.map((f, i) => {
        if (typeof f !== 'object' || f === null || Array.isArray(f)) throw new ComparatorValidationError('Tarifa inválida.');
        const fee = (f ?? {}) as Record<string, unknown>;
        const amount = num(fee.amount, 'fee', 'Tarifa');
        const feeId = limitedString(fee.id ?? `f${i}`, 'Identificador da tarifa', true, options);
        if (!options.legacy && !SAFE_ID.test(feeId)) throw new ComparatorValidationError('Identificador da tarifa inválido.');
        const label = limitedString(fee.label, 'Nome da tarifa', false, options) || `Tarifa ${i + 1}`;
        if (!(amount >= 0)) throw new ComparatorValidationError(`Tarifa "${label}" não pode ser negativa.`);
        if (typeof fee.includeInCet !== 'boolean') throw new ComparatorValidationError('includeInCet deve ser boolean.');
        return { id: feeId, label, amount, includeInCet: fee.includeInCet };
      });
  if (!options.legacy && new Set(fees.map((fee) => fee.id)).size !== fees.length) {
    throw new ComparatorValidationError('Identificador da tarifa duplicado.');
  }
  let principal = propertyValue - downPayment;
  const automaticPrincipal = propertyValue - downPayment;
  const principalManual = raw.principalManual === true || (!options.legacy &&
    raw.principalManual === undefined &&
    raw.principal !== undefined &&
    Number.isFinite(Number(raw.principal)) &&
    Math.abs(Number(raw.principal) - automaticPrincipal) > 0.005
  );
  if (raw.principalManual !== undefined && typeof raw.principalManual !== 'boolean') {
    throw new ComparatorValidationError('Indicador de valor financiado manual inválido.');
  }
  if (principalManual) {
    principal = num(raw.principal, 'principal', 'Valor financiado');
    if (!(principal > 0)) throw new ComparatorValidationError('Valor financiado deve ser maior que zero.');
  }
  let annualRateValue = annualRate * 100;
  let annualRateKind: RateKind = 'effective-annual';
  if ((typeof raw.annualRateValue === 'string' || typeof raw.annualRateValue === 'number') && isRateKind(raw.annualRateKind)) {
    const visualValue = num(raw.annualRateValue, 'annualRateValue', 'Taxa visual');
    try {
      const representedRate = normalizeRate(visualValue, raw.annualRateKind).effectiveAnnual;
      if (Math.abs(representedRate - annualRate) <= 1e-12) {
        annualRateValue = visualValue;
        annualRateKind = raw.annualRateKind;
      }
    } catch {
      // Metadata visual inválida não substitui significado canônico salvo.
    }
  }
  return {
    id,
    bank,
    name: name || undefined,
    propertyValue,
    downPayment,
    principal,
    principalManual,
    system: raw.system as 'SAC' | 'PRICE',
    months,
    annualRate,
    annualRateValue,
    annualRateKind,
    cetInformed,
    trMonthly,
    insuranceMonthly,
    fees,
  };
}

export function validateComparator(input: ComparatorInput, options: ComparatorValidationOptions = {}): ProposalError[] {
  const errors: ProposalError[] = [];
  if (input.proposals.length < 2 || input.proposals.length > 3) {
    errors.push({ id: '__global__', message: 'Compare entre 2 e 3 propostas.' });
  }
  if (!(input.monthlyBudget > 0)) {
    errors.push({ id: '__global__', message: 'Informe o orçamento mensal (maior que zero).' });
  }
  if (!options.legacy && new Set(input.proposals.map((proposal) => proposal.id)).size !== input.proposals.length) {
    errors.push({ id: '__global__', message: 'Identificador da proposta duplicado.' });
  }
  for (const p of input.proposals) {
    try {
      normalizeProposal(p as unknown as Record<string, unknown>, options);
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

export function assertProposalCount(proposals: unknown[]): void {
  if (proposals.length < COMPARATOR_LIMITS.minProposals || proposals.length > COMPARATOR_LIMITS.maxProposals) {
    throw new ComparatorValidationError('Compare entre 2 e 3 propostas.');
  }
}
