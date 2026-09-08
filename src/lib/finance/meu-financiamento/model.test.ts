import { describe, expect, it } from 'vitest';
import { simulate } from '../engine';
import { projecao, primeiraPendente, toLoanInput, validateContractInput } from './model';

const PARAMS = {
  bank: 'Caixa', system: 'PRICE' as const, annualRate: 0.105, trMonthly: 0.0017,
  insuranceMonthly: 100, parcelasTotais: 360,
};
const BASELINE = { version: 1, saldoDevedor: 1000000, dataBase: '2026-09-08', proximaParcelaNumero: 141 };

it('sem movimentos, projeta do baseline e primeira pendente é a próxima parcela', () => {
  const p = projecao(PARAMS, BASELINE, [], []);
  expect(p.primeiraPendente).toBe(141);
  expect(p.saldoEfetivo).toBeCloseTo(1000000, 6);
  expect(p.parcelas[0].parcelaNumero).toBe(141);
  expect(p.parcelas[0].parcela).toBeGreaterThan(10000);
  // PRICE com TR>0: a engine pagaria months+1; a parcela fantasma é fundida na
  // última parcela do contrato, então a quitação é a parcela 360
  expect(p.quitaEm).toBe(360);
});

it('pagamento com valor da tabela encadeia e não cria divergência', () => {
  const semMov = projecao(PARAMS, BASELINE, [], []);
  const projetada141 = semMov.parcelas[0].parcela;
  const p = projecao(PARAMS, BASELINE, [{ parcelaNumero: 141, valor: projetada141, dataPagamento: '2026-10-05' }], []);
  expect(p.divergencia).toBeCloseTo(0, 6);
  expect(p.saldoEfetivo).toBeCloseTo(semMov.parcelas[0].saldo, 6);
  expect(p.primeiraPendente).toBe(142);
  expect(p.parcelas[0].parcelaNumero).toBe(142);
});

it('valor real maior que o projetado não vira amortização extra; vira divergência', () => {
  const semMov = projecao(PARAMS, BASELINE, [], []);
  const projetada = semMov.parcelas[0].parcela;
  const p = projecao(PARAMS, BASELINE, [{ parcelaNumero: 141, valor: projetada + 50, dataPagamento: '2026-10-05' }], []);
  // excedente não abate principal extra além da regra do modelo: amortização =
  // valor − juros − TR − seguro, então o saldo cai um pouco mais; a divergência
  // captura os R$ 50 para sugerir recalibração
  expect(p.divergencia).toBeCloseTo(50, 6);
});

it('pagamento parcial (não cobre juros+seguro) zera amortização e o saldo cresce só pela correção', () => {
  const p = projecao(PARAMS, BASELINE, [{ parcelaNumero: 141, valor: 1, dataPagamento: '2026-10-05' }], []);
  expect(p.saldoEfetivo).toBeCloseTo(1001700, 4);
  expect(p.saldoEfetivo).toBeGreaterThan(BASELINE.saldoDevedor);
});

it('amortização extra term reduz o prazo projetado e o saldo efetivo', () => {
  const base = projecao(PARAMS, BASELINE, [], []);
  const comExtra = projecao(PARAMS, BASELINE, [], [{ dataPagamento: '2026-09-20', valor: 100000, origem: 'proprio', modo: 'term' }]);
  expect(comExtra.saldoEfetivo).toBeCloseTo(900000, 6);
  expect(comExtra.quitaEm!).toBeLessThan(base.quitaEm!);
});

it('amortização extra payment estima parcela menor e mantém prazo', () => {
  const base = projecao(PARAMS, BASELINE, [], []);
  const comExtra = projecao(PARAMS, BASELINE, [], [{ dataPagamento: '2026-09-20', valor: 100000, origem: 'fgts', modo: 'payment' }]);
  expect(comExtra.parcelas[0].parcela).toBeLessThan(base.parcelas[0].parcela);
  // prazo: parcela futura estimada por pmt nos meses restantes
  expect(comExtra.parcelas.at(-1)!.parcelaNumero - comExtra.parcelas[0].parcelaNumero)
    .toBe(base.parcelas.at(-1)!.parcelaNumero - base.parcelas[0].parcelaNumero);
});

it('quitação: saldo efetivo zero após extras', () => {
  const p = projecao(PARAMS, { ...BASELINE, saldoDevedor: 5000 }, [{ parcelaNumero: 141, valor: 5000, dataPagamento: '2026-10-05' }],
    [{ dataPagamento: '2026-10-06', valor: 5000, origem: 'proprio', modo: 'term' }]);
  expect(p.saldoEfetivo).toBe(0);
  expect(p.quitaEm).toBeNull();
});

it('lacuna em parcelas pagas lança erro', () => {
  expect(() => projecao(PARAMS, BASELINE,
    [
      { parcelaNumero: 141, valor: 10000, dataPagamento: '2026-10-05' },
      { parcelaNumero: 143, valor: 10000, dataPagamento: '2026-11-05' },
    ], []))
    .toThrow(/contínuas/);
});

it('parcelas pagas em atraso encadeiam em sequência (141 e 142 pagas juntas)', () => {
  const p = projecao(PARAMS, BASELINE, [
    { parcelaNumero: 141, valor: 10000, dataPagamento: '2026-10-05' },
    { parcelaNumero: 142, valor: 10000, dataPagamento: '2026-10-05' },
  ], []);
  expect(p.primeiraPendente).toBe(143);
  expect(p.parcelas[0].parcelaNumero).toBe(143);
});

it('SAC: amortização extra term encurta prazo mantendo a cadência de amortização', () => {
  const sacParams = { ...PARAMS, system: 'SAC' as const };
  const base = projecao(sacParams, BASELINE, [], []);
  const comExtra = projecao(sacParams, BASELINE, [], [{ dataPagamento: '2026-09-20', valor: 200000, origem: 'proprio', modo: 'term' }]);
  expect(comExtra.saldoEfetivo).toBeCloseTo(800000, 6);
  expect(comExtra.quitaEm!).toBeLessThan(base.quitaEm!);
  // amortização mensal preservada; parcela cai (juros sobre saldo menor)
  expect(comExtra.parcelas[0].amortizacao).toBeCloseTo(base.parcelas[0].amortizacao, 6);
  expect(comExtra.parcelas[0].parcela).toBeLessThan(base.parcelas[0].parcela);
});

it('SAC: amortização extra payment reduz parcela e mantém prazo', () => {
  const sacParams = { ...PARAMS, system: 'SAC' as const };
  const base = projecao(sacParams, BASELINE, [], []);
  const comExtra = projecao(sacParams, BASELINE, [], [{ dataPagamento: '2026-09-20', valor: 200000, origem: 'fgts', modo: 'payment' }]);
  expect(comExtra.parcelas[0].parcela).toBeLessThan(base.parcelas[0].parcela);
  expect(comExtra.parcelas.at(-1)!.parcelaNumero).toBe(base.parcelas.at(-1)!.parcelaNumero);
});

it('funde a parcela fantasma da TR na última parcela do contrato sem duplicar seguro', () => {
  const p = projecao(PARAMS, BASELINE, [], []);
  const engine = simulate(toLoanInput(PARAMS, BASELINE));
  const f = engine.installments; // PRICE com TR>0: 221 linhas
  const ultima = p.parcelas.at(-1)!;
  expect(p.parcelas).toHaveLength(220);
  expect(ultima.parcelaNumero).toBe(360);
  expect(ultima.parcela).toBeCloseTo(f[219].parcela + f[220].amortizacao + f[220].juros, 6);
  expect(ultima.amortizacao).toBeCloseTo(f[219].amortizacao + f[220].amortizacao, 6);
  expect(ultima.saldo).toBe(0);
});

it('term sem n\' factível (aporte abaixo do efeito) mantém o prazo default', () => {
  const base = projecao(PARAMS, BASELINE, [], []);
  const comExtra = projecao(PARAMS, BASELINE, [], [{ dataPagamento: '2026-09-20', valor: 100, origem: 'proprio', modo: 'term' }]);
  expect(comExtra.quitaEm).toBe(base.quitaEm);
});

describe('validateContractInput', () => {
  const VALID = {
    bank: 'Caixa', system: 'PRICE', annualRate: 0.105, trMonthly: 0.0017,
    insuranceMonthly: 100, parcelasTotais: 360, saldoDevedor: 1000000,
    dataBase: '2026-09-08', proximaParcelaNumero: 141,
  };

  it('aceita payload válido de cadastro', () => {
    const r = validateContractInput(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(VALID);
  });

  it('recusa taxa anual acima de 1 (100% a.a.)', () => {
    expect(validateContractInput({ ...VALID, annualRate: 1.01 }).ok).toBe(false);
  });

  it('recusa TR mensal acima de 0.1', () => {
    expect(validateContractInput({ ...VALID, trMonthly: 0.11 }).ok).toBe(false);
  });

  it('recusa prazo 0 e prazo acima de 600', () => {
    expect(validateContractInput({ ...VALID, parcelasTotais: 0 }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, parcelasTotais: 601 }).ok).toBe(false);
  });

  it('recusa saldo devedor zero ou negativo', () => {
    expect(validateContractInput({ ...VALID, saldoDevedor: 0 }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, saldoDevedor: -1 }).ok).toBe(false);
  });

  it('recusa próxima parcela fora de 1..parcelasTotais ou fracionária', () => {
    expect(validateContractInput({ ...VALID, proximaParcelaNumero: 0 }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, proximaParcelaNumero: 361 }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, proximaParcelaNumero: 141.5 }).ok).toBe(false);
  });

  it('recusa data-base inválida (formato ou calendário)', () => {
    expect(validateContractInput({ ...VALID, dataBase: '10/05/2026' }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, dataBase: '2026-13-01' }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, dataBase: '2026-02-30' }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, dataBase: '' }).ok).toBe(false);
  });

  it('recusa system inválido', () => {
    expect(validateContractInput({ ...VALID, system: 'MIXED' }).ok).toBe(false);
  });

  it('recusa banco com mais de 60 caracteres', () => {
    expect(validateContractInput({ ...VALID, bank: 'x'.repeat(61) }).ok).toBe(false);
  });

  it('recusa payload não-objeto e campos não numéricos', () => {
    expect(validateContractInput(null).ok).toBe(false);
    expect(validateContractInput({ ...VALID, annualRate: NaN }).ok).toBe(false);
    expect(validateContractInput({ ...VALID, insuranceMonthly: '100' }).ok).toBe(false);
  });
});
