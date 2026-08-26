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

export function validateLoanInput(input: LoanInput, strategies?: Strategies): void {
  const check = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`input inválido: ${msg}`);
  };
  check(Number.isFinite(input.principal) && input.principal > 0, 'valor financiado deve ser maior que zero');
  check(Number.isFinite(input.months) && input.months >= 1 && input.months <= 600, 'prazo deve estar entre 1 e 600 meses');
  check(Number.isFinite(input.annualRate) && input.annualRate >= 0 && input.annualRate <= 1, 'taxa anual deve estar entre 0 e 100%');
  check(Number.isFinite(input.trMonthly) && input.trMonthly >= 0 && input.trMonthly <= 0.1, 'TR mensal deve estar entre 0 e 10%');
  check(Number.isFinite(input.insuranceMonthly) && input.insuranceMonthly >= 0, 'seguro mensal não pode ser negativo');
  check(input.system === 'PRICE' || input.system === 'SAC', 'sistema deve ser PRICE ou SAC');
  const s = strategies ?? emptyStrategies();
  check(Array.isArray(s.extraLumpSum), 'amortizações extras inválidas');
  for (const e of s.extraLumpSum) {
    check(Number.isFinite(e.month) && e.month >= 1, 'mês de amortização extra inválido');
    check(Number.isFinite(e.amount) && e.amount > 0, 'valor de amortização extra inválido');
  }
  if (s.extraMonthlyPct !== undefined) {
    check(Number.isFinite(s.extraMonthlyPct) && s.extraMonthlyPct >= 0 && s.extraMonthlyPct <= 1, 'percentual extra deve estar entre 0 e 100%');
  }
  if (s.fgtsAnnual !== undefined) {
    check(Number.isFinite(s.fgtsAnnual) && s.fgtsAnnual >= 0, 'FGTS anual não pode ser negativo');
  }
  if (s.portability !== undefined) {
    check(Number.isFinite(s.portability.annualRate) && s.portability.annualRate >= 0 && s.portability.annualRate <= 1, 'taxa de portabilidade inválida');
    check(Number.isFinite(s.portability.insuranceMonthly) && s.portability.insuranceMonthly >= 0, 'seguro de portabilidade inválido');
  }
  check(s.reduceMode === 'payment' || s.reduceMode === 'term', 'modo de redução inválido');
}

export function simulate(input: LoanInput, strategies: Strategies = emptyStrategies()): SimulationResult {
  validateLoanInput(input, strategies);
  // portabilidade: recontrata do mês 1 com nova taxa e novo seguro
  const m = convertAnnualToMonthly(strategies.portability?.annualRate ?? input.annualRate);
  const seguroMensal = strategies.portability?.insuranceMonthly ?? input.insuranceMonthly;
  const installments: Installment[] = [];
  let saldo = input.principal;
  let parcelaAnterior = 0;
  let modoPayment = false;
  let mesesRestantesFixos = input.months;

  for (let month = 1; month <= input.months + 360; month++) {
    if (saldo <= 1e-9) break;
    const juros = saldo * m;
    const correcao = saldo * input.trMonthly;

    let amortizacao: number;
    let parcela: number;
    if (input.system === 'PRICE') {
      const pagamentoNper = parcelaAnterior > 0 ? parcelaAnterior - seguroMensal : 0;
      const pvNper = parcelaAnterior > 0 ? saldo - correcao : 0;
      let mesesRestantes = pagamentoNper > 0 ? nper(m, pagamentoNper, pvNper) : input.months;
      if (modoPayment) mesesRestantes = mesesRestantesFixos;
      parcela = pmt(m, mesesRestantes, saldo) + seguroMensal;
      amortizacao = Math.min(Math.max(parcela - juros - seguroMensal, 0), saldo);
    } else {
      amortizacao = month === 1
        ? input.principal / input.months
        : modoPayment
          ? saldo / mesesRestantesFixos
          : (saldo + correcao) / (input.months - month + 1);
      if (month > 1) amortizacao = Math.ceil(amortizacao * 100) / 100;
      amortizacao = Math.min(amortizacao, saldo + correcao);
      parcela = amortizacao + juros + seguroMensal;
    }

    let extra = 0;
    const pctExtra = parcela * (strategies.extraMonthlyPct ?? 0);
    if (pctExtra > 0) extra += Math.min(pctExtra, Math.max(saldo - amortizacao, 0));
    const lump = strategies.extraLumpSum.find((e) => e.month === month)?.amount ?? 0;
    if (lump > 0) extra += Math.min(lump, Math.max(saldo - amortizacao - extra, 0));
    if (strategies.fgtsAnnual && month % 12 === 0)
      extra += Math.min(strategies.fgtsAnnual, Math.max(saldo - amortizacao - extra, 0));

    parcela += extra;
    amortizacao += extra;
    saldo = Math.max(0, saldo - amortizacao + correcao);
    if (saldo < 1e-9) saldo = 0;
    parcelaAnterior = parcela;

    if (strategies.reduceMode === 'payment' && extra > 0 && saldo > 0 && !modoPayment) {
      modoPayment = true;
      mesesRestantesFixos = Math.max(1, Math.round(nper(m, Math.max(parcela - seguroMensal - extra, 1e-9), saldo)));
    }

    const valorUtil = amortizacao - correcao;
    installments.push({
      month, juros, amortizacao, seguro: seguroMensal, correcao, extra,
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
