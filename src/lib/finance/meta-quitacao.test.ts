import { describe, expect, it } from 'vitest';
import { calcularMetaQuitacao } from './meta-quitacao';

const BASE = {
  saldoDevedor: 400000,
  taxaFinanciamento: 0.12,
  prazoRestanteMeses: 360,
  sistema: 'PRICE' as const,
  metaMeses: 120,
};

describe('calcularMetaQuitacao', () => {
  it('calcula o aporte mensal para quitar na meta', () => {
    const r = calcularMetaQuitacao(BASE);
    const i = Math.pow(1.12, 1 / 12) - 1;
    const parcelaAtual = (400000 * i) / (1 - Math.pow(1 + i, -360));
    const pagamentoMeta = (400000 * i) / (1 - Math.pow(1 + i, -120));
    expect(r.parcelaAtual).toBeCloseTo(parcelaAtual, 2);
    expect(r.pagamentoTotal).toBeCloseTo(pagamentoMeta, 2);
    expect(r.aporteMensal).toBeCloseTo(pagamentoMeta - parcelaAtual, 2);
    expect(r.aporteMensal).toBeGreaterThan(0);
  });

  it('quitar na meta economiza juros vs o contrato original', () => {
    const r = calcularMetaQuitacao(BASE);
    expect(r.jurosTotais).toBeLessThan(r.jurosOriginais);
    expect(r.economiaJuros).toBeCloseTo(r.jurosOriginais - r.jurosTotais, 2);
    expect(r.economiaJuros).toBeGreaterThan(0);
  });

  it.each([
    { sistema: 'PRICE', metaMeses: 360 },
    { sistema: 'PRICE', metaMeses: 480 },
    { sistema: 'SAC', metaMeses: 360 },
    { sistema: 'SAC', metaMeses: 480 },
  ] as const)('$sistema preserva contrato quando a meta é $metaMeses meses', (input) => {
    const r = calcularMetaQuitacao({ ...BASE, ...input });
    expect(r.aporteMensal).toBe(0);
    expect(r.pagamentoTotal).toBe(r.parcelaAtual);
    expect(r.jurosTotais).toBe(r.jurosOriginais);
    expect(r.economiaJuros).toBe(0);
    expect(r.metaMaiorQuePrazo).toBe(true);
  });

  it('SAC soma os juros sobre os saldos decrescentes do contrato original', () => {
    const r = calcularMetaQuitacao({ ...BASE, sistema: 'SAC' });
    expect(r.jurosOriginais).toBeCloseTo(685090.8498768908, 6);
  });

  it.each([120, 180])('SAC usa aporte extra fixo e amortização constante até %i meses', (metaMeses) => {
    const input = { ...BASE, sistema: 'SAC' as const, metaMeses };
    const r = calcularMetaQuitacao(input);
    const i = Math.expm1(Math.log1p(input.taxaFinanciamento) / 12);
    const amortizacaoOriginal = input.saldoDevedor / input.prazoRestanteMeses;
    const amortizacaoMeta = input.saldoDevedor / metaMeses;
    expect(r.metaMaiorQuePrazo).toBe(false);
    expect(r.aporteMensal).toBeCloseTo(amortizacaoMeta - amortizacaoOriginal, 8);
    expect(r.aporteMensal).toBeGreaterThan(0);
    expect(r.pagamentoTotal).toBeCloseTo(r.parcelaAtual + r.aporteMensal, 8);
    expect(r.pagamentoTotal).toBeGreaterThan(r.parcelaAtual);

    let saldo = input.saldoDevedor;
    let juros = 0;
    let pagamentoAnterior = Infinity;
    for (let mes = 1; mes <= metaMeses; mes += 1) {
      const jurosMes = saldo * i;
      const boleto = amortizacaoOriginal + jurosMes;
      const pagamento = boleto + r.aporteMensal;
      const amortizacao = pagamento - jurosMes;
      if (mes === 1) expect(pagamento).toBeCloseTo(r.pagamentoTotal, 8);
      expect(pagamento).toBeGreaterThan(boleto);
      expect(pagamento).toBeLessThan(pagamentoAnterior);
      expect(amortizacao).toBeCloseTo(amortizacaoMeta, 8);
      saldo -= amortizacao;
      juros += jurosMes;
      pagamentoAnterior = pagamento;
      if (mes < metaMeses) expect(saldo).toBeGreaterThan(0);
    }
    expect(saldo).toBeCloseTo(0, 6);
    expect(r.jurosTotais).toBeCloseTo(juros, 6);
    expect(r.economiaJuros).toBeCloseTo(685090.8498768908 - juros, 6);
  });

  it.each(['SAC', 'PRICE'] as const)('%s sem juros não cria custo nem aporte negativo', (sistema) => {
    const r = calcularMetaQuitacao({ ...BASE, sistema, taxaFinanciamento: 0 });
    expect(r.aporteMensal).toBeCloseTo(400000 / 120 - 400000 / 360, 8);
    expect(r.pagamentoTotal).toBeCloseTo(400000 / 120, 8);
    expect(r.jurosOriginais).toBe(0);
    expect(r.jurosTotais).toBe(0);
    expect(r.economiaJuros).toBe(0);
  });

  it('SAC usa a parcela inicial como referência', () => {
    const r = calcularMetaQuitacao({ ...BASE, sistema: 'SAC' });
    const i = Math.pow(1.12, 1 / 12) - 1;
    expect(r.parcelaAtual).toBeCloseTo(400000 / 360 + 400000 * i, 2);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularMetaQuitacao({ ...BASE, saldoDevedor: 0 })).toThrow();
    expect(() => calcularMetaQuitacao({ ...BASE, metaMeses: 0 })).toThrow();
    expect(() => calcularMetaQuitacao({ ...BASE, taxaFinanciamento: -0.1 })).toThrow();
  });

  it.each([
    ['saldoDevedor', Infinity],
    ['saldoDevedor', NaN],
    ['taxaFinanciamento', Infinity],
    ['taxaFinanciamento', NaN],
    ['prazoRestanteMeses', 1.5],
    ['prazoRestanteMeses', Infinity],
    ['prazoRestanteMeses', NaN],
    ['prazoRestanteMeses', 601],
    ['metaMeses', 1.5],
    ['metaMeses', Infinity],
    ['metaMeses', NaN],
    ['metaMeses', 601],
  ] as const)('rejeita %s = %s', (field, value) => {
    expect(() => calcularMetaQuitacao({ ...BASE, [field]: value })).toThrow();
  });
});
