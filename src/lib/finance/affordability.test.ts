import { describe, expect, it } from 'vitest';
import { calculateAffordability, calculatePaymentAffordability } from './affordability';

const base = {
  monthlyIncome: 20000,
  paymentCap: 0,
  availableCash: 250000,
  initialCosts: 20000,
  annualRate: 0.105,
  trMonthly: 0.0017,
  insuranceMonthly: 100,
  bank: 'Caixa',
  months: 360,
};

describe('calculateAffordability', () => {
  it('gera cenários de 20%, 25% e 30% da renda', () => {
    const result = calculateAffordability(base);
    expect(result.scenarios.map((s) => s.commitmentPct)).toEqual([0.2, 0.25, 0.3]);
    expect(result.scenarios.map((s) => s.monthlyBudget)).toEqual([4000, 5000, 6000]);
  });

  it('limita orçamento pela parcela máxima informada', () => {
    const result = calculateAffordability({ ...base, paymentCap: 4500 });
    expect(result.scenarios.map((s) => s.monthlyBudget)).toEqual([4000, 4500, 4500]);
  });

  it('desconta custos iniciais do dinheiro disponível para entrada', () => {
    const result = calculateAffordability(base);
    expect(result.availableDownPayment).toBe(230000);
    const recommended = result.scenarios[1];
    expect(recommended.systems.PRICE.maxPropertyValue).toBe(
      recommended.systems.PRICE.maxFinancing + 230000
    );
  });

  it('PRICE e SAC retornam financiamento, imóvel e parcela inicial', () => {
    const recommended = calculateAffordability(base).scenarios[1];
    expect(recommended.systems.PRICE.maxFinancing).toBeGreaterThan(0);
    expect(recommended.systems.SAC.maxFinancing).toBeGreaterThan(0);
    expect(recommended.systems.PRICE.firstPayment).toBeGreaterThan(0);
    expect(recommended.systems.SAC.firstPayment).toBeGreaterThan(0);
    expect(recommended.systems.PRICE.incomeCommitmentPct).toBeLessThanOrEqual(0.25);
  });

  it('rejeita renda, prazo e custos inválidos', () => {
    expect(() => calculateAffordability({ ...base, monthlyIncome: 0 })).toThrow(/renda/i);
    expect(() => calculateAffordability({ ...base, months: 0 })).toThrow(/prazo/i);
    expect(() => calculateAffordability({ ...base, initialCosts: -1 })).toThrow(/custos/i);
  });

  it('aceita taxa zero no domínio de affordability', () => {
    const result = calculateAffordability({ ...base, annualRate: 0, trMonthly: 0 });
    expect(result.scenarios[1].systems.PRICE.maxFinancing).toBeGreaterThan(0);
  });
});

describe('calculatePaymentAffordability', () => {
  it('retorna alternativas inicial e segura com imóvel, pico e custos para PRICE e SAC', () => {
    const result = calculatePaymentAffordability({
      maxPayment: 5000,
      availableCash: 250000,
      initialCosts: 20000,
      annualRate: 0.105,
      trMonthly: 0.003,
      insuranceMonthly: 100,
      bank: 'Caixa',
      months: 360,
    });

    expect(result.availableDownPayment).toBe(230000);
    expect(result.initialCosts).toBe(20000);
    for (const system of ['PRICE', 'SAC'] as const) {
      const initial = result.systems[system].initial;
      const safe = result.systems[system].safe;
      expect(initial).not.toBeNull();
      expect(safe).not.toBeNull();
      expect(initial!.principal).toBeGreaterThanOrEqual(
        safe!.principal
      );
      expect(initial!.propertyValue).toBe(
        initial!.principal + 230000
      );
      expect(initial!.initialPayment).toBeGreaterThan(0);
      expect(initial!.peakPaymentMonth).toBeGreaterThanOrEqual(1);
      expect(safe!.peakPayment).toBeLessThanOrEqual(5000);
      expect(safe!.propertyValue).toBe(
        safe!.principal + 230000
      );
    }
  });

  it('aceita cálculo sem entrada nem renda', () => {
    const result = calculatePaymentAffordability({
      maxPayment: 5000,
      availableCash: 0,
      initialCosts: 0,
      annualRate: 0.105,
      trMonthly: 0.0017,
      insuranceMonthly: 100,
      bank: 'Caixa',
      months: 360,
    });

    expect(result.availableDownPayment).toBe(0);
    expect(result.systems.PRICE.safe?.principal).toBeGreaterThan(0);
  });

  it('rejeita parcela e valores opcionais inválidos', () => {
    const paymentBase = {
      maxPayment: 5000,
      availableCash: 0,
      initialCosts: 0,
      annualRate: 0.105,
      trMonthly: 0.0017,
      insuranceMonthly: 100,
      bank: 'Caixa',
      months: 360,
    };
    expect(() => calculatePaymentAffordability({ ...paymentBase, maxPayment: 0 })).toThrow(/parcela/i);
    expect(() => calculatePaymentAffordability({ ...paymentBase, availableCash: -1 })).toThrow(/entrada/i);
    expect(() => calculatePaymentAffordability({ ...paymentBase, initialCosts: -1 })).toThrow(/custos/i);
  });

  it('marca alternativa inicial indisponível quando cronograma não completa', () => {
    const result = calculatePaymentAffordability({
      maxPayment: 5000,
      availableCash: 0,
      initialCosts: 0,
      annualRate: 0,
      trMonthly: 0.003,
      insuranceMonthly: 100,
      bank: 'Caixa',
      months: 360,
    });

    expect(result.systems.PRICE.initial).toBeNull();
    expect(result.systems.PRICE.safe).toBeNull();
  });

  it('calcula capacidade por parcela com taxa zero', () => {
    const result = calculatePaymentAffordability({
      maxPayment: 5000,
      availableCash: 0,
      initialCosts: 0,
      annualRate: 0,
      trMonthly: 0,
      insuranceMonthly: 100,
      bank: 'Caixa',
      months: 360,
    });

    expect(result.systems.PRICE.initial?.principal).toBe((5000 - 100) * 360);
    expect(result.systems.PRICE.safe?.peakPayment).toBeLessThanOrEqual(5000);
  });
});
