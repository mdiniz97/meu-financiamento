import type { ContractStateSummary, PageState } from './repo';
import { formatDataBr } from './dates';
import { formatBRL } from '@/lib/utils';

export function origemLabel(origem: 'proprio' | 'fgts'): string {
  return origem === 'fgts' ? 'FGTS' : 'Dinheiro próprio';
}

export function modoLabel(modo: 'term' | 'payment'): string {
  return modo === 'term' ? 'Reduziu o prazo (parcela igual)' : 'Reduziu a parcela (prazo igual)';
}

export type TimelineEvent =
  | { kind: 'parcela'; id: string; stateId: string; numero: number; valor: number; data: string; text: string }
  | {
      kind: 'amortizacao';
      id: string;
      stateId: string;
      valor: number;
      data: string;
      origem: 'proprio' | 'fgts';
      modo: 'term' | 'payment';
      text: string;
    }
  | { kind: 'recalibracao'; version: number; data: string; text: string }
  | { kind: 'quitacao'; version: number; data: string; text: string }
  | { kind: 'atualizacao'; version: number; data: string; text: string }
  | { kind: 'cadastro'; version: number; data: string; text: string };

/** Percentual pt-BR a partir da fração (0,105 → '10,5%'), sem zeros à direita. */
function formatPct(value: number): string {
  const pct = Math.round(value * 100 * 1e4) / 1e4;
  return `${String(pct).replace('.', ',')}%`;
}

/** Comparações arredondadas: 4 casas percentuais para taxa/TR e centavos para
 *  dinheiro, para ruído de ponto flutuante não virar linha no diff. */
function rateMudou(a: number, b: number): boolean {
  return Math.round(a * 1e6) !== Math.round(b * 1e6);
}

function dinheiroMudou(a: number, b: number): boolean {
  return Math.round(a * 100) !== Math.round(b * 100);
}

function atualizacaoPartes(atual: ContractStateSummary, anterior: ContractStateSummary | undefined): string[] {
  if (!anterior) return [];
  const partes: string[] = [];
  if (atual.bank !== anterior.bank) partes.push(`banco ${anterior.bank} → ${atual.bank}`);
  if (atual.system !== anterior.system) partes.push(`sistema ${anterior.system} → ${atual.system}`);
  if (rateMudou(atual.annualRate, anterior.annualRate)) {
    partes.push(`taxa ${formatPct(anterior.annualRate)} → ${formatPct(atual.annualRate)} a.a.`);
  }
  if (rateMudou(atual.trMonthly, anterior.trMonthly)) {
    partes.push(`TR ${formatPct(anterior.trMonthly)} → ${formatPct(atual.trMonthly)} a.m.`);
  }
  if (dinheiroMudou(atual.insuranceMonthly, anterior.insuranceMonthly)) {
    partes.push(`seguro ${formatBRL(anterior.insuranceMonthly)} → ${formatBRL(atual.insuranceMonthly)}`);
  }
  if (atual.parcelasTotais !== anterior.parcelasTotais) {
    partes.push(`parcelas ${anterior.parcelasTotais} → ${atual.parcelasTotais}`);
  }
  return partes;
}

/** Resumo textual do que mudou na atualização contratual (sem o prefixo). */
export function atualizacaoResumo(atual: ContractStateSummary, anterior: ContractStateSummary | undefined): string {
  return atualizacaoPartes(atual, anterior).join(', ');
}

function parcelaEvent(p: {
  id: string;
  stateId: string;
  parcelaNumero: number;
  valor: number;
  dataPagamento: string;
}): TimelineEvent {
  return {
    kind: 'parcela',
    id: p.id,
    stateId: p.stateId,
    numero: p.parcelaNumero,
    valor: p.valor,
    data: p.dataPagamento,
    text: `Parcela ${p.parcelaNumero} · ${formatBRL(p.valor)} · paga em ${formatDataBr(p.dataPagamento)}`,
  };
}

function amortizacaoEvent(e: {
  id: string;
  stateId: string;
  valor: number;
  dataPagamento: string;
  origem: 'proprio' | 'fgts';
  modo: 'term' | 'payment';
}): TimelineEvent {
  return {
    kind: 'amortizacao',
    id: e.id,
    stateId: e.stateId,
    valor: e.valor,
    data: e.dataPagamento,
    origem: e.origem,
    modo: e.modo,
    text: `Amortização extra de ${formatBRL(e.valor)} · ${origemLabel(e.origem)} · ${modoLabel(e.modo)}`,
  };
}

const MARCO_TEXTO: Record<ContractStateSummary['source'], string> = {
  cadastro: 'Contrato cadastrado',
  recalibracao: 'Saldo recalibrado pelo extrato',
  quitacao: 'Financiamento quitado',
  atualizacao: 'Contrato atualizado',
};

function marcoEvent(s: ContractStateSummary): TimelineEvent {
  switch (s.source) {
    case 'cadastro':
      return { kind: 'cadastro', version: s.version, data: s.dataBase, text: MARCO_TEXTO.cadastro };
    case 'recalibracao':
      return { kind: 'recalibracao', version: s.version, data: s.dataBase, text: MARCO_TEXTO.recalibracao };
    case 'quitacao':
      return { kind: 'quitacao', version: s.version, data: s.dataBase, text: MARCO_TEXTO.quitacao };
    case 'atualizacao':
      return { kind: 'atualizacao', version: s.version, data: s.dataBase, text: MARCO_TEXTO.atualizacao };
  }
}

export interface TimelineGroup {
  version: number;
  stateId: string;
  source: ContractStateSummary['source'];
  dataBase: string;
  /** Período vigente (baseline atual): primeiro na UI e único com ações inline. */
  atual: boolean;
  marco: TimelineEvent;
  /** Resumo do que mudou, só na atualização contratual. */
  resumo?: string;
  /** Lançamentos do período (parcela/amortização), por data DESC. */
  events: TimelineEvent[];
}

/**
 * Histórico agrupado por período do contrato (baseline): o marco de cada
 * versão (cadastro/recalibração/atualização/quitação) com os lançamentos que
 * pertencem ao seu `stateId` logo abaixo. Período vigente primeiro; os
 * anteriores vêm em ordem de versão DESC. Contrato recém-cadastrado (só o
 * cadastro, sem lançamentos) devolve lista vazia ("Nenhum lançamento ainda.").
 */
export function buildTimelineGroups(
  state: Pick<PageState, 'historico' | 'states' | 'stateId'>,
): TimelineGroup[] {
  const porVersao = new Map(state.states.map((s) => [s.version, s]));
  const porState = new Map<string, { event: TimelineEvent; data: string; rank: number; num: number }[]>();
  const push = (stateId: string, entry: { event: TimelineEvent; data: string; rank: number; num: number }) => {
    const lista = porState.get(stateId) ?? [];
    lista.push(entry);
    porState.set(stateId, lista);
  };
  for (const p of state.historico.pagas) {
    push(p.stateId, { event: parcelaEvent(p), data: p.dataPagamento, rank: 0, num: p.parcelaNumero });
  }
  state.historico.extras.forEach((e, index) => {
    push(e.stateId, { event: amortizacaoEvent(e), data: e.dataPagamento, rank: 1, num: index });
  });

  const grupos: TimelineGroup[] = [...state.states]
    .sort((a, b) => b.version - a.version)
    .map((s) => {
      const anterior = porVersao.get(s.version - 1);
      const ordenados = (porState.get(s.id) ?? []).sort((a, b) => {
        if (a.data !== b.data) return b.data.localeCompare(a.data);
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.num - a.num;
      });
      return {
        version: s.version,
        stateId: s.id,
        source: s.source,
        dataBase: s.dataBase,
        atual: s.id === state.stateId,
        marco: marcoEvent(s),
        resumo: s.source === 'atualizacao' ? atualizacaoResumo(s, anterior) : undefined,
        events: ordenados.map((x) => x.event),
      };
    });

  // Contrato recém-cadastrado: o baseline inicial sozinho não é histórico;
  // sem ele a seção fica vazia ("Nenhum lançamento ainda.").
  if (grupos.length === 1 && grupos[0].source === 'cadastro' && grupos[0].events.length === 0) return [];
  return grupos;
}

export interface TimelineGroupPage extends TimelineGroup {
  /** Lançamentos do período que ficaram fora do limite atual. */
  ocultos: number;
}

/**
 * Orçamento POR PERÍODO: cada grupo exibe até `limite` lançamentos (mínimo 1) e
 * informa quantos ficaram ocultos. Diferente de um corte global, nenhum período
 * fica vazio enquanto outro aparece cortado; "Mostrar mais" só aumenta o limite
 * de todos os grupos.
 */
export function paginarGrupos(grupos: TimelineGroup[], limite: number): TimelineGroupPage[] {
  const porPeriodo = Math.max(1, Math.floor(limite));
  return grupos.map((grupo) => {
    const events = grupo.events.slice(0, porPeriodo);
    return { ...grupo, events, ocultos: grupo.events.length - events.length };
  });
}
