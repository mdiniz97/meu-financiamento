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

  it('SAC soma os juros do contrato original sem fixar a primeira prestação', () => {
    const r = calcularInvestOuAmortizar({ ...BASE, sistema: 'SAC' });
    expect(r.jurosTotaisOriginal).toBeCloseTo(856363.5623461134, 6);
  });

  it('SAC reduzir parcela mantém amortização constante e os 360 meses', () => {
    const r = calcularInvestOuAmortizar({ ...BASE, sistema: 'SAC' });
    const rp = r.estrategias['reduzir-parcela'];
    expect(rp.quitaEmMeses).toBe(360);
    expect(rp.parcela).toBeCloseTo(4906.6282849443, 6);
    expect(rp.jurosTotais).toBeCloseTo(685090.8498768908, 6);
    expect(rp.economiaJuros).toBeCloseTo(171272.7124692226, 6);
  });

  it.each([
    { valorDisponivel: 20000, juros: 5500 },
    { valorDisponivel: 25000, juros: 5000 },
  ])('SAC reduzir prazo mantém amortização original após abater $valorDisponivel', ({ valorDisponivel, juros }) => {
    const r = calcularInvestOuAmortizar({
      saldoDevedor: 120000,
      prazoRestanteMeses: 12,
      taxaFinanciamento: 1.01 ** 12 - 1,
      valorDisponivel,
      selicAnual: 0,
      horizonteMeses: 12,
      sistema: 'SAC',
    });
    // Amortização de 10 mil/mês; o último pagamento pode amortizar só 5 mil.
    const rz = r.estrategias['reduzir-prazo'];
    expect(rz.quitaEmMeses).toBe(10);
    expect(rz.jurosTotais).toBeCloseTo(juros, 6);
    expect(rz.economiaJuros).toBeCloseTo(7800 - juros, 6);
  });

  it('SAC investir com rendimento zero reproduz o contrato original', () => {
    const r = calcularInvestOuAmortizar({ ...BASE, sistema: 'SAC', selicAnual: 0 });
    const ir = r.estrategias['investir-rendimento'];
    expect(ir.quitaEmMeses).toBe(360);
    expect(ir.jurosTotais).toBeCloseTo(856363.5623461134, 6);
    expect(ir.jurosTotais).toBe(r.jurosTotaisOriginal);
    expect(ir.economiaJuros).toBe(0);
    expect(ir.mantemPrincipal).toBe(true);
  });

  it('SAC usa rendimento líquido como amortização além da amortização contratual', () => {
    const r = calcularInvestOuAmortizar({
      saldoDevedor: 12000,
      prazoRestanteMeses: 12,
      taxaFinanciamento: 1.01 ** 12 - 1,
      valorDisponivel: 10000,
      selicAnual: 1.01 ** 12 - 1,
      horizonteMeses: 12,
      sistema: 'SAC',
    });
    // Saldo cai 1.077,50/mês por 6 meses, depois 1.080/mês; saldo final antes de pagar: 135.
    const ir = r.estrategias['investir-rendimento'];
    expect(ir.quitaEmMeses).toBe(12);
    expect(ir.jurosTotais).toBeCloseTo(728.475, 6);
    expect(ir.economiaJuros).toBeCloseTo(51.525, 6);
  });

  it('PRICE preserva prestação fixa e resultados das estratégias até quitar', () => {
    const r = calcularInvestOuAmortizar(BASE);
    expect(r.jurosTotaisOriginal).toBeCloseTo(1266960.1909783, 5);
    expect(r.estrategias['reduzir-prazo'].quitaEmMeses).toBe(158);
    expect(r.estrategias['reduzir-prazo'].jurosTotais).toBeCloseTo(371321.731592786, 5);
    expect(r.estrategias['investir-rendimento'].quitaEmMeses).toBe(179);
    expect(r.estrategias['investir-rendimento'].jurosTotais).toBeCloseTo(538932.9943894811, 5);
  });

  it.each(['SAC', 'PRICE'] as const)('%s sem juros preserva prazo sem mês extra por resíduo numérico', (sistema) => {
    for (const prazoRestanteMeses of [12, 360, 600]) {
      const r = calcularInvestOuAmortizar({
        ...BASE,
        saldoDevedor: 100000,
        valorDisponivel: 20000,
        taxaFinanciamento: 0,
        selicAnual: 0,
        horizonteMeses: prazoRestanteMeses,
        prazoRestanteMeses,
        sistema,
      });
      expect(r.estrategias['reduzir-parcela'].quitaEmMeses).toBe(prazoRestanteMeses);
      expect(r.estrategias['investir-rendimento'].quitaEmMeses).toBe(prazoRestanteMeses);
      expect(r.jurosTotaisOriginal).toBe(0);
      for (const estrategia of Object.values(r.estrategias)) {
        expect(estrategia.jurosTotais).toBe(0);
        expect(estrategia.economiaJuros).toBe(0);
      }
    }
  });

  it('PRICE não ultrapassa 600 meses por resíduo inferior a um centavo', () => {
    const r = calcularInvestOuAmortizar({
      saldoDevedor: 100000,
      prazoRestanteMeses: 600,
      taxaFinanciamento: 0.25,
      valorDisponivel: 20000,
      selicAnual: 0,
      horizonteMeses: 600,
      sistema: 'PRICE',
    });
    expect(r.estrategias['reduzir-parcela'].quitaEmMeses).toBe(600);
    expect(r.estrategias['investir-rendimento'].quitaEmMeses).toBe(600);
  });

  it.each(['SAC', 'PRICE'] as const)('%s não confunde amortização de saldo pequeno com resíduo', (sistema) => {
    const r = calcularInvestOuAmortizar({
      saldoDevedor: 1,
      prazoRestanteMeses: 600,
      taxaFinanciamento: 0,
      valorDisponivel: 0.2,
      selicAnual: 0,
      horizonteMeses: 600,
      sistema,
    });
    expect(r.estrategias['reduzir-parcela'].quitaEmMeses).toBe(600);
    expect(r.estrategias['investir-rendimento'].quitaEmMeses).toBe(600);
  });

  it.each(['SAC', 'PRICE'] as const)('%s quitar todo o saldo hoje não exige mais um mês', (sistema) => {
    const r = calcularInvestOuAmortizar({ ...BASE, sistema, valorDisponivel: BASE.saldoDevedor });
    for (const id of ['reduzir-parcela', 'reduzir-prazo'] as const) {
      expect(r.estrategias[id].quitaEmMeses).toBe(0);
      expect(r.estrategias[id].jurosTotais).toBe(0);
      expect(r.estrategias[id].economiaJuros).toBe(r.jurosTotaisOriginal);
    }
  });

  it.each(['SAC', 'PRICE'] as const)('%s mantém compatibilidade do horizonte sem truncar juros contratuais', (sistema) => {
    const curto = calcularInvestOuAmortizar({ ...BASE, sistema, horizonteMeses: 1 });
    const inteiro = calcularInvestOuAmortizar({ ...BASE, sistema, horizonteMeses: 360 });
    expect(curto).toEqual(inteiro);
  });

  it('rejeita entradas inválidas', () => {
    expect(() => calcularInvestOuAmortizar({ ...BASE, saldoDevedor: 0 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, valorDisponivel: 0 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, valorDisponivel: 600000 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, horizonteMeses: 0 })).toThrow();
    expect(() => calcularInvestOuAmortizar({ ...BASE, horizonteMeses: 400 })).toThrow();
  });

  it.each([
    ['saldoDevedor', Infinity],
    ['saldoDevedor', NaN],
    ['valorDisponivel', Infinity],
    ['valorDisponivel', NaN],
    ['taxaFinanciamento', Infinity],
    ['taxaFinanciamento', NaN],
    ['selicAnual', Infinity],
    ['selicAnual', NaN],
    ['prazoRestanteMeses', 120.5],
    ['prazoRestanteMeses', Infinity],
    ['prazoRestanteMeses', NaN],
    ['prazoRestanteMeses', 601],
    ['horizonteMeses', 1.5],
    ['horizonteMeses', Infinity],
    ['horizonteMeses', NaN],
  ] as const)('rejeita %s = %s', (field, value) => {
    expect(() => calcularInvestOuAmortizar({ ...BASE, [field]: value })).toThrow();
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
