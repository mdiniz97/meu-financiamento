import type { Installment, LoanInput, SimulationResult, Strategies } from './types';

export function convertAnnualToMonthly(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function pmt(monthlyRate: number, months: number, principal: number): number {
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function irrMonthly(cashFlows: number[]): number {
  const f = (r: number) => cashFlows.reduce((acc, c, i) => acc + c / Math.pow(1 + r, i), 0);
  let lo = 0, hi = 10;
  const increasing = f(hi) > f(lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if ((fm > 0) === increasing) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function nper(rate: number, payment: number, pv: number): number {
  return -Math.log(1 - (pv * rate) / payment) / Math.log(1 + rate);
}

export function simulate(input: LoanInput, strategies: Strategies = emptyStrategies()): SimulationResult {
  const m = convertAnnualToMonthly(input.annualRate);
  const installments: Installment[] = [];
  let saldo = input.principal;
  let parcelaAnterior = 0;

  for (let month = 1; month <= input.months + 360; month++) {
    if (saldo <= 1e-9) break;
    const juros = saldo * m;
    const correcao = saldo * input.trMonthly;

    let amortizacao: number;
    let parcela: number;
    if (input.system === 'PRICE') {
      const pagamentoNper = parcelaAnterior > 0 ? parcelaAnterior - input.insuranceMonthly : 0;
      const pvNper = parcelaAnterior > 0 ? saldo - correcao : 0;
      const mesesRestantes = pagamentoNper > 0 ? nper(m, pagamentoNper, pvNper) : input.months;
      parcela = pmt(m, mesesRestantes, saldo) + input.insuranceMonthly;
      amortizacao = Math.min(Math.max(parcela - juros - input.insuranceMonthly, 0), saldo);
    } else {
      amortizacao = month === 1
        ? input.principal / input.months
        : (saldo + correcao) / (input.months - month + 1);
      if (month > 1) amortizacao = Math.ceil(amortizacao * 100) / 100;
      amortizacao = Math.min(amortizacao, saldo + correcao);
      parcela = amortizacao + juros + input.insuranceMonthly;
    }

    const seguro = input.insuranceMonthly;
    saldo = Math.max(0, saldo - amortizacao + correcao);
    if (saldo < 1e-9) saldo = 0;
    parcelaAnterior = parcela;

    const valorUtil = amortizacao - correcao;
    installments.push({
      month, juros, amortizacao, seguro, correcao, extra: 0,
      parcela, saldo, valorUtil,
      pctValorUtil: valorUtil / parcela,
    });
  }

  const flows = [input.principal, ...installments.map((i) => -i.parcela)];
  const cetMensal = irrMonthly(flows);
  const totals = installments.reduce(
    (acc, i) => ({
      totalPago: acc.totalPago + i.parcela,
      totalJuros: acc.totalJuros + i.juros,
      totalAmortizacao: acc.totalAmortizacao + i.amortizacao,
      totalCorrecao: acc.totalCorrecao + i.correcao,
      totalSeguro: acc.totalSeguro + i.seguro,
    }),
    { totalPago: 0, totalJuros: 0, totalAmortizacao: 0, totalCorrecao: 0, totalSeguro: 0 }
  );

  const metrics = {
    ...totals,
    cetRealAnual: Math.pow(1 + cetMensal, 12) - 1,
    dividaAlemDaDivida: totals.totalPago - input.principal,
    dividaCai12m: input.principal - (installments[Math.min(11, installments.length - 1)]?.saldo ?? 0),
    dividaCai3a: input.principal - (installments[Math.min(35, installments.length - 1)]?.saldo ?? 0),
    saldoZeroAt: installments.length,
    parcelaPagaDividaPct: installments[0].amortizacao / input.principal,
  };

  return { system: input.system, input, strategies, installments, metrics };
}

function emptyStrategies(): Strategies {
  return { extraLumpSum: [], reduceMode: 'term' };
}
