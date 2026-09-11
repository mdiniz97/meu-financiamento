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
  /** Dia do vencimento (1..31) do estado vigente; a projeção financeira não
   *  depende dele, só a estimativa de data de vencimento na UI. */
  diaVencimento?: number;
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
  correcao: number;
  amortizacao: number;
  saldo: number;
}

/** Decomposição de uma parcela paga pelo MESMO encadeamento do estado vigente
 *  (juros e correção sobre o saldo da competência, seguro contratual e a
 *  amortização derivada do valor pago). Só existe para as pagas do baseline
 *  atual; as de períodos anteriores não são reconstruíveis pelo modelo. */
export interface ParcelaPagaDetalhada {
  parcelaNumero: number;
  parcelaReal: number;
  juros: number;
  correcao: number;
  seguro: number;
  amortizacao: number;
  saldo: number;
  dataPagamento: string;
}

export interface Projecao {
  primeiraPendente: number;
  saldoEfetivo: number;
  saldoAntesExtras: number;
  parcelas: ParcelaProjetada[];
  /** Pagas do baseline vigente com a composição do encadeamento. */
  pagas: ParcelaPagaDetalhada[];
  quitaEm: number | null;
  divergencia: number;
}

export interface ContractInput {
  bank: string;
  system: ContractSystem;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  parcelasTotais: number;
  saldoDevedor: number;
  dataBase: string;
  proximaParcelaNumero: number;
  /** Dia do vencimento (1..31). */
  diaVencimento: number;
}

const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(s: unknown): s is string {
  if (typeof s !== 'string' || !DATA_ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateContractInput(p: unknown): { ok: true; value: ContractInput } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (typeof p !== 'object' || p === null) return fail('Dados do contrato inválidos');
  const o = p as Record<string, unknown>;
  const { bank, system, annualRate, trMonthly, insuranceMonthly, parcelasTotais, saldoDevedor, dataBase, proximaParcelaNumero, diaVencimento } = o;
  if (typeof bank !== 'string' || bank.trim().length < 1 || bank.trim().length > 60) return fail('Banco inválido');
  if (system !== 'PRICE' && system !== 'SAC') return fail('Sistema inválido');
  if (typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) {
    return fail('Taxa anual inválida');
  }
  if (typeof trMonthly !== 'number' || !Number.isFinite(trMonthly) || trMonthly < 0 || trMonthly > 0.1) {
    return fail('TR mensal inválida');
  }
  if (typeof insuranceMonthly !== 'number' || !Number.isFinite(insuranceMonthly) || insuranceMonthly < 0) {
    return fail('Seguro mensal inválido');
  }
  if (typeof parcelasTotais !== 'number' || !Number.isInteger(parcelasTotais) || parcelasTotais < 1 || parcelasTotais > 600) {
    return fail('Prazo inválido');
  }
  if (typeof saldoDevedor !== 'number' || !Number.isFinite(saldoDevedor) || saldoDevedor <= 0) {
    return fail('Saldo devedor inválido');
  }
  if (!isValidDateString(dataBase)) return fail('Data-base inválida');
  if (typeof proximaParcelaNumero !== 'number' || !Number.isInteger(proximaParcelaNumero)
    || proximaParcelaNumero < 1 || proximaParcelaNumero > parcelasTotais) {
    return fail('Próxima parcela inválida');
  }
  if (typeof diaVencimento !== 'number' || !Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    return fail('Dia do vencimento inválido');
  }
  return {
    ok: true,
    value: {
      bank: bank.trim(), system, annualRate, trMonthly, insuranceMonthly, parcelasTotais, saldoDevedor, dataBase, proximaParcelaNumero, diaVencimento,
    },
  };
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
  const primeira = primeiraPendente(params, baseline, pagas);

  // Baseline já quitado (estado criado por recalibração com saldo 0): não há
  // movimentos (as actions bloqueiam) nem futuro a projetar, e a engine recusa
  // principal 0 — projeção vazia sem lançar.
  if (baseline.saldoDevedor === 0) {
    return { primeiraPendente: primeira, saldoEfetivo: 0, saldoAntesExtras: 0, parcelas: [], pagas: [], quitaEm: null, divergencia: 0 };
  }

  const m = convertAnnualToMonthly(params.annualRate);
  const cronoOriginal = simulate(toLoanInput(params, baseline));
  const indexOriginal = (n: number) => n - baseline.proximaParcelaNumero;

  let saldo = baseline.saldoDevedor;
  let divergencia = 0;
  const pagasPorNumero = new Map(pagas.map((p) => [p.parcelaNumero, p]));
  const pagasDetalhadas: ParcelaPagaDetalhada[] = [];
  for (const n of numeros) {
    const paga = pagasPorNumero.get(n)!;
    const projetada = cronoOriginal.installments[indexOriginal(n)].parcela;
    const juros = saldo * m;
    const correcao = saldo * params.trMonthly;
    const saldoCorrigido = saldo + correcao;
    const amortizacao = Math.min(Math.max(paga.valor - juros - params.insuranceMonthly, 0), saldoCorrigido);
    saldo = Math.max(0, saldoCorrigido - amortizacao);
    pagasDetalhadas.push({
      parcelaNumero: n,
      parcelaReal: paga.valor,
      juros,
      correcao,
      seguro: params.insuranceMonthly,
      amortizacao,
      saldo,
      dataPagamento: paga.dataPagamento,
    });
    divergencia += paga.valor - projetada;
  }
  const saldoAntesExtras = saldo;
  const totalExtras = extras.reduce((soma, e) => soma + e.valor, 0);
  const saldoEfetivo = Math.max(0, saldoAntesExtras - totalExtras);

  if (saldoEfetivo === 0) {
    return { primeiraPendente: primeira, saldoEfetivo: 0, saldoAntesExtras, parcelas: [], pagas: pagasDetalhadas, quitaEm: null, divergencia };
  }

  const defaultMeses = params.parcelasTotais - primeira + 1;
  // fim-de-contrato: parcelas pagas cobriram todo o contrato sem zerar o saldo
  // (ex.: pagas pela tabela com TR > 0 deixam resíduo de correção). Não há
  // competências futuras (mesesFuturos = 0 faria a engine lançar erro cru):
  // retorna projeção sem parcelas — quitaEm null sinaliza saldo não liquidado.
  // A action deve tratar esse caso (contrato encerrado com saldo > 0) como
  // estado de recalibração, não como pagamento normal.
  if (defaultMeses < 1) {
    return { primeiraPendente: primeira, saldoEfetivo, saldoAntesExtras, parcelas: [], pagas: pagasDetalhadas, quitaEm: null, divergencia };
  }
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
    // engine PRICE com TR>0 pagaria months+1: a fantasma amortiza o saldo
    // residual da correção (valor material) e paga mais um seguro. Funde a
    // amortização e os juros da fantasma na última parcela do contrato; o
    // seguro da fantasma não duplica (a última parcela já tem o seu).
    const fantasma = linhas[mesesFuturos];
    const ultima = linhas[mesesFuturos - 1];
    linhas = linhas.slice(0, mesesFuturos);
    linhas[mesesFuturos - 1] = {
      ...ultima,
      amortizacao: ultima.amortizacao + fantasma.amortizacao,
      juros: ultima.juros + fantasma.juros,
      correcao: ultima.correcao + fantasma.correcao,
      parcela: ultima.parcela + fantasma.amortizacao + fantasma.juros,
      saldo: 0,
    };
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
    correcao: row.correcao,
    amortizacao: row.amortizacao,
    saldo: row.saldo,
  }));

  return { primeiraPendente: primeira, saldoEfetivo, saldoAntesExtras, parcelas, pagas: pagasDetalhadas, quitaEm, divergencia };
}
