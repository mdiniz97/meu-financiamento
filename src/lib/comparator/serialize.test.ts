import { describe, expect, it } from 'vitest';
import {
  deserializeComparisonInput,
  deserializeStoredComparisonInput,
  deserializeStoredComparisonSnapshot,
  serializeComparisonInput,
} from './serialize';
import { COMPARISON_ENGINE_VERSION, COMPARISON_FINGERPRINT_VERSION, computeComparator } from './calculate';
import type { ComparatorInput } from './types';
import type { SmartCandidate } from '@/lib/finance/smart';

const input: ComparatorInput = {
  monthlyBudget: 12000,
  proposals: [{
    id: 'p1',
    bank: 'Caixa',
    propertyValue: 850000,
    downPayment: 250000,
    principal: 600000,
    system: 'SAC',
    months: 360,
    annualRate: 1.01 ** 12 - 1,
    annualRateValue: 12,
    annualRateKind: 'nominal-annual',
    cetInformed: 0.1042,
    trMonthly: 0.0017,
    insuranceMonthly: 100,
    fees: [],
  }, {
    id: 'p2', bank: 'Itaú', propertyValue: 850000, downPayment: 250000, principal: 600000,
    system: 'PRICE', months: 360, annualRate: 0.1, cetInformed: 0.11, trMonthly: 0.0017,
    insuranceMonthly: 80, fees: [],
  }],
};

describe('comparison serialization', () => {
  it('preserva valor visual e tipo sem alterar taxa canônica', () => {
    const restored = deserializeComparisonInput(serializeComparisonInput(input));
    expect(restored.proposals[0].annualRateValue).toBe(12);
    expect(restored.proposals[0].annualRateKind).toBe('nominal-annual');
    expect(restored.proposals[0].annualRate).toBeCloseTo(1.01 ** 12 - 1, 12);
  });

  it('registro antigo restaura representação efetiva anual sem arredondar', () => {
    const restored = deserializeComparisonInput(JSON.stringify({
      version: 1,
      monthlyBudget: 12000,
      proposals: input.proposals.map((proposal, index) => index === 0
        ? { ...proposal, annualRate: 0.105123456789, annualRateValue: undefined, annualRateKind: undefined }
        : proposal),
    }));
    expect(restored.proposals[0].annualRateValue).toBe(10.5123456789);
    expect(restored.proposals[0].annualRateKind).toBe('effective-annual');
  });

  it('metadata inconsistente não substitui significado canônico salvo', () => {
    const restored = deserializeComparisonInput(JSON.stringify({
      version: 1,
      monthlyBudget: 12000,
      proposals: input.proposals.map((proposal, index) => index === 0
        ? { ...proposal, annualRateValue: 2, annualRateKind: 'effective-monthly' }
        : proposal),
    }));
    expect(restored.proposals[0].annualRateValue).toBe((1.01 ** 12 - 1) * 100);
    expect(restored.proposals[0].annualRateKind).toBe('effective-annual');
  });

  it('normaliza metadata com vírgula para número JSON sem mudar canônico', () => {
    const raw = JSON.stringify({
      version: 1,
      monthlyBudget: input.monthlyBudget,
      proposals: input.proposals.map((proposal, index) => index === 0
        ? { ...proposal, annualRateValue: '12,0', annualRateKind: 'nominal-annual' }
        : proposal),
    });
    const restored = deserializeComparisonInput(raw);
    expect(restored.proposals[0].annualRateValue).toBe(12);
    expect(restored.proposals[0].annualRate).toBeCloseTo(1.01 ** 12 - 1, 12);
    expect(JSON.parse(serializeComparisonInput(restored)).proposals[0].annualRateValue).toBe(12);
  });

  it('preserva principal manual no round-trip e no cálculo', () => {
    const manual: ComparatorInput = {
      ...input,
      proposals: input.proposals.map((proposal, index) => index === 0
        ? { ...proposal, principal: 610000, principalManual: true }
        : proposal),
    };
    const restored = deserializeComparisonInput(serializeComparisonInput(manual));
    expect(restored.proposals[0].principalManual).toBe(true);
    expect(restored.proposals[0].principal).toBe(610000);
    expect(computeComparator(restored).v1.outcomes[0].result.input.principal).toBe(610000);
  });

  it('preserva semântica automática sem metadata explícita', () => {
    const legacyManual = structuredClone(input);
    legacyManual.proposals[0].principal = 610000;
    delete legacyManual.proposals[0].principalManual;
    const restored = deserializeStoredComparisonInput(JSON.stringify({ version: 1, ...legacyManual }));
    expect(restored.proposals[0].principalManual).toBe(false);
    expect(restored.proposals[0].principal).toBe(600000);
  });

  it('serializer rejeita includeInCet textual', () => {
    const malformed = structuredClone(input) as unknown as { proposals: { fees: unknown[] }[] };
    malformed.proposals[0].fees = [{ id: 'f1', label: 'Tarifa', amount: 1, includeInCet: 'false' }];
    expect(() => serializeComparisonInput(malformed as unknown as ComparatorInput)).toThrow(/includeInCet/i);
  });

  it('parser estrito rejeita IDs duplicados', () => {
    const malformed = structuredClone(input);
    malformed.proposals[1].id = malformed.proposals[0].id;
    expect(() => deserializeComparisonInput(JSON.stringify({ version: 1, ...malformed }))).toThrow(/identificador/i);
  });

  it('parser legado cria IDs de cliente únicos e estáveis para IDs históricos duplicados', () => {
    const legacy = structuredClone(input);
    legacy.proposals[0].id = 'proposta histórica';
    legacy.proposals[1].id = 'proposta histórica';
    legacy.proposals[0].fees = [
      { id: 'tarifa antiga', label: 'A', amount: 1, includeInCet: false },
      { id: 'tarifa antiga', label: 'B', amount: 2, includeInCet: true },
    ];
    const raw = JSON.stringify({ version: 1, ...legacy });
    const first = deserializeStoredComparisonInput(raw);
    const second = deserializeStoredComparisonInput(raw);
    expect(new Set(first.proposals.map((proposal) => proposal.id)).size).toBe(2);
    expect(new Set(first.proposals[0].fees.map((fee) => fee.id)).size).toBe(2);
    expect(first.proposals.map((proposal) => proposal.id)).toEqual(second.proposals.map((proposal) => proposal.id));
  });

  it('reutiliza snapshot com fingerprint consistente sem alterar payload salvo', () => {
    const result = computeComparator(input);
    const raw = JSON.stringify({ version: 1, ...input });
    const restored = deserializeStoredComparisonSnapshot(raw, result);
    expect(restored.recalculated).toBe(false);
    expect(restored.result).toStrictEqual(result);
    expect(raw).toBe(JSON.stringify({ version: 1, ...input }));
    expect(restored.input.proposals.map((proposal) => proposal.id)).toEqual(
      restored.result.v1.outcomes.map((outcome) => outcome.proposal.id)
    );
    expect(result.v1.fingerprintVersion).toBe(COMPARISON_FINGERPRINT_VERSION);
  });

  it('recalcula snapshot com engine version antigo', () => {
    const restored = deserializeStoredComparisonSnapshot(
      JSON.stringify({ version: 1, ...input }),
      computeComparator(input),
      'old'
    );
    expect(restored.recalculated).toBe(true);
    expect(COMPARISON_ENGINE_VERSION).not.toBe('old');
  });

  it('recalcula snapshot sem versão de fingerprint', () => {
    const result = computeComparator(input);
    delete (result.v1 as Partial<typeof result.v1>).fingerprintVersion;
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it('ignora IDs, labels e metadata visual no fingerprint financeiro', () => {
    const withFees = structuredClone(input);
    withFees.proposals[0].fees = [{ id: 'old-fee', label: 'Avaliação antiga', amount: 1000, includeInCet: true }];
    const result = computeComparator(withFees);
    const changedVisual = structuredClone(withFees);
    changedVisual.proposals[0].fees[0].id = 'new-fee';
    changedVisual.proposals[0].fees[0].label = 'Novo nome';
    changedVisual.proposals[0].annualRateValue = undefined;
    changedVisual.proposals[0].annualRateKind = undefined;
    const restored = deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...changedVisual }), result);
    expect(restored.recalculated).toBe(false);
  });

  it('remapeia propostas financeiramente idênticas sem colidir referências', () => {
    const identical = structuredClone(input);
    identical.proposals[1] = { ...structuredClone(identical.proposals[0]), id: 'old-b' };
    identical.proposals[0].id = 'old-a';
    const result = computeComparator(identical);
    const stored = structuredClone(identical);
    stored.proposals[0].id = 'id inválido a';
    stored.proposals[1].id = 'id inválido b';
    result.v1.outcomes[0].proposal.id = 'id inválido a';
    result.v1.outcomes[1].proposal.id = 'id inválido b';
    for (const collection of [result.v1.ranked, result.v1.smartRanked]) {
      collection[0].proposal.id = 'id inválido a';
      collection[1].proposal.id = 'id inválido b';
    }
    if (result.v1.best) result.v1.best.proposal.id = 'id inválido a';
    const restored = deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...stored }), result);
    expect(restored.recalculated).toBe(false);
    expect(restored.result.v1.outcomes.map((outcome) => outcome.proposal.id)).toEqual(['p1', 'p2']);
    expect(new Set(restored.result.v1.ranked.map((outcome) => outcome.proposal.id))).toEqual(new Set(['p1', 'p2']));
  });

  it.each(['ranked', 'smartRanked'] as const)('recalcula %s que não é permutação exata', (field) => {
    const result = computeComparator(input);
    result.v1[field] = [result.v1.outcomes[0], result.v1.outcomes[0]];
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each(['ranked', 'smartRanked'] as const)('recalcula %s com permutação fora da ordem canônica', (field) => {
    const result = computeComparator(input);
    result.v1[field] = [...result.v1[field]].reverse();
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it('recalcula best diferente do primeiro ranking', () => {
    const result = computeComparator(input);
    result.v1.best = result.v1.ranked[1];
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['installments', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.installments = []; }],
    ['metric', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalPago = Number.NaN; }],
    ['smart candidate', (result: ReturnType<typeof computeComparator>) => {
      const best = result.v1.outcomes[0].smart?.recommended.best;
      if (best) best.result.installments[0].parcela = Number.NaN;
      else result.v1.outcomes[0].smart = undefined;
    }],
  ] as const)('recalcula nested shape inválido: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['mês não sequencial', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.installments[1].month = 3; }],
    ['parcela negativa', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.installments[0].parcela = -1; }],
    ['saldo acima do limite', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.installments[0].saldo = 1_000_000_000_000_001; }],
    ['métrica negativa', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalPago = -1; }],
    ['métrica acima do limite', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalJuros = 1_000_000_000_000_001; }],
    ['saldoZeroAt fracionário', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.saldoZeroAt = 1.5; }],
    ['total pago inconsistente', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalPago = 0; }],
    ['total de juros inconsistente', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalJuros = 0; }],
    ['total amortizado inconsistente', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalAmortizacao = 0; }],
    ['total de correção inconsistente', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalCorrecao = 0; }],
    ['total de seguro inconsistente', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.metrics.totalSeguro = 0; }],
  ] as const)('recalcula snapshot financeiro fora do domínio: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['saldoZeroAt diferente do total de parcelas', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.metrics.saldoZeroAt -= 1;
    }],
    ['saldo final positivo acima da tolerância', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.installments.at(-1)!.saldo = 0.006;
    }],
  ] as const)('recalcula snapshot sem invariante de quitação: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['fixedPayment sem amount', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.fixedPayment = { startMonth: 1 } as never;
    }],
    ['fixedPayment com mês fracionário', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.fixedPayment = { amount: 1000, startMonth: 1.5 };
    }],
    ['recurringExtra sem every', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.recurringExtra = { amount: 1000, startMonth: 1 } as never;
    }],
    ['recurringExtra com chave alheia', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.recurringExtra = { amount: 1000, every: 12, startMonth: 1, bank: 'X' } as never;
    }],
    ['portability fora do domínio', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.portability = { annualRate: 2, insuranceMonthly: -1, bank: 'X'.repeat(61) };
    }],
    ['extra mensal fora do domínio', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.extraMonthlyPct = 1.01;
    }],
    ['aporte pontual com mês fracionário', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.extraLumpSum = [{ month: 1.5, amount: 100 }];
    }],
    ['FGTS negativo', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.strategies.fgtsAnnual = { amount: -1 };
    }],
  ] as const)('recalcula estratégia malformada: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it('aceita pagamento fixo com valor zero no snapshot (aporte inerte reconciliável)', () => {
    const result = computeComparator(input);
    for (const outcome of result.v1.outcomes) {
      outcome.result.strategies.fixedPayment = { amount: 0 };
    }
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(false);
  });

  it.each([
    ['principal', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.principal = 1_000_000_000_001; }],
    ['annualRate', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.annualRate = -1; }],
    ['months', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.months = 1.5; }],
    ['trMonthly', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.trMonthly = 0.11; }],
    ['insuranceMonthly', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.insuranceMonthly = -1; }],
    ['insuranceSplit', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.insuranceSplit.taxPct = -1; }],
    ['bank', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.input.bank = 'X'.repeat(1001); }],
    ['system mismatch', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].result.system = 'PRICE'; }],
  ] as const)('recalcula LoanInput malformado: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['system', (candidate: SmartCandidate) => {
      candidate.system = candidate.system === 'SAC' ? 'PRICE' : 'SAC';
    }],
    ['months', (candidate: SmartCandidate) => {
      candidate.months -= 1;
    }],
    ['strategy', (candidate: SmartCandidate) => {
      delete candidate.result.strategies.fixedPayment;
      candidate.result.strategies.extraMonthlyPct = candidate.extraMonthlyPct + 0.01;
    }],
    ['fixed payment amount', (candidate: SmartCandidate) => {
      candidate.result.strategies.fixedPayment!.amount += 100;
    }],
  ] as const)('recalcula candidato Smart com %s divergente', (_name, mutate) => {
    const result = computeComparator(input);
    const candidate = result.v1.outcomes[0].smart?.recommended.best;
    expect(candidate).not.toBeNull();
    mutate(candidate!);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['computedAt longo', (result: ReturnType<typeof computeComparator>) => { result.v1.computedAt = 'X'.repeat(101); }],
    ['computedAt inválido', (result: ReturnType<typeof computeComparator>) => { result.v1.computedAt = 'not-a-date'; }],
    ['proposal id longo', (result: ReturnType<typeof computeComparator>) => { result.v1.outcomes[0].proposal.id = 'X'.repeat(101); }],
    ['fee id longo', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].proposal.fees = [{ id: 'X'.repeat(101), label: 'Tarifa', amount: 1, includeInCet: false }];
    }],
    ['fee label longa', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].proposal.fees = [{ id: 'f1', label: 'X'.repeat(1001), amount: 1, includeInCet: false }];
    }],
  ] as const)('recalcula string armazenada sem limite: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it('recalcula cetAlert que não seja boolean', () => {
    const result = computeComparator(input);
    result.v1.outcomes[0].cetAlert = 'false' as never;
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['best', (recommendation: Record<string, unknown>) => { delete recommendation.best; }],
    ['alternatives', (recommendation: Record<string, unknown>) => { delete recommendation.alternatives; }],
    ['comparison', (recommendation: Record<string, unknown>) => { delete recommendation.comparison; }],
    ['modes', (recommendation: Record<string, unknown>) => { delete recommendation.modes; }],
    ['maxTerms', (recommendation: Record<string, unknown>) => { delete recommendation.maxTerms; }],
    ['paymentMinParcela', (recommendation: Record<string, unknown>) => { delete recommendation.paymentMinParcela; }],
    ['infeasible', (recommendation: Record<string, unknown>) => { delete recommendation.infeasible; }],
    ['minBudget', (recommendation: Record<string, unknown>) => { delete recommendation.minBudget; }],
  ] as const)('recalcula SmartRecommendation sem subtree obrigatório: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result.v1.outcomes[0].smart!.recommended as unknown as Record<string, unknown>);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it.each([
    ['installments', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].result.installments = Array(961).fill(result.v1.outcomes[0].result.installments[0]);
    }],
    ['alternatives', (result: ReturnType<typeof computeComparator>) => {
      const recommendation = result.v1.outcomes[0].smart!.recommended;
      recommendation.alternatives = Array(5).fill(recommendation.best);
    }],
    ['comparison', (result: ReturnType<typeof computeComparator>) => {
      const recommendation = result.v1.outcomes[0].smart!.recommended;
      recommendation.comparison.push(recommendation.comparison[0]);
    }],
    ['maxTerms', (result: ReturnType<typeof computeComparator>) => {
      const recommendation = result.v1.outcomes[0].smart!.recommended;
      recommendation.maxTerms = Array(3).fill(recommendation.best);
    }],
    ['proposal fees', (result: ReturnType<typeof computeComparator>) => {
      result.v1.outcomes[0].proposal.fees = Array(101).fill(result.v1.outcomes[0].proposal.fees[0] ?? {
        id: 'fee', label: 'Tarifa', amount: 1, includeInCet: false,
      });
    }],
  ] as const)('recalcula array nested acima do limite: %s', (_name, mutate) => {
    const result = computeComparator(input);
    mutate(result);
    expect(deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...input }), result).recalculated).toBe(true);
  });

  it('remapeia IDs legados sem recalcular quando fingerprint financeiro coincide', () => {
    const legacy = structuredClone(input);
    const result = computeComparator(input);
    legacy.proposals[0].id = 'id inválido';
    legacy.proposals[1].id = 'id inválido';
    result.v1.outcomes[0].proposal.id = 'id inválido';
    result.v1.outcomes[1].proposal.id = 'id inválido';
    const restored = deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...legacy }), result);
    expect(restored.recalculated).toBe(false);
    expect(restored.result.v1.outcomes.map((outcome) => outcome.proposal.id)).toEqual(['p1', 'p2']);
  });

  it.each([
    ['annualRate', 0.2], ['months', 120], ['system', 'PRICE'], ['trMonthly', 0.003],
    ['insuranceMonthly', 999], ['bank', 'Outro banco'],
  ] as const)('recalcula resultado stale quando %s diverge', (field, value) => {
    const staleInput = structuredClone(input);
    Object.assign(staleInput.proposals[0], { [field]: value });
    const restored = deserializeStoredComparisonSnapshot(
      JSON.stringify({ version: 1, ...staleInput }),
      computeComparator(input)
    );
    expect(restored.recalculated).toBe(true);
    expect(restored.result.v1.outcomes[0].proposal[field as keyof typeof staleInput.proposals[0]]).toBe(value);
  });

  it('recalcula tarifas e orçamento smart e tolera resultado malformado', () => {
    const changed = structuredClone(input);
    changed.monthlyBudget = 9000;
    changed.proposals[0].fees = [{ id: 'f1', label: 'Tarifa', amount: 5000, includeInCet: true }];
    const restored = deserializeStoredComparisonSnapshot(
      JSON.stringify({ version: 1, ...changed }),
      { broken: true } as unknown as ReturnType<typeof computeComparator>
    );
    expect(restored.recalculated).toBe(true);
    expect(restored.result.v1.outcomes[0].financingCost).toBeGreaterThan(
      restored.result.v1.outcomes[0].result.metrics.totalPago
    );
    expect(restored.result.v1.outcomes[0].smart?.recommended.minBudget).toBeDefined();
  });

  it('aplica hard caps legados', () => {
    const tooManyFees = structuredClone(input);
    tooManyFees.proposals[0].fees = Array.from({ length: 101 }, (_, index) => ({
      id: `f${index}`, label: 'Tarifa', amount: 1, includeInCet: false,
    }));
    expect(() => deserializeStoredComparisonInput(JSON.stringify({ version: 1, ...tooManyFees }))).toThrow(/100 tarifas/i);
    const longString = structuredClone(input);
    longString.proposals[0].bank = 'x'.repeat(1001);
    expect(() => deserializeStoredComparisonInput(JSON.stringify({ version: 1, ...longString }))).toThrow(/1000 caracteres/i);
  });

  it('rejeita orçamento legado não finito', () => {
    expect(() => deserializeStoredComparisonInput(JSON.stringify({
      version: 1,
      monthlyBudget: 'Infinity',
      proposals: input.proposals,
    }))).toThrow(/orçamento/i);
  });

  it('não infere principal manual legado incompatível com resultado salvo', () => {
    const storedInput = structuredClone(input);
    storedInput.proposals[0].principal = 610000;
    delete storedInput.proposals[0].principalManual;
    const storedResult = computeComparator(input);
    const restored = deserializeStoredComparisonSnapshot(
      JSON.stringify({ version: 1, ...storedInput }),
      storedResult
    );
    expect(restored.recalculated).toBe(false);
    expect(restored.input.proposals[0].principalManual).toBe(false);
    expect(restored.input.proposals[0].principal).toBe(600000);
    expect(restored.result.v1.outcomes[0].result.input.principal).toBe(600000);
  });

  it('recalcula como automático quando principal inferido e snapshot divergem do automático', () => {
    const storedInput = structuredClone(input);
    storedInput.proposals[0].principal = 610000;
    delete storedInput.proposals[0].principalManual;
    const resultInput = structuredClone(input);
    resultInput.proposals[0].principal = 620000;
    resultInput.proposals[0].principalManual = true;
    const restored = deserializeStoredComparisonSnapshot(
      JSON.stringify({ version: 1, ...storedInput }),
      computeComparator(resultInput)
    );
    expect(restored.recalculated).toBe(true);
    expect(restored.input.proposals[0].principalManual).toBe(false);
    expect(restored.input.proposals[0].principal).toBe(600000);
    expect(restored.result.v1.outcomes[0].result.input.principal).toBe(600000);
  });

  it('recalcula snapshot legado quando IDs precisam ser remapeados', () => {
    const legacy = structuredClone(input);
    legacy.proposals[0].id = 'proposta histórica';
    legacy.proposals[1].id = 'proposta histórica';
    const storedResult = computeComparator(input);
    for (const collection of [storedResult.v1.outcomes, storedResult.v1.ranked, storedResult.v1.smartRanked]) {
      collection[0].proposal.id = 'proposta histórica';
      collection[1].proposal.id = 'proposta histórica';
    }
    const restored = deserializeStoredComparisonSnapshot(JSON.stringify({ version: 1, ...legacy }), storedResult);
    expect(restored.recalculated).toBe(false);
    const inputIds = restored.input.proposals.map((proposal) => proposal.id);
    expect(restored.result.v1.outcomes.map((outcome) => outcome.proposal.id)).toEqual(inputIds);
    expect(restored.result.v1.ranked.map((outcome) => outcome.proposal.id).sort()).toEqual([...inputIds].sort());
    expect(restored.result.v1.best?.proposal.id).toBe(restored.result.v1.ranked[0].proposal.id);
  });

  it('recalcula quando metadata manual explícita diverge do resultado salvo', () => {
    const manual = structuredClone(input);
    manual.proposals[0].principal = 610000;
    manual.proposals[0].principalManual = true;
    const restored = deserializeStoredComparisonSnapshot(
      JSON.stringify({ version: 1, ...manual }),
      computeComparator(input)
    );
    expect(restored.recalculated).toBe(true);
    expect(restored.input.proposals[0].principalManual).toBe(true);
    expect(restored.result.v1.outcomes[0].result.input.principal).toBe(610000);
  });

  it.each([1, 4])('rejeita payload com %i propostas', (count) => {
    const proposals = Array.from({ length: count }, (_, i) => ({ ...input.proposals[0], id: `p${i}` }));
    expect(() => deserializeComparisonInput(JSON.stringify({ version: 1, monthlyBudget: 12000, proposals }))).toThrow(/2 e 3 propostas/);
  });

  it('carrega e recalcula registro legado acima dos limites novos', () => {
    const legacy = {
      version: 1,
      monthlyBudget: input.monthlyBudget,
      proposals: input.proposals.map((proposal, index) => index === 0 ? {
        ...proposal,
        bank: 'B'.repeat(101),
        name: 'N'.repeat(101),
        fees: Array.from({ length: 21 }, (_, i) => ({ id: `f${i}`, label: `Tarifa ${i}`, amount: 1, includeInCet: false })),
      } : proposal),
    };
    expect(() => deserializeComparisonInput(JSON.stringify(legacy))).toThrow(/100 caracteres|20 tarifas/);
    const restored = deserializeStoredComparisonInput(JSON.stringify(legacy));
    expect(restored.proposals[0].bank).toHaveLength(101);
    expect(restored.proposals[0].fees).toHaveLength(21);
    const recalculated = computeComparator(restored, { legacy: true });
    expect(recalculated.v1.outcomes[0].result.input.bank).toBe(legacy.proposals[0].bank);
    expect(JSON.stringify(recalculated)).not.toContain('"bank":"Banco legado"');
    expect(restored.proposals[0].bank).toBe(legacy.proposals[0].bank);
  });
});
