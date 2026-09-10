import { describe, expect, it } from 'vitest';
import { splitPagamento } from './split-payment';

describe('splitPagamento', () => {
  it('separa o excedente de R$ 500 como amortização', () => {
    const split = splitPagamento(1000, 1500);
    expect(split.parcela).toBeCloseTo(1000, 10);
    expect(split.amortizacao).toBeCloseTo(500, 10);
  });

  it('valor abaixo do projetado vira parcela parcial sem amortização', () => {
    const split = splitPagamento(1000, 900);
    expect(split.parcela).toBeCloseTo(900, 10);
    expect(split.amortizacao).toBe(0);
  });

  it('excedente de meio centavo ou menos não vira amortização', () => {
    const split = splitPagamento(1000, 1000.004);
    expect(split.parcela).toBeCloseTo(1000.004, 10);
    expect(split.amortizacao).toBe(0);
  });

  it('excedente acima de meio centavo vira amortização', () => {
    const split = splitPagamento(1000, 1000.006);
    expect(split.parcela).toBeCloseTo(1000, 10);
    expect(split.amortizacao).toBeCloseTo(0.006, 10);
  });

  it('excedente exatamente de meio centavo fica na parcela (limite é maior que)', () => {
    const split = splitPagamento(1000, 1000.005);
    expect(split.parcela).toBeCloseTo(1000.005, 10);
    expect(split.amortizacao).toBe(0);
  });

  it('valor igual ao projetado mantém a parcela cheia', () => {
    const split = splitPagamento(1000, 1000);
    expect(split.parcela).toBeCloseTo(1000, 10);
    expect(split.amortizacao).toBe(0);
  });
});
