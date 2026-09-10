import type { PageState } from './repo';
import { formatDataBr } from './dates';
import { formatBRL } from '@/lib/utils';

export function origemLabel(origem: 'proprio' | 'fgts'): string {
  return origem === 'fgts' ? 'FGTS' : 'Dinheiro próprio';
}

export function modoLabel(modo: 'term' | 'payment'): string {
  return modo === 'term' ? 'Reduziu o prazo (parcela igual)' : 'Reduziu a parcela (prazo igual)';
}

export type TimelineEvent =
  | { kind: 'parcela'; id: string; numero: number; valor: number; data: string; text: string }
  | {
      kind: 'amortizacao';
      id: string;
      valor: number;
      data: string;
      origem: 'proprio' | 'fgts';
      modo: 'term' | 'payment';
      text: string;
    }
  | { kind: 'recalibracao'; version: number; data: string; text: string }
  | { kind: 'quitacao'; version: number; data: string; text: string }
  | { kind: 'cadastro'; version: number; data: string; text: string };

// Empate na mesma data: lançamentos do dia vêm antes do baseline que os
// superou (recalibração/quitação) e o cadastro fica por último.
const RANK: Record<TimelineEvent['kind'], number> = {
  parcela: 0,
  amortizacao: 1,
  recalibracao: 2,
  quitacao: 2,
  cadastro: 3,
};

/**
 * Eventos da timeline unificada: parcelas pagas e amortizações do baseline
 * vigente + histórico de baselines (cadastro, recalibrações e quitação).
 * Ordenação por data DESC; empates resolvidos por tipo e, dentro do tipo, por
 * número (parcela/versão) DESC.
 */
export function buildTimeline(state: Pick<PageState, 'pagas' | 'extras' | 'states'>): TimelineEvent[] {
  const stateEvents: { event: TimelineEvent; sortNum: number }[] = [];
  for (const s of state.states) {
    if (s.version === 1) {
      stateEvents.push({
        event: {
          kind: 'cadastro',
          version: s.version,
          data: s.dataBase,
          text: `Contrato cadastrado com saldo de ${formatBRL(s.saldoDevedor)}`,
        },
        sortNum: s.version,
      });
    } else if (s.source === 'quitacao') {
      stateEvents.push({
        event: {
          kind: 'quitacao',
          version: s.version,
          data: s.dataBase,
          text: `Financiamento quitado: ${formatBRL(0)}`,
        },
        sortNum: s.version,
      });
    } else if (s.source === 'recalibracao') {
      stateEvents.push({
        event: {
          kind: 'recalibracao',
          version: s.version,
          data: s.dataBase,
          text: `Saldo recalibrado pelo extrato: ${formatBRL(s.saldoDevedor)}`,
        },
        sortNum: s.version,
      });
    }
  }

  const sortable: { event: TimelineEvent; sortNum: number }[] = [
    ...state.pagas.map((p) => ({
      event: {
        kind: 'parcela' as const,
        id: p.id,
        numero: p.parcelaNumero,
        valor: p.valor,
        data: p.dataPagamento,
        text: `Parcela ${p.parcelaNumero} · ${formatBRL(p.valor)} · paga em ${formatDataBr(p.dataPagamento)}`,
      },
      sortNum: p.parcelaNumero,
    })),
    ...state.extras.map((e, index) => ({
      event: {
        kind: 'amortizacao' as const,
        id: e.id,
        valor: e.valor,
        data: e.dataPagamento,
        origem: e.origem,
        modo: e.modo,
        text: `Amortização extra de ${formatBRL(e.valor)} · ${origemLabel(e.origem)} · ${modoLabel(e.modo)}`,
      },
      sortNum: index,
    })),
    ...stateEvents,
  ];

  sortable.sort((a, b) => {
    if (a.event.data !== b.event.data) return b.event.data.localeCompare(a.event.data);
    if (RANK[a.event.kind] !== RANK[b.event.kind]) return RANK[a.event.kind] - RANK[b.event.kind];
    return b.sortNum - a.sortNum;
  });

  const events = sortable.map((s) => s.event);
  // Contrato recém-cadastrado: o baseline inicial sozinho não é histórico;
  // sem ele a seção fica vazia ("Nenhum lançamento ainda.").
  if (events.length === 1 && events[0].kind === 'cadastro') return [];
  return events;
}
