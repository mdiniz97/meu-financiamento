import { describe, expect, it } from 'vitest';
import { calcularInvestOuAmortizar, compararPlantaOuInvestir } from './invest-ou-amortizar';

const BASE = {
  saldoDevedor: 500000,
  prazoRestanteMeses: 360,
  taxaFinanciamento: 0.12,
  valorDisponivel: 100000,
  selicAnual: 0.14,
  horizonteMeses: 120,
  sistema: 'PRICE' as const,
};

describe('calcularInvestOuAmortizar', () => {
  it('calcula os juros totais do contrato e a economia de cada estratégia', () => {
    const r = calcularInvestOuAmortizar(BASE);
    expect(r.jurosTotaisOriginal).toBeGreaterThan(500000);
    expect(r.estrategias['reduzir-prazo'].jurosTotais).toBeLessThan(r.jurosTotaisOriginal);
    expect(r.estrategias['reduzir-prazo'].economiaJuros).toBeGreaterThan(0);
    expect(r.estrategias['reduzir-parcela'].economiaJuros).toBeGreaterThan(0);
  });

  it('reduzir prazo: quita antes e economiza juros do contrato inteiro', () => {
    const r = calcularInvestOuAmortizar(BASE);
    const rz = r.estrategias['reduzir-prazo'];
    expect(rz.quitaEmMeses).not.toBeNull();
    expect(rz.quitaEmMeses!).toBeLessThan(360);
    // economia expressiva: os juros evitados sobre os 100k até o fim do contrato
    expect(rz.economiaJuros).toBeGreaterThan(100000);
  });

  it('reduzir parcela: parcela cai e o prazo permanece', () => {
    const r = calcularInvestOuAmortizar(BASE);
    const rp = r.estrategias['reduzir-parcela'];
    expect(rp.parcela).toBeLessThan(r.parcelaOriginal);
    expect(rp.quitaEmMeses).toBe(360);
  });

  it('investir e amortizar com o rendimento: mantém os 100k e quita mais rápido', () => {
    const r = calcularInvestOuAmortizar(BASE);
    const ir = r.estrategias['investir-rendimento'];
    expect(ir.mantemPrincipal).toBe(true);
    expect(ir.quitaEmMeses).not.toBeNull();
    expect(ir.quitaEmMeses!).toBeLessThan(360);
    expect(ir.economiaJuros).toBeGreaterThan(0);
  });

  it('um dos cenários tem a maior economia e é apontado', () => {
    const r = calcularInvestOuAmortizar(BASE);
    expect(['reduzir-parcela', 'reduzir-prazo', 'investir-rendimento']).toContain(r.melhorEconomia);
    const melhor = r.estrategias[r.melhorEconomia];
    for (const id of ['reduzir-parcela', 'reduzir-prazo', 'investir-rendimento'] as const) {
      expect(melhor.economiaJuros).toBeGreaterThanOrEqual(r.estrategias[id].economiaJuros);
    }
  });

  it('o cenário investir mantém o principal e quita com o rendimento', () => {
    const r = calcularInvestOuAmortizar(BASE);
    const ir = r.estrategias['investir-rendimento'];
    expect(ir.mantemPrincipal).toBe(true);
    expect(ir.economiaJuros).toBeGreaterThan(0);
    const rz = r.estrategias['reduzir-prazo'];
    // quem amortiza todo o valor economiza mais juros no contrato
    expect(rz.economiaJuros).toBeGreaterThan(ir.economiaJuros);
  });

  it('SAC: primeira parcela maior que a PRICE', () => {
    const r = calcularInvestOuAmortizar({ ...BASE, sistema: 'SAC' });
    const taxaMensal = Math.pow(1.12, 1 / 12) - 1;
    const amortizacao = 500000 / 360;
    expect(r.parcelaOriginal).toBeCloseTo(amortizacao + 500000 * taxaMensal, 2);
    expect(r.parcelaOriginal).toBeGreaterThan(
      calcularInvestOuAmortizar({ ...BASE, sistema: 'PRICE' }).parcelaOriginal
    );
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularInvestOuAmortizar({ ...BASE, saldoDevedor: 0 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, valorDisponivel: 0 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, valorDisponivel: 600000 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, horizonteMeses: 0 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, horizonteMeses: 400 })).toThrow();
  });
});

describe('compararPlantaOuInvestir', () => {
  it('mostra quanto sobra investindo vs o custo de comprar até a entrega', () => {
    const r = compararPlantaOuInvestir({
      entrada: 100000,
      mesesAteEntrega: 24,
      custoJurosDeObra: 42000,
      selicAnual: 0.14,
    });
    expect(r.entradaFinal).toBeGreaterThan(100000);
    expect(r.rendimentoLiquido).toBeGreaterThan(0);
    expect(r.coberturaPct).toBeGreaterThan(0);
    expect(r.veredito).toBe('comprar');
  });

  it('rendimento cobre os juros de obra: investir deixa mais dinheiro', () => {
    const r = compararPlantaOuInvestir({
      entrada: 100000,
      mesesAteEntrega: 24,
      custoJurosDeObra: 5000,
      selicAnual: 0.14,
    });
    expect(r.veredito).toBe('investir');
    expect(r.coberturaPct).toBeGreaterThan(100);
  });
});
