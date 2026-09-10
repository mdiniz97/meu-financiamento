import { describe, expect, it } from 'vitest';
import { buildTimelineGroups, paginarGrupos } from './timeline';
import { formatBRL } from '@/lib/utils';
import type { ContractStateSummary } from './repo';

const cadastro: ContractStateSummary = {
  id: 'state-1',
  version: 1,
  saldoDevedor: 1000000,
  dataBase: '2026-09-10',
  source: 'cadastro',
  bank: 'Caixa',
  system: 'PRICE',
  annualRate: 0.105,
  trMonthly: 0.0017,
  insuranceMonthly: 100,
  parcelasTotais: 360,
  createdAt: '2026-09-10T12:00:00.000Z',
};

function estado(over: {
  pagas?: { id: string; stateId: string; parcelaNumero: number; valor: number; dataPagamento: string }[];
  extras?: { id: string; stateId: string; valor: number; dataPagamento: string; origem: 'proprio' | 'fgts'; modo: 'term' | 'payment' }[];
  states?: ContractStateSummary[];
  stateId?: string;
}) {
  const states = over.states ?? [cadastro];
  return {
    historico: {
      pagas: over.pagas ?? [],
      extras: over.extras ?? [],
    },
    states,
    stateId: over.stateId ?? states[states.length - 1].id,
  };
}

function state(over: Partial<ContractStateSummary> & { id: string; version: number; source: ContractStateSummary['source'] }): ContractStateSummary {
  return { ...cadastro, ...over };
}

describe('buildTimelineGroups', () => {
  it('contrato recém-cadastrado não tem grupos', () => {
    expect(buildTimelineGroups(estado({}))).toEqual([]);
  });

  it('inclui o marco do cadastro quando há lançamentos', () => {
    const grupos = buildTimelineGroups(estado({
      pagas: [{ id: 'p1', stateId: 'state-1', parcelaNumero: 141, valor: 12345.67, dataPagamento: '2026-10-05' }],
    }));
    expect(grupos).toHaveLength(1);
    expect(grupos[0].atual).toBe(true);
    expect(grupos[0].marco.text).toBe('Contrato cadastrado');
    expect(grupos[0].events[0].text).toBe(`Parcela 141 · ${formatBRL(12345.67)} · paga em 05/10/2026`);
  });

  it('formata a amortização com origem e modo', () => {
    const grupos = buildTimelineGroups(estado({
      extras: [{ id: 'a1', stateId: 'state-1', valor: 100000, dataPagamento: '2026-10-06', origem: 'proprio', modo: 'term' }],
    }));
    expect(grupos[0].events[0].text).toBe(
      `Amortização extra de ${formatBRL(100000)} · Dinheiro próprio · Reduziu o prazo (parcela igual)`,
    );
  });

  it('marca FGTS e redução de parcela', () => {
    const grupos = buildTimelineGroups(estado({
      extras: [{ id: 'a1', stateId: 'state-1', valor: 500, dataPagamento: '2026-10-06', origem: 'fgts', modo: 'payment' }],
    }));
    expect(grupos[0].events[0].text).toBe(
      `Amortização extra de ${formatBRL(500)} · FGTS · Reduziu a parcela (prazo igual)`,
    );
  });

  it('ordena por data DESC e desempata o dia: lançamentos antes do próximo marco', () => {
    const grupos = buildTimelineGroups(estado({
      pagas: [
        { id: 'p141', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' },
        { id: 'p140', stateId: 'state-1', parcelaNumero: 140, valor: 900, dataPagamento: '2026-10-04' },
        { id: 'p142', stateId: 'state-1', parcelaNumero: 142, valor: 1001, dataPagamento: '2026-10-05' },
      ],
      extras: [{ id: 'a1', stateId: 'state-1', valor: 2000, dataPagamento: '2026-10-05', origem: 'fgts', modo: 'term' }],
    }));
    expect(grupos[0].events.map((e) => (e.kind === 'parcela' ? e.id : e.kind === 'amortizacao' ? e.id : null))).toEqual([
      'p142',
      'p141',
      'a1',
      'p140',
    ]);
  });

  it('inclui recalibração e quitação do histórico de baselines', () => {
    const grupos = buildTimelineGroups(estado({
      states: [
        cadastro,
        state({ id: 'state-2', version: 2, saldoDevedor: 990000, dataBase: '2026-11-01', source: 'recalibracao' }),
        state({ id: 'state-3', version: 3, saldoDevedor: 0, dataBase: '2026-12-01', source: 'quitacao' }),
      ],
      stateId: 'state-3',
    }));
    expect(grupos.map((g) => g.version)).toEqual([3, 2, 1]);
    expect(grupos.map((g) => g.marco.text)).toEqual([
      'Financiamento quitado',
      'Saldo recalibrado pelo extrato',
      'Contrato cadastrado',
    ]);
    expect(grupos[0].atual).toBe(true);
    expect(grupos[1].atual).toBe(false);
  });

  it('descreve a atualização contratual com só o que mudou', () => {
    const grupos = buildTimelineGroups(estado({
      states: [
        cadastro,
        state({
          id: 'state-2',
          version: 2,
          saldoDevedor: 1000000,
          dataBase: '2026-10-01',
          source: 'atualizacao',
          bank: 'Itaú',
          system: 'SAC',
          annualRate: 0.098,
          parcelasTotais: 350,
        }),
      ],
      stateId: 'state-2',
    }));
    expect(grupos[0].marco.text).toBe('Contrato atualizado');
    expect(grupos[0].resumo).toBe(
      'banco Caixa → Itaú, sistema PRICE → SAC, taxa 10,5% → 9,8% a.a., parcelas 360 → 350',
    );
  });

  it('atualização sem mudança textual usa o texto curto', () => {
    const grupos = buildTimelineGroups(estado({
      states: [cadastro, state({ id: 'state-2', version: 2, saldoDevedor: 990000, dataBase: '2026-10-01', source: 'atualizacao' })],
      stateId: 'state-2',
    }));
    expect(grupos[0].marco.text).toBe('Contrato atualizado');
    expect(grupos[0].resumo).toBe('');
  });

  it('ignora ruído de ponto flutuante na comparação da atualização', () => {
    const grupos = buildTimelineGroups(estado({
      states: [
        cadastro,
        state({
          id: 'state-2',
          version: 2,
          saldoDevedor: 990000,
          dataBase: '2026-10-01',
          source: 'atualizacao',
          annualRate: 0.105 + 1e-12,
          trMonthly: 0.0017 + 1e-12,
          insuranceMonthly: 100 + 1e-9,
        }),
      ],
      stateId: 'state-2',
    }));
    expect(grupos[0].resumo).toBe('');
  });

  it('mantém lançamentos de estados superados no período anterior', () => {
    const grupos = buildTimelineGroups(estado({
      pagas: [{ id: 'p141', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' }],
      states: [cadastro, state({ id: 'state-2', version: 2, saldoDevedor: 990000, dataBase: '2026-10-06', source: 'recalibracao' })],
      stateId: 'state-2',
    }));
    expect(grupos.map((g) => g.version)).toEqual([2, 1]);
    expect(grupos[0].marco.kind).toBe('recalibracao');
    expect(grupos[0].events).toEqual([]);
    expect(grupos[1]).toMatchObject({ atual: false, source: 'cadastro' });
    expect(grupos[1].events[0]).toMatchObject({ kind: 'parcela', id: 'p141', stateId: 'state-1' });
  });

  it('separa lançamentos do período vigente e do anterior', () => {
    const grupos = buildTimelineGroups(estado({
      pagas: [
        { id: 'antiga', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' },
        { id: 'nova', stateId: 'state-2', parcelaNumero: 142, valor: 1001, dataPagamento: '2026-10-11' },
      ],
      states: [cadastro, state({ id: 'state-2', version: 2, bank: 'Itaú', dataBase: '2026-10-10', source: 'atualizacao' })],
      stateId: 'state-2',
    }));
    expect(grupos[0].events.map((e) => (e.kind === 'parcela' ? e.id : null))).toEqual(['nova']);
    expect(grupos[1].events.map((e) => (e.kind === 'parcela' ? e.id : null))).toEqual(['antiga']);
  });

  it('atualização sem lançamentos ainda rende os dois marcos', () => {
    const grupos = buildTimelineGroups(estado({
      states: [cadastro, state({ id: 'state-2', version: 2, dataBase: '2026-10-10', source: 'atualizacao' })],
      stateId: 'state-2',
    }));
    expect(grupos.map((g) => g.version)).toEqual([2, 1]);
    expect(grupos[0].marco.kind).toBe('atualizacao');
    expect(grupos[1].marco.kind).toBe('cadastro');
  });
});

function pagasDe(stateId: string, numeros: number[], data: string) {
  return numeros.map((n) => ({ id: `${stateId}-${n}`, stateId, parcelaNumero: n, valor: 1000, dataPagamento: data }));
}

function comDoisPeriodos() {
  return buildTimelineGroups(estado({
    pagas: [
      ...pagasDe('state-1', [134, 135, 136, 137, 138, 139, 140], '2026-10-01'),
      ...pagasDe('state-2', [141, 142, 143, 144], '2026-11-01'),
    ],
    states: [cadastro, state({ id: 'state-2', version: 2, dataBase: '2026-11-01', source: 'recalibracao' })],
    stateId: 'state-2',
  }));
}

describe('paginarGrupos', () => {
  it('limita cada período sem esvaziar nenhum', () => {
    const paginas = paginarGrupos(comDoisPeriodos(), 6);
    expect(paginas.map((p) => p.events.length)).toEqual([4, 6]);
    expect(paginas.map((p) => p.ocultos)).toEqual([0, 1]);
  });

  it('aumentar o limite revela mais de cada período', () => {
    const paginas = paginarGrupos(comDoisPeriodos(), 12);
    expect(paginas.map((p) => p.events.length)).toEqual([4, 7]);
    expect(paginas.map((p) => p.ocultos)).toEqual([0, 0]);
  });

  it('limite zero ainda mostra um lançamento por período', () => {
    const paginas = paginarGrupos(comDoisPeriodos(), 0);
    expect(paginas.map((p) => p.events.length)).toEqual([1, 1]);
    expect(paginas.map((p) => p.ocultos)).toEqual([3, 6]);
  });
});
