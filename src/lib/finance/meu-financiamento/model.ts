import { pmt, simulate, convertAnnualToMonthly } from '../engine';
import type { LoanInput } from '../types';

export type ContractSystem = 'PRICE' | 'SAC';

export interface ContractParams {
  bank: string;
  system: ContractSystem;
  annualRate: number;        // efetiva a.a. (0..1)
  trMonthly: number;         // 0..0.1
  insuranceMonthly: number;  // >= 0
  parcelasTotais: number;    // inteiro 1..600
}

export interface Baseline {
  version: number;
  saldoDevedor: number;
  dataBase: string;          // 'YYYY-MM-DD'
  proximaParcelaNumero: number; // 1..parcelasTotais
}

export interface ParcelaPaga {
  parcelaNumero: number;
  valor: number;
  dataPagamento: string;     // 'YYYY-MM-DD'
}

export interface AmortizacaoExtra {
  dataPagamento: string;
  valor: number;
  origem: 'proprio' | 'fgts';
  modo: 'term' | 'payment';
}

export interface ParcelaProjetada {
  parcelaNumero: number;
  parcela: number;
  juros: number;
  seguro: number;
  amortizacao: number;
  saldo: number;
}

export interface Projecao {
  primeiraPendente: number;
  saldoEfetivo: number;
  saldoAntesExtras: number;
  parcelas: ParcelaProjetada[];
  quitaEm: number | null;
  divergencia: number;
}

export function toLoanInput(params: ContractParams, baseline: Baseline): LoanInput {
  return {
    bank: params.bank, system: params.system, principal: baseline.saldoDevedor,
    annualRate: params.annualRate,
    months: params.parcelasTotais - baseline.proximaParcelaNumero + 1,
    trMonthly: params.trMonthly, insuranceMonthly: params.insuranceMonthly,
    insuranceSplit: { taxPct: 0.25, insurancePct: 0.75 },
  };
}

export function primeiraPendente(_params: ContractParams, baseline: Baseline, pagas: ParcelaPaga[]): number {
  const pagasSet = new Set(pagas.map((p) => p.parcelaNumero));
  let n = baseline.proximaParcelaNumero;
  while (pagasSet.has(n)) n += 1;
  return n;
}

/** menor n' em [1, maxMeses] com pmt(m, n', saldo) + seguro <= parcelaAlvo (bisseção) */
function mesesParaParcela(m: number, saldo: number, seguro: number, parcelaAlvo: number, maxMeses: number): number {
  // pmt decresce com n': se nem o prazo máximo alcança a parcela alvo, não há
  // n' em [1, maxMeses] que sirva e o default é mantido
  if (pmt(m, maxMeses, saldo) + seguro > parcelaAlvo + 1e-9) return maxMeses;
  let lo = 1;
  let hi = maxMeses;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (pmt(m, mid, saldo) + seguro <= parcelaAlvo + 1e-9) hi = mid; else lo = mid + 1;
  }
  return lo;
}

export function projecao(params: ContractParams, baseline: Baseline, pagas: ParcelaPaga[], extras: AmortizacaoExtra[]): Projecao {
  const numeros = pagas.map((p) => p.parcelaNumero).sort((a, b) => a - b);
  let esperado = baseline.proximaParcelaNumero;
  for (const n of numeros) {
    if (n !== esperado) throw new Error('Parcelas pagas não são contínuas');
    esperado += 1;
  }

  const m = convertAnnualToMonthly(params.annualRate);
  const cronoOriginal = simulate(toLoanInput(params, baseline));
  const indexOriginal = (n: number) => n - baseline.proximaParcelaNumero;

  let saldo = baseline.saldoDevedor;
  let divergencia = 0;
  const pagasPorNumero = new Map(pagas.map((p) => [p.parcelaNumero, p]));
  for (const n of numeros) {
    const paga = pagasPorNumero.get(n)!;
    const projetada = cronoOriginal.installments[indexOriginal(n)].parcela;
    const juros = saldo * m;
    const correcao = saldo * params.trMonthly;
    const saldoCorrigido = saldo + correcao;
    const amortizacao = Math.min(Math.max(paga.valor - juros - params.insuranceMonthly, 0), saldoCorrigido);
    saldo = Math.max(0, saldoCorrigido - amortizacao);
    divergencia += paga.valor - projetada;
  }
  const saldoAntesExtras = saldo;
  const totalExtras = extras.reduce((soma, e) => soma + e.valor, 0);
  const saldoEfetivo = Math.max(0, saldoAntesExtras - totalExtras);
  const primeira = primeiraPendente(params, baseline, pagas);

  if (saldoEfetivo === 0) {
    return { primeiraPendente: primeira, saldoEfetivo: 0, saldoAntesExtras, parcelas: [], quitaEm: null, divergencia };
  }

  const defaultMeses = params.parcelasTotais - primeira + 1;
  let mesesFuturos = defaultMeses;
  const temTerm = extras.some((e) => e.modo === 'term');
  if (temTerm) {
    const alvo = cronoOriginal.installments[indexOriginal(primeira)];
    if (params.system === 'PRICE') {
      mesesFuturos = mesesParaParcela(m, saldoEfetivo, params.insuranceMonthly, alvo.parcela, defaultMeses);
    } else {
      const amortAlvo = Math.max(alvo.amortizacao, 1e-9);
      mesesFuturos = Math.max(1, Math.ceil(saldoEfetivo / amortAlvo - 1e-9));
    }
  }

  const futuro = simulate({
    ...toLoanInput(params, baseline),
    principal: saldoEfetivo,
    months: mesesFuturos,
  });
  let linhas = futuro.installments;
  let quitaEm: number | null;
  if (linhas.length > mesesFuturos) {
    // engine PRICE com TR>0 pagaria months+1 (parcela fantasma só de correção
    // residual + seguro): funde o resíduo na última parcela do contrato
    const residuo = linhas[mesesFuturos].saldo;
    const ultima = linhas[mesesFuturos - 1];
    linhas = linhas.slice(0, mesesFuturos);
    linhas[mesesFuturos - 1] = { ...ultima, amortizacao: ultima.amortizacao + residuo, parcela: ultima.parcela + residuo, saldo: 0 };
    quitaEm = primeira + mesesFuturos - 1;
  } else if (futuro.metrics.saldoZeroAt > 0 && futuro.metrics.saldoZeroAt <= linhas.length) {
    quitaEm = linhas[futuro.metrics.saldoZeroAt - 1].month + primeira - 1;
  } else {
    quitaEm = null;
  }
  const parcelas: ParcelaProjetada[] = linhas.map((row) => ({
    parcelaNumero: row.month + primeira - 1,
    parcela: row.parcela,
    juros: row.juros,
    seguro: row.seguro,
    amortizacao: row.amortizacao,
    saldo: row.saldo,
  }));

  return { primeiraPendente: primeira, saldoEfetivo, saldoAntesExtras, parcelas, quitaEm, divergencia };
}
