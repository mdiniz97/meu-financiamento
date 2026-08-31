import { describe, expect, it } from 'vitest';
import {
  comparePortability,
  portabilityBreakEven,
  safeDisplayedPortabilityRate,
  type PortabilityInput,
} from './portability';

const base: PortabilityInput = {
  principal: 800000, currentSystem: 'PRICE', currentAnnualRate: 0.115,
  trMonthly: 0.0017, insuranceMonthly: 100, months: 300, bank: 'Caixa',
  newAnnualRate: 0.09, newSystem: 'PRICE', newInsuranceMonthly: 100, newBank: 'Itaú',
};

describe('comparePortability', () => {
  it('taxa menor → portar economiza e parcela cai', () => {
    const r = comparePortability(base);
    expect(r.economiaLiquida).toBeGreaterThan(0);
    expect(r.ported.installments[0].parcela).toBeLessThan(r.keep.installments[0].parcela);
    expect(r.ported.metrics.saldoZeroAt).toBeLessThanOrEqual(r.keep.metrics.saldoZeroAt);
  });
  it('taxa maior → não vale a pena', () => {
    const r = comparePortability({ ...base, newAnnualRate: 0.14 });
    expect(r.economiaLiquida).toBeLessThan(0);
  });
  it('payback cobre os custos no mês em que a economia acumulada passa deles', () => {
    const r = comparePortability({ ...base, costs: 30000 });
    expect(r.paybackMonth).not.toBeNull();
    const n = r.paybackMonth!;
    const cum = (until: number) => {
      let acc = -30000;
      for (let t = 0; t < until; t++) {
        acc += (r.keep.installments[t]?.parcela ?? 0) - (r.ported.installments[t]?.parcela ?? 0);
      }
      return acc;
    };
    expect(cum(n)).toBeGreaterThanOrEqual(0);
    expect(cum(n - 1)).toBeLessThan(0);
  });
  it('sem custos, payback é imediato quando a parcela cai', () => {
    const r = comparePortability(base);
    expect(r.paybackMonth).toBe(1);
  });
  it('portar para SAC também é comparável', () => {
    const r = comparePortability({ ...base, newSystem: 'SAC' });
    expect(r.ported.system).toBe('SAC');
    expect(Number.isFinite(r.economiaLiquida)).toBe(true);
  });
  it('custos podem tornar portabilidade desvantajosa', () => {
    const withoutCosts = comparePortability({ ...base, costs: 0 });
    const withCosts = comparePortability({ ...base, costs: withoutCosts.economiaBruta + 1 });
    expect(withCosts.economiaBruta).toBeGreaterThan(0);
    expect(withCosts.economiaLiquida).toBe(-1);
  });
  it('economia líquida = bruta - custos', () => {
    const r = comparePortability({ ...base, costs: 25000 });
    expect(r.economiaLiquida).toBeCloseTo(r.economiaBruta - 25000, 6);
    expect(r.costs).toBe(25000);
  });
  it('custos negativos são tratados como zero', () => {
    const r = comparePortability({ ...base, costs: -500 });
    expect(r.costs).toBe(0);
    expect(r.economiaLiquida).toBe(r.economiaBruta);
  });
  it('sem custos, economia líquida iguala a bruta e payback é imediato', () => {
    const r = comparePortability(base);
    expect(r.economiaLiquida).toBeCloseTo(r.economiaBruta, 6);
    expect(r.paybackMonth).toBe(1);
  });
  it('custos maiores que toda economia acumulada → payback nunca ocorre', () => {
    const r = comparePortability({ ...base, costs: 1e9 });
    expect(r.paybackMonth).toBeNull();
    expect(r.economiaLiquida).toBeLessThan(0);
  });
  it('payback usa economia líquida: custos atrasam o ponto de equilíbrio', () => {
    const free = comparePortability({ ...base, costs: 0 });
    const costly = comparePortability({ ...base, costs: 50000 });
    expect(free.paybackMonth).toBe(1);
    expect(costly.paybackMonth).not.toBeNull();
    expect(costly.paybackMonth!).toBeGreaterThan(free.paybackMonth!);
  });
  it('recuperação durável exatamente no custo conta como payback', () => {
    const r = comparePortability({
      ...base,
      principal: 1000,
      currentSystem: 'SAC',
      currentAnnualRate: 0,
      trMonthly: 0,
      insuranceMonthly: 100,
      months: 1,
      newSystem: 'SAC',
      newAnnualRate: 0,
      newInsuranceMonthly: 90,
      costs: 10,
    });
    expect(r.paybackMonth).toBe(1);
  });
  it('contratos idênticos sem custos não inventam payback', () => {
    const r = comparePortability({
      ...base,
      newAnnualRate: base.currentAnnualRate,
      newInsuranceMonthly: base.insuranceMonthly,
    });
    expect(r.economiaLiquida).toBe(0);
    expect(r.paybackMonth).toBeNull();
  });
  it('economia acumulada positiva menor que meio centavo não inventa payback', () => {
    const r = comparePortability({
      ...base,
      principal: 1000,
      currentSystem: 'SAC',
      currentAnnualRate: 0,
      trMonthly: 0,
      insuranceMonthly: 100,
      months: 1,
      newSystem: 'SAC',
      newAnnualRate: 0,
      newInsuranceMonthly: 99.996,
      costs: 0,
    });
    expect(r.economiaLiquida).toBeGreaterThan(0);
    expect(r.economiaLiquida).toBeLessThan(0.005);
    expect(r.paybackMonth).toBeNull();
  });
  it('saldo final negativo menor que meio centavo não suprime recuperação anterior durável', () => {
    const changingSavings = {
      ...base,
      principal: 300000,
      currentAnnualRate: 0.08,
      newAnnualRate: 0.03,
      trMonthly: 0.01,
      insuranceMonthly: 0,
      newInsuranceMonthly: 500,
      months: 120,
    };
    const free = comparePortability(changingSavings);
    const r = comparePortability({ ...changingSavings, costs: free.economiaBruta + 0.004 });
    expect(r.economiaLiquida).toBeCloseTo(-0.004, 6);
    expect(r.paybackMonth).not.toBeNull();
  });
  it('payback exige recuperação durável até o fim do contrato', () => {
    const r = comparePortability({
      ...base,
      principal: 300000,
      currentAnnualRate: 0.08,
      newAnnualRate: 0.03,
      trMonthly: 0.01,
      insuranceMonthly: 0,
      newInsuranceMonthly: 500,
      months: 120,
      costs: 100000,
    });
    expect(r.economiaLiquida).toBeLessThan(0);
    expect(r.paybackMonth).toBeNull();
  });
});

describe('portabilityBreakEven', () => {
  it('com seguro igual, a taxa limite é a própria taxa atual', () => {
    const b = portabilityBreakEven(base);
    expect(b.maxWorthwhileRate).toBeCloseTo(base.currentAnnualRate, 3);
  });
  it('com seguro maior, a taxa que compensa cai abaixo da atual', () => {
    const b = portabilityBreakEven({ ...base, newInsuranceMonthly: 250 });
    expect(b.maxWorthwhileRate).toBeLessThan(base.currentAnnualRate);
    expect(b.maxWorthwhileRate).toBeGreaterThan(0);
  });
  it('sem parcela alvo informada → targetParcela é null', () => {
    const b = portabilityBreakEven(base);
    expect(b.targetParcela).toBeNull();
  });
  it('parcela alvo: taxa máxima para atingi-la', () => {
    const atual = comparePortability(base).keep.installments[0].parcela;
    const b = portabilityBreakEven(base, atual - 200);
    expect(b.targetParcela).not.toBeNull();
    expect(b.targetParcela!.impossible).toBe(false);
    expect(b.targetParcela!.maxRate).not.toBeNull();
    const r = comparePortability({ ...base, newAnnualRate: b.targetParcela!.maxRate! });
    expect(r.ported.installments[0].parcela).toBeLessThanOrEqual(atual - 200 + 1);
  });
  it('parcela alvo impossível (menor que a de taxa 0) → impossible true', () => {
    const b = portabilityBreakEven(base, 1);
    expect(b.targetParcela).not.toBeNull();
    expect(b.targetParcela!.impossible).toBe(true);
    expect(b.targetParcela!.maxRate).toBeNull();
  });
  it('parcela alvo folgada alcança o teto independente do limite econômico', () => {
    const bFolgado = portabilityBreakEven(base, 999999);
    expect(bFolgado.targetParcela).not.toBeNull();
    expect(bFolgado.targetParcela).toEqual({ maxRate: 1, impossible: false, atCeiling: true });
  });
  it('busca de taxa usa economia líquida', () => {
    const free = portabilityBreakEven({ ...base, costs: 0 });
    const costly = portabilityBreakEven({ ...base, costs: 50000 });
    expect(costly.maxWorthwhileRate!).toBeLessThan(free.maxWorthwhileRate!);
  });
  it('nenhuma taxa compensa nem a 0% → maxWorthwhileRate é null', () => {
    const b = portabilityBreakEven({ ...base, newInsuranceMonthly: 1e6 });
    expect(b.maxWorthwhileRate).toBeNull();
  });
  it('custos acima de toda economia → maxWorthwhileRate null', () => {
    const b = portabilityBreakEven({ ...base, costs: 1e9 });
    expect(b.maxWorthwhileRate).toBeNull();
  });
  it('parcela alvo continua calculada mesmo sem taxa viável', () => {
    const b = portabilityBreakEven({ ...base, costs: 1e9 }, 4000);
    expect(b.maxWorthwhileRate).toBeNull();
    expect(b.targetParcela).not.toBeNull();
    expect(b.targetParcela!.maxRate).not.toBeNull();
  });
  it('busca todo o domínio [0, 1] e explicita limite superior ainda viável', () => {
    const b = portabilityBreakEven({
      ...base,
      currentAnnualRate: 1,
      insuranceMonthly: 1000,
      newInsuranceMonthly: 0,
    }, 999999);
    expect(b.maxWorthwhileRate).toBe(1);
    expect(b.maxWorthwhileAtCeiling).toBe(true);
    expect(b.targetParcela).toEqual({ maxRate: 1, impossible: false, atCeiling: true });
  });
  it('limite interno não é marcado como teto do domínio', () => {
    const b = portabilityBreakEven(base);
    expect(b.maxWorthwhileRate).toBeLessThan(1);
    expect(b.maxWorthwhileAtCeiling).toBe(false);
  });
});

describe('safeDisplayedPortabilityRate', () => {
  it('preserva zero e nunca arredonda acima do limite econômico', () => {
    expect(safeDisplayedPortabilityRate(base, 0)).toBe(0);
    const boundary = portabilityBreakEven(base).maxWorthwhileRate!;
    const safe = safeDisplayedPortabilityRate(base, boundary)!;
    expect(safe).toBeLessThanOrEqual(boundary);
    expect(safe * 100).toBe(Math.floor(boundary * 10000) / 100);
    expect(comparePortability({ ...base, newAnnualRate: safe }).economiaLiquida).toBeGreaterThanOrEqual(0);
  });
  it('revalida também a parcela alvo antes de permitir aplicação', () => {
    const target = comparePortability({ ...base, newAnnualRate: 0.07 }).ported.installments[0].parcela;
    const boundary = portabilityBreakEven(base, target).targetParcela!.maxRate!;
    const safe = safeDisplayedPortabilityRate(base, boundary, target)!;
    const result = comparePortability({ ...base, newAnnualRate: safe });
    expect(safe).toBeLessThanOrEqual(boundary);
    expect(result.economiaLiquida).toBeGreaterThanOrEqual(0);
    expect(result.ported.installments[0].parcela).toBeLessThanOrEqual(target);
  });
});
