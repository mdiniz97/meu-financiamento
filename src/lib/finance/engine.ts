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
  check(
    Number.isFinite(input.principal) && input.principal > 0 && input.principal <= 1_000_000_000_000,
    'valor financiado deve ser maior que zero e no máximo R$ 1 trilhão'
  );
  check(typeof input.bank === 'string' && input.bank.length <= 60, 'banco inválido');
  check(Number.isFinite(input.months) && input.months >= 1 && input.months <= 600, 'prazo deve estar entre 1 e 600 meses');
  check(Number.isFinite(input.annualRate) && input.annualRate >= 0 && input.annualRate <= 1, 'taxa anual deve estar entre 0 e 100%');
  check(Number.isFinite(input.trMonthly) && input.trMonthly >= 0 && input.trMonthly <= 0.1, 'TR mensal deve estar entre 0 e 10%');
  check(Number.isFinite(input.insuranceMonthly) && input.insuranceMonthly >= 0, 'seguro mensal não pode ser negativo');
  check(input.system === 'PRICE' || input.system === 'SAC', 'sistema deve ser PRICE ou SAC');
  const s = strategies ?? emptyStrategies();
  check(Array.isArray(s.extraLumpSum), 'amortizações extras inválidas');
  for (const e of s.extraLumpSum) {
    check(Number.isFinite(e.month) && e.month >= 1, 'mês de amortização extra inválido');
    // valor 0 é permitido (aporte inerte, ex: campo apagado pelo usuário)
    check(Number.isFinite(e.amount) && e.amount >= 0, 'valor de amortização extra inválido');
  }
  if (s.extraMonthlyPct !== undefined) {
    check(Number.isFinite(s.extraMonthlyPct) && s.extraMonthlyPct >= 0 && s.extraMonthlyPct <= 1, 'percentual extra deve estar entre 0 e 100%');
  }
  if (s.fgtsAnnual !== undefined) {
    check(Number.isFinite(s.fgtsAnnual) && s.fgtsAnnual >= 0, 'FGTS anual não pode ser negativo');
  }
  if (s.recurringExtra !== undefined) {
    check(Number.isFinite(s.recurringExtra.amount) && s.recurringExtra.amount >= 0, 'valor de aporte recorrente inválido');
    check(Number.isInteger(s.recurringExtra.every) && s.recurringExtra.every >= 1, 'intervalo do aporte recorrente inválido');
    check(Number.isInteger(s.recurringExtra.startMonth) && s.recurringExtra.startMonth >= 1, 'mês inicial do aporte recorrente inválido');
  }
  if (s.portability !== undefined) {
    check(Number.isFinite(s.portability.annualRate) && s.portability.annualRate >= 0 && s.portability.annualRate <= 1, 'taxa de portabilidade inválida');
    check(Number.isFinite(s.portability.insuranceMonthly) && s.portability.insuranceMonthly >= 0, 'seguro de portabilidade inválido');
  }
  check(s.reduceMode === 'payment' || s.reduceMode === 'term', 'modo de redução inválido');
  if (s.paySacParcela !== undefined) {
    check(typeof s.paySacParcela === 'boolean', 'opção pagar parcela do SAC inválida');
  }
  if (s.fixedPayment !== undefined) {
    check(Number.isFinite(s.fixedPayment.amount) && s.fixedPayment.amount > 0, 'valor do pagamento fixo inválido');
    if (s.fixedPayment.untilMonth !== undefined) {
      check(Number.isInteger(s.fixedPayment.untilMonth) && s.fixedPayment.untilMonth >= 1, 'mês final do pagamento fixo inválido');
    }
  }
}

export function simulate(input: LoanInput, strategies: Strategies = emptyStrategies()): SimulationResult {
  validateLoanInput(input, strategies);
  // portabilidade: recontrata do mês 1 com nova taxa e novo seguro
  const m = convertAnnualToMonthly(strategies.portability?.annualRate ?? input.annualRate);
  const seguroMensal = strategies.portability?.insuranceMonthly ?? input.insuranceMonthly;
  const installments: Installment[] = [];
  let saldo = input.principal;
  let parcelaBase = 0;
  let modoPayment = false;
  let mesesRestantesFixos = input.months;
  let parcelaFixada = 0; // PRICE: nova parcela (fixa) no modo "reduzir parcela"
  let amortizacaoFixada = 0; // SAC: nova amortização (fixa) no modo "reduzir parcela"
  // taxa efetiva que cobre juros + correção monetária (TR): usada no modo
  // "reduzir parcela" para que a parcela reduzida continue amortizando o saldo
  const mEff = (1 + m) * (1 + input.trMonthly) - 1;
  // cronograma base de amortização SAC (sem estratégias): usado no modo
  // "reduzir prazo": a amortização contratual mantida encurta o prazo quando
  // há aportes (senão a amortização se redetermina e o prazo fica fixo)
  const baseSacAmort: number[] = [];
  if (input.system === 'SAC') {
    let bs = input.principal;
    for (let t = 1; t <= input.months; t++) {
      const corr = bs * input.trMonthly;
      let a = t === 1 ? input.principal / input.months : (bs + corr) / (input.months - t + 1);
      if (t > 1) a = Math.ceil(a * 100) / 100;
      baseSacAmort.push(Math.min(a, bs + corr));
      bs = Math.max(0, bs - a + corr);
    }
  }
  // cronograma de parcelas do PRICE base (sem estratégias) — no modo termo a
  // parcela segue esse cronograma contratual, imune a aportes (evita drift:
  // amortização extra não pode aumentar o total pago)
  const basePriceParcela: number[] = [];
  if (input.system === 'PRICE') {
    let bs = input.principal;
    let prevP = 0;
    for (let t = 1; t <= input.months + 360; t++) {
      if (bs <= 1e-9) break;
      const corr = bs * input.trMonthly;
      const pagNper = prevP > 0 ? prevP - seguroMensal : 0;
      const pvNper = prevP > 0 ? bs - corr : 0;
      const rem = pagNper > 0 ? nper(m, pagNper, pvNper) : input.months;
      const parcela = pmt(m, rem, bs) + seguroMensal;
      const amort = Math.min(Math.max(parcela - bs * m - seguroMensal, 0), bs);
      basePriceParcela.push(parcela);
      bs = Math.max(0, bs - amort + corr);
      prevP = parcela;
    }
  }
  // cronograma de parcelas do SAC base (mesmo contrato): para a opção
  // "pagar parcela do SAC" no PRICE: a diferença vira amortização extra
  const sacParcelas: number[] = [];
  if (input.system === 'PRICE' && strategies.paySacParcela) {
    let bs = input.principal;
    for (let t = 1; t <= input.months; t++) {
      const corr = bs * input.trMonthly;
      const juros = bs * m;
      let a = t === 1 ? input.principal / input.months : (bs + corr) / (input.months - t + 1);
      if (t > 1) a = Math.ceil(a * 100) / 100;
      a = Math.min(a, bs + corr);
      sacParcelas.push(a + juros + seguroMensal);
      bs = Math.max(0, bs - a + corr);
    }
  }

  for (let month = 1; month <= input.months + 360; month++) {
    if (saldo <= 1e-9) break;
    const juros = saldo * m;
    const correcao = saldo * input.trMonthly;

    let amortizacao: number;
    let parcela: number;
    if (input.system === 'PRICE') {
      if (modoPayment) {
        parcela = parcelaFixada;
        amortizacao = Math.min(Math.max(parcela - juros - seguroMensal, 0), saldo);
      } else {
        // modo termo: parcela-alvo do cronograma contratual base (imune a
        // aportes); o pago real é juros + amortização (cap) + seguro
        const alvo = basePriceParcela[month - 1] ?? (parcelaBase > 0
          ? pmt(m, nper(m, parcelaBase - seguroMensal, saldo - correcao), saldo) + seguroMensal
          : pmt(m, input.months, saldo) + seguroMensal);
        amortizacao = Math.min(Math.max(alvo - juros - seguroMensal, 0), saldo);
        parcela = juros + amortizacao + seguroMensal;
      }
    } else {
      // modo termo: mantém a amortização do cronograma contratual: aportes
      // encurtam o prazo; modo payment: amortização fixa que cobre a TR
      amortizacao = modoPayment
        ? amortizacaoFixada
        : month === 1
          ? input.principal / input.months
          : baseSacAmort[month - 1];
      // Arredondamento que espelha a planilha de referência: no SAC, a
      // amortização é arredondada para cima (2 casas) a partir do mês 2.
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
    const rec = strategies.recurringExtra;
    if (rec && month >= rec.startMonth && (month - rec.startMonth) % rec.every === 0)
      extra += Math.min(rec.amount, Math.max(saldo - amortizacao - extra, 0));
    const fp = strategies.fixedPayment;
    if (fp && (!fp.untilMonth || month <= fp.untilMonth)) {
      // pagamento fixo: parcela + aporte = exatamente `amount` (ou a parcela,
      // se a parcela já ultrapassar o valor fixo)
      const extraFixo = Math.max(0, fp.amount - parcela);
      if (extraFixo > 0) extra += Math.min(extraFixo, Math.max(saldo - amortizacao - extra, 0));
    }
    if (strategies.paySacParcela && input.system === 'PRICE' && sacParcelas[month - 1] !== undefined) {
      // paga o que pagaria no SAC: a diferença (SAC − PRICE) vira amortização
      const extraSac = Math.max(0, sacParcelas[month - 1] - parcela);
      if (extraSac > 0) extra += Math.min(extraSac, Math.max(saldo - amortizacao - extra, 0));
    }

    parcelaBase = parcela; // ancora da recorrência NPER: parcela CONTRATUAL, sem extra
    parcela += extra;
    amortizacao += extra;
    saldo = Math.max(0, saldo - amortizacao + correcao);
    if (saldo < 1e-9) saldo = 0;

    if (strategies.reduceMode === 'payment' && extra > 0 && saldo > 0 && !modoPayment) {
      // "reduzir parcela" mantém o prazo contratual restante, com a menor
      // parcela que ainda abate o saldo + correção (TR)
      mesesRestantesFixos = Math.max(1, input.months - month);
      const parcelaAtual = parcela - extra;
      let novaParcela: number;
      if (input.system === 'PRICE') {
        novaParcela = pmt(mEff, mesesRestantesFixos, saldo) + seguroMensal;
      } else {
        const novaAmort = pmt(input.trMonthly, mesesRestantesFixos, saldo);
        novaParcela = novaAmort + juros + seguroMensal;
      }
      if (novaParcela < parcelaAtual) {
        // só reduz a parcela se o mínimo que abate for menor que a atual;
        // senão mantém o comportamento normal (aporte só ajuda aos poucos)
        modoPayment = true;
        if (input.system === 'PRICE') {
          parcelaFixada = novaParcela;
        } else {
          amortizacaoFixada = pmt(input.trMonthly, mesesRestantesFixos, saldo);
        }
      }
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
    paymentApplied: modoPayment,
  };

  return { system: input.system, input, strategies, installments, metrics };
}

function emptyStrategies(): Strategies {
  return { extraLumpSum: [], reduceMode: 'term' };
}
