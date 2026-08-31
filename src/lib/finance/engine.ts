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
  if (rate === 0) return pv / payment;
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
  check(Number.isInteger(input.months) && input.months >= 1 && input.months <= 600, 'prazo deve ser inteiro entre 1 e 600 meses');
  check(Number.isFinite(input.annualRate) && input.annualRate >= 0 && input.annualRate <= 1, 'taxa anual deve estar entre 0 e 100%');
  check(Number.isFinite(input.trMonthly) && input.trMonthly >= 0 && input.trMonthly <= 0.1, 'TR mensal deve estar entre 0 e 10%');
  check(Number.isFinite(input.insuranceMonthly) && input.insuranceMonthly >= 0, 'seguro mensal não pode ser negativo');
  check(input.system === 'PRICE' || input.system === 'SAC', 'sistema deve ser PRICE ou SAC');
  const s = strategies ?? emptyStrategies();
  check(Array.isArray(s.extraLumpSum), 'amortizações extras inválidas');
  for (const e of s.extraLumpSum) {
    check(Number.isFinite(e.month) && e.month >= 1 && e.month <= input.months, 'mês de amortização extra inválido (não pode passar do prazo do contrato)');
    // valor 0 é permitido (aporte inerte, ex: campo apagado pelo usuário)
    check(Number.isFinite(e.amount) && e.amount >= 0, 'valor de amortização extra inválido');
    if (e.reduceMode !== undefined) {
      check(e.reduceMode === 'term' || e.reduceMode === 'payment', 'modo de redução inválido no aporte');
    }
  }
  if (s.extraMonthlyPct !== undefined) {
    check(Number.isFinite(s.extraMonthlyPct) && s.extraMonthlyPct >= 0 && s.extraMonthlyPct <= 1, 'percentual extra deve estar entre 0 e 100%');
  }
  if (s.extraMonthlyPctReduceMode !== undefined) {
    check(s.extraMonthlyPctReduceMode === 'term' || s.extraMonthlyPctReduceMode === 'payment', 'modo do percentual extra inválido');
  }
  if (s.extraMonthlyPctStartMonth !== undefined) {
    check(Number.isInteger(s.extraMonthlyPctStartMonth) && s.extraMonthlyPctStartMonth >= 1 && s.extraMonthlyPctStartMonth <= input.months, 'mês inicial do percentual extra inválido (não pode passar do prazo do contrato)');
  }
  if (s.extraMonthlyPctUntilMonth !== undefined) {
    check(
      Number.isInteger(s.extraMonthlyPctUntilMonth) && s.extraMonthlyPctUntilMonth >= 1 && s.extraMonthlyPctUntilMonth <= input.months,
      'mês final do percentual extra inválido (não pode passar do prazo do contrato)'
    );
  }
  if (s.fgtsAnnual !== undefined) {
    check(Number.isFinite(s.fgtsAnnual.amount) && s.fgtsAnnual.amount >= 0, 'FGTS anual não pode ser negativo');
    if (s.fgtsAnnual.startMonth !== undefined) {
      check(Number.isInteger(s.fgtsAnnual.startMonth) && s.fgtsAnnual.startMonth >= 1 && s.fgtsAnnual.startMonth <= input.months, 'mês inicial do FGTS inválido (não pode passar do prazo do contrato)');
    }
    if (s.fgtsAnnual.untilMonth !== undefined) {
      check(Number.isInteger(s.fgtsAnnual.untilMonth) && s.fgtsAnnual.untilMonth >= 1 && s.fgtsAnnual.untilMonth <= input.months, 'mês final do FGTS inválido (não pode passar do prazo do contrato)');
    }
    if (s.fgtsAnnual.reduceMode !== undefined) {
      check(s.fgtsAnnual.reduceMode === 'term' || s.fgtsAnnual.reduceMode === 'payment', 'modo do FGTS inválido');
    }
  }
  if (s.recurringExtra !== undefined) {
    check(Number.isFinite(s.recurringExtra.amount) && s.recurringExtra.amount >= 0, 'valor de aporte recorrente inválido');
    check(Number.isInteger(s.recurringExtra.every) && s.recurringExtra.every >= 1, 'intervalo do aporte recorrente inválido');
    check(Number.isInteger(s.recurringExtra.startMonth) && s.recurringExtra.startMonth >= 1 && s.recurringExtra.startMonth <= input.months, 'mês inicial do aporte recorrente inválido (não pode passar do prazo do contrato)');
    if (s.recurringExtra.untilMonth !== undefined) {
      check(Number.isInteger(s.recurringExtra.untilMonth) && s.recurringExtra.untilMonth >= 1 && s.recurringExtra.untilMonth <= input.months, 'mês final do aporte recorrente inválido (não pode passar do prazo do contrato)');
    }
    if (s.recurringExtra.reduceMode !== undefined) {
      check(s.recurringExtra.reduceMode === 'term' || s.recurringExtra.reduceMode === 'payment', 'modo do aporte recorrente inválido');
    }
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
    check(Number.isFinite(s.fixedPayment.amount) && s.fixedPayment.amount >= 0, 'valor do pagamento fixo inválido');
    if (s.fixedPayment.startMonth !== undefined) {
      check(Number.isInteger(s.fixedPayment.startMonth) && s.fixedPayment.startMonth >= 1 && s.fixedPayment.startMonth <= input.months, 'mês inicial do pagamento fixo inválido (não pode passar do prazo do contrato)');
    }
    if (s.fixedPayment.untilMonth !== undefined) {
      check(Number.isInteger(s.fixedPayment.untilMonth) && s.fixedPayment.untilMonth >= 1 && s.fixedPayment.untilMonth <= input.months, 'mês final do pagamento fixo inválido (não pode passar do prazo do contrato)');
    }
    if (s.fixedPayment.reduceMode !== undefined) {
      check(s.fixedPayment.reduceMode === 'term' || s.fixedPayment.reduceMode === 'payment', 'modo do pagamento fixo inválido');
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
  let paymentViaAporte = false; // modo payment entrou por aporte mensal garantido (fixo/%) e não por pontual
  let sacReancorado = false; // SAC: janela de aporte reverteu; amortização re-ancorada no saldo real
  let mesesRestantesFixos = input.months;
  let parcelaFixada = 0; // PRICE: nova parcela (fixa) no modo "reduzir parcela"
  let amortizacaoFixada = 0; // SAC: nova amortização (fixa) no modo "reduzir parcela"
  // taxa efetiva que cobre juros + correção monetária (TR): usada no modo
  // "reduzir parcela" para que a parcela reduzida continue amortizando o saldo
  const mEff = (1 + m) * (1 + input.trMonthly) - 1;
  if (
    input.system === 'PRICE' &&
    m === 0 &&
    input.principal / input.months <= input.principal * input.trMonthly
  ) {
    throw new Error('contrato não amortiza: parcela programada não cobre a correção monetária');
  }
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
  // "pagar parcela do SAC" no PRICE: a diferença vira amortização extra.
  // A janela desse aporte termina no mês do contrato: o array só cobre
  // `input.months`, então após o prazo (impossível na prática: a opção quita
  // antes do contrato) o gap SAC não se aplica e a dívida volta a ser paga
  // como PRICE puro — a janela nunca estende o contrato silenciosamente.
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

    const pctBase = strategies.extraMonthlyPct ?? 0;
    const pctAtivo =
      pctBase > 0 &&
      month >= (strategies.extraMonthlyPctStartMonth ?? 1) &&
      (!strategies.extraMonthlyPctUntilMonth || month <= strategies.extraMonthlyPctUntilMonth);
    const fp = strategies.fixedPayment;
    const fixedPaymentActive = Boolean(
      fp && month >= (fp.startMonth ?? 1) && (!fp.untilMonth || month <= fp.untilMonth)
    );
    // aporte mensal garantido nesta janela: % extra, pagamento fixo ou gap do
    // SAC (mesmas portas do cálculo do extra no loop); se nenhum está ativo, a
    // redução de parcela perde a cobertura e volta ao cronograma contratual
    // (pagamento fixo de valor zero não conta como cobertura: não contribui
    // com nada além da parcela, então o modo payment não pode se apoiar nele)
    const monthlyAporteActive =
      pctAtivo ||
      (fp && fixedPaymentActive && fp.amount > 0) ||
      (strategies.paySacParcela && input.system === 'PRICE' && sacParcelas[month - 1] !== undefined);
    if (modoPayment && paymentViaAporte && !monthlyAporteActive) {
      modoPayment = false;
      parcelaFixada = 0;
      amortizacaoFixada = 0;
      // reset do flag: sem ele, o revert deixa paymentViaAporte preso em true e
      // um aporte pontual posterior reentra em modo payment "sem cobertura"
      // (armadilha de estado obsoleto) — o modo só volta a valer se uma fonte
      // mensal garantida existir de novo
      paymentViaAporte = false;
      // SAC: a partir daqui a amortização NÃO pode voltar ao cronograma base
      // indexado por mês absoluto — ele foi dimensionado sobre o saldo
      // "inflado" (sem os aportes da janela) e ficaria pequeno demais para o
      // saldo real, esticando a dívida para além do prazo (e estourando o
      // array baseSacAmort em NaN); re-ancora no saldo real restante
      sacReancorado = true;
    }

    let amortizacao: number;
    let parcela: number;
    if (input.system === 'PRICE') {
      if (modoPayment) {
        parcela = parcelaFixada;
        amortizacao = Math.min(Math.max(parcela - juros - seguroMensal, 0), saldo);
        // pago real no fim do contrato: só juros + amortização (cap) + seguro
        parcela = juros + amortizacao + seguroMensal;
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
      // encurtam o prazo; modo payment: amortização fixa que cobre a TR; após
      // o revert da janela (sacReancorado), amortização = (saldo + correção)
      // / meses restantes — quita exatamente no prazo do contrato
      amortizacao = modoPayment
        ? amortizacaoFixada
        : month === 1
          ? input.principal / input.months
          : sacReancorado
            ? (saldo + correcao) / Math.max(1, input.months - month + 1)
            : baseSacAmort[month - 1];
      // Arredondamento que espelha a planilha de referência: no SAC, a
      // amortização é arredondada para cima (2 casas) a partir do mês 2.
      if (month > 1) amortizacao = Math.ceil(amortizacao * 100) / 100;
      amortizacao = Math.min(amortizacao, saldo + correcao);
      parcela = amortizacao + juros + seguroMensal;
    }

    let extra = 0;
    // modo por fonte: cada aporte pode definir o seu (senão usa o global)
    let modoFonte: 'term' | 'payment' | undefined;
    const pctExtra = pctAtivo ? parcela * pctBase : 0;
    if (pctExtra > 0) {
      extra += Math.min(pctExtra, Math.max(saldo - amortizacao, 0));
      if (strategies.extraMonthlyPctReduceMode) modoFonte = strategies.extraMonthlyPctReduceMode;
    }
    const lumpEntry = strategies.extraLumpSum.find((e) => e.month === month);
    if (lumpEntry && lumpEntry.amount > 0) {
      extra += Math.min(lumpEntry.amount, Math.max(saldo - amortizacao - extra, 0));
      if (lumpEntry.reduceMode) modoFonte = lumpEntry.reduceMode;
    }
    const fg = strategies.fgtsAnnual;
    if (fg && month >= (fg.startMonth ?? 12) && (month - (fg.startMonth ?? 12)) % 12 === 0 && (!fg.untilMonth || month <= fg.untilMonth)) {
      const fgExtra = Math.min(fg.amount, Math.max(saldo - amortizacao - extra, 0));
      if (fgExtra > 0) {
        extra += fgExtra;
        // modo só conta se o aporte entra de verdade: fonte com valor zero (ou
        // já sem saldo para abater) não pode mandar no modo de redução
        if (fg.reduceMode) modoFonte = fg.reduceMode;
      }
    }
    const rec = strategies.recurringExtra;
    if (rec && month >= rec.startMonth && (month - rec.startMonth) % rec.every === 0 && (!rec.untilMonth || month <= rec.untilMonth)) {
      const recExtra = Math.min(rec.amount, Math.max(saldo - amortizacao - extra, 0));
      if (recExtra > 0) {
        extra += recExtra;
        if (rec.reduceMode) modoFonte = rec.reduceMode;
      }
    }
    // Precedência fixedPayment × paySacParcela: enquanto o pagamento fixo está
    // ativo, o alvo exato do fixo vence e o gap do SAC não é somado (nunca
    // empilham); antes do início (ou depois do fim) do fixo, o gap do SAC vale.
    if (fp && fixedPaymentActive) {
      // pagamento fixo: parcela + aporte = exatamente `amount` (ou a parcela,
      // se a parcela já ultrapassar o valor fixo)
      const extraFixo = Math.max(0, fp.amount - parcela);
      if (extraFixo > 0) {
        const fixoEfetivo = Math.min(extraFixo, Math.max(saldo - amortizacao - extra, 0));
        if (fixoEfetivo > 0) {
          extra += fixoEfetivo;
          // modo só vence se o fixo realmente contribui (valor zero ou fixo
          // abaixo da parcela não geram dinheiro novo e não podem sobrescrever
          // o modo de outras fontes, ex: % extra com intent payment)
          if (fp.reduceMode) modoFonte = fp.reduceMode;
        }
      }
    }
    if (!fixedPaymentActive && strategies.paySacParcela && input.system === 'PRICE' && sacParcelas[month - 1] !== undefined) {
      // paga o que pagaria no SAC: a diferença (SAC − PRICE) vira amortização
      const extraSac = Math.max(0, sacParcelas[month - 1] - parcela);
      if (extraSac > 0) extra += Math.min(extraSac, Math.max(saldo - amortizacao - extra, 0));
    }

    parcelaBase = parcela; // ancora da recorrência NPER: parcela CONTRATUAL, sem extra
    parcela += extra;
    amortizacao += extra;
    saldo = Math.max(0, saldo - amortizacao + correcao);
    if (saldo < 1e-9) saldo = 0;

    const modoEfetivo = modoFonte ?? strategies.reduceMode;
    if (modoEfetivo === 'payment' && extra > 0 && saldo > 0 && !modoPayment) {
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
      // apenas aportes GARANTIDOS todo mês ajudam a reduzir a parcela;
      // recorrente (a cada X meses) e FGTS (anual) não contam como mensais,
      // senão a parcela reduzida fica sem cobertura nos meses sem aporte e a
      // dívida estica (total pago aumenta); % e fixo só valem dentro da janela
      // deles (startMonth/untilMonth), igual ao cálculo do extra no loop
      let aporteMensal = 0;
      if (pctAtivo) aporteMensal += parcelaAtual * pctBase;
      if (fp && fixedPaymentActive) aporteMensal += Math.max(0, fp.amount - parcelaAtual);
      if (!fixedPaymentActive && strategies.paySacParcela && input.system === 'PRICE' && sacParcelas[month - 1] !== undefined) {
        aporteMensal += Math.max(0, sacParcelas[month - 1] - parcelaAtual);
      }
      // a menor parcela que ainda abate no prazo restante, já descontando o
      // aporte mensal; % extra não pode colapsar (paga menos que o mínimo)
      let parcelaReduzida = Math.max(0, novaParcela - aporteMensal);
      if (pctAtivo) {
        parcelaReduzida = Math.max(parcelaReduzida, novaParcela / (1 + pctBase));
      }
      if (parcelaReduzida < parcelaAtual) {
        modoPayment = true;
        paymentViaAporte = aporteMensal > 0;
        if (input.system === 'PRICE') {
          parcelaFixada = parcelaReduzida;
        } else {
          amortizacaoFixada = Math.max(0, parcelaReduzida - juros - seguroMensal);
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

  // guardas finais: saldo não finito (NaN > 0.005 é false e deixaria um
  // cronograma lixo passar; Infinity também não é finito) e saldo não
  // amortizado dentro do limite de prazo
  if (!Number.isFinite(saldo)) {
    throw new Error('contrato não amortiza: saldo não finito (NaN ou Infinity) no encerramento — revise aportes e janelas');
  }
  if (saldo > 0.005) {
    throw new Error('contrato não amortiza completamente dentro do limite de prazo');
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
