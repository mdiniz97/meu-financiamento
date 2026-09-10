import { describe, expect, it } from 'vitest';
import { buildTimeline, buildTimelineGroups } from './timeline';
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

describe('buildTimeline', () => {
  it('contrato recém-cadastrado não tem histórico', () => {
    expect(buildTimeline(estado({}))).toEqual([]);
  });

  it('inclui o cadastro inicial quando há lançamentos', () => {
    const eventos = buildTimeline(estado({
      pagas: [{ id: 'p1', stateId: 'state-1', parcelaNumero: 141, valor: 12345.67, dataPagamento: '2026-10-05' }],
    }));
    expect(eventos.map((e) => e.kind)).toEqual(['parcela', 'cadastro']);
    expect(eventos[0].text).toBe(`Parcela 141 · ${formatBRL(12345.67)} · paga em 05/10/2026`);
    expect(eventos[1].text).toBe(`Contrato cadastrado com saldo de ${formatBRL(1000000)}`);
  });

  it('formata a amortização com origem e modo', () => {
    const [evento] = buildTimeline(estado({
      extras: [{ id: 'a1', stateId: 'state-1', valor: 100000, dataPagamento: '2026-10-06', origem: 'proprio', modo: 'term' }],
    }));
    expect(evento.kind).toBe('amortizacao');
    expect(evento.text).toBe(
      `Amortização extra de ${formatBRL(100000)} · Dinheiro próprio · Reduziu o prazo (parcela igual)`,
    );
  });

  it('marca FGTS e redução de parcela', () => {
    const [evento] = buildTimeline(estado({
      extras: [{ id: 'a1', stateId: 'state-1', valor: 500, dataPagamento: '2026-10-06', origem: 'fgts', modo: 'payment' }],
    }));
    expect(evento.text).toBe(`Amortização extra de ${formatBRL(500)} · FGTS · Reduziu a parcela (prazo igual)`);
  });

  it('inclui recalibração e quitação do histórico de baselines', () => {
    const eventos = buildTimeline(estado({
      states: [
        cadastro,
        { ...cadastro, version: 2, saldoDevedor: 990000, dataBase: '2026-11-01', source: 'recalibracao', createdAt: '2026-11-01T10:00:00.000Z' },
        { ...cadastro, version: 3, saldoDevedor: 0, dataBase: '2026-12-01', source: 'quitacao', createdAt: '2026-12-01T10:00:00.000Z' },
      ],
    }));
    expect(eventos.map((e) => e.kind)).toEqual(['quitacao', 'recalibracao', 'cadastro']);
    expect(eventos[1].text).toBe(`Saldo recalibrado pelo extrato: ${formatBRL(990000)}`);
    expect(eventos[0].text).toBe(`Financiamento quitado: ${formatBRL(0)}`);
  });

  it('descreve a atualização contratual com só o que mudou', () => {
    const eventos = buildTimeline(estado({
      states: [
        cadastro,
        {
          id: 'state-2',
          version: 2,
          saldoDevedor: 1000000,
          dataBase: '2026-10-01',
          source: 'atualizacao',
          bank: 'Itaú',
          system: 'SAC',
          annualRate: 0.098,
          trMonthly: 0.0017,
          insuranceMonthly: 100,
          parcelasTotais: 350,
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    }));
    expect(eventos.map((e) => e.kind)).toEqual(['atualizacao', 'cadastro']);
    expect(eventos[0].text).toBe(
      'Contrato atualizado: banco Caixa → Itaú, sistema PRICE → SAC, taxa 10,5% → 9,8% a.a., parcelas 360 → 350',
    );
  });

  it('atualização sem mudança textual usa o texto curto', () => {
    const eventos = buildTimeline(estado({
      states: [
        cadastro,
        {
          id: 'state-2',
          version: 2,
          saldoDevedor: 990000,
          dataBase: '2026-10-01',
          source: 'atualizacao',
          bank: 'Caixa',
          system: 'PRICE',
          annualRate: 0.105,
          trMonthly: 0.0017,
          insuranceMonthly: 100,
          parcelasTotais: 360,
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    }));
    expect(eventos[0].text).toBe('Contrato atualizado');
  });

  it('ignora ruído de ponto flutuante na comparação da atualização', () => {
    const eventos = buildTimeline(estado({
      states: [
        cadastro,
        {
          ...cadastro,
          version: 2,
          saldoDevedor: 990000,
          dataBase: '2026-10-01',
          source: 'atualizacao',
          annualRate: 0.105 + 1e-12,
          trMonthly: 0.0017 + 1e-12,
          insuranceMonthly: 100 + 1e-9,
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    }));
    expect(eventos[0].text).toBe('Contrato atualizado');
  });

  it('mantém lançamentos de estados superados no histórico', () => {
    const eventos = buildTimeline(estado({
      pagas: [{ id: 'p141', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' }],
      states: [
        cadastro,
        { ...cadastro, version: 2, saldoDevedor: 990000, dataBase: '2026-10-06', source: 'recalibracao', createdAt: '2026-10-06T10:00:00.000Z' },
      ],
    }));
    expect(eventos.map((e) => e.kind)).toEqual(['recalibracao', 'parcela', 'cadastro']);
    expect(eventos[1]).toMatchObject({ kind: 'parcela', id: 'p141', stateId: 'state-1' });
  });

  it('ordena por data DESC e desempata o dia: lançamento antes do baseline', () => {
    const eventos = buildTimeline(estado({
      pagas: [
        { id: 'p141', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' },
        { id: 'p142', stateId: 'state-1', parcelaNumero: 142, valor: 1001, dataPagamento: '2026-10-05' },
      ],
      extras: [{ id: 'a1', stateId: 'state-1', valor: 2000, dataPagamento: '2026-10-05', origem: 'fgts', modo: 'term' }],
      states: [
        cadastro,
        { ...cadastro, version: 2, saldoDevedor: 500000, dataBase: '2026-10-05', source: 'recalibracao', createdAt: '2026-10-05T18:00:00.000Z' },
      ],
    }));
    expect(eventos.map((e) => e.kind)).toEqual([
      'parcela',
      'parcela',
      'amortizacao',
      'recalibracao',
      'cadastro',
    ]);
    expect(eventos[0]).toMatchObject({ id: 'p142' });
    expect(eventos[1]).toMatchObject({ id: 'p141' });
  });
});

describe('buildTimelineGroups', () => {
  it('contrato recém-cadastrado não tem grupos', () => {
    expect(buildTimelineGroups(estado({}))).toEqual([]);
  });

  it('período vigente primeiro e lançamentos sob o marco do seu estado', () => {
    const recalibracao: ContractStateSummary = {
      ...cadastro,
      id: 'state-2',
      version: 2,
      saldoDevedor: 990000,
      dataBase: '2026-10-06',
      source: 'recalibracao',
      createdAt: '2026-10-06T10:00:00.000Z',
    };
    const grupos = buildTimelineGroups(estado({
      pagas: [
        { id: 'p141', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' },
        { id: 'p140', stateId: 'state-1', parcelaNumero: 140, valor: 900, dataPagamento: '2026-10-04' },
      ],
      states: [cadastro, recalibracao],
      stateId: 'state-2',
    }));
    expect(grupos.map((g) => g.version)).toEqual([2, 1]);
    expect(grupos[0]).toMatchObject({ atual: true, source: 'recalibracao' });
    expect(grupos[0].marco.text).toBe('Saldo recalibrado pelo extrato');
    expect(grupos[0].events).toEqual([]);
    expect(grupos[1]).toMatchObject({ atual: false, source: 'cadastro' });
    expect(grupos[1].marco.text).toBe('Contrato cadastrado');
    expect(grupos[1].events.map((e) => (e.kind === 'parcela' ? e.numero : null))).toEqual([141, 140]);
  });

  it('separa lançamentos do período vigente e do anterior', () => {
    const atualizacao: ContractStateSummary = {
      ...cadastro,
      id: 'state-2',
      version: 2,
      bank: 'Itaú',
      dataBase: '2026-10-10',
      source: 'atualizacao',
      createdAt: '2026-10-10T10:00:00.000Z',
    };
    const grupos = buildTimelineGroups(estado({
      pagas: [
        { id: 'antiga', stateId: 'state-1', parcelaNumero: 141, valor: 1000, dataPagamento: '2026-10-05' },
        { id: 'nova', stateId: 'state-2', parcelaNumero: 142, valor: 1001, dataPagamento: '2026-10-11' },
      ],
      states: [cadastro, atualizacao],
      stateId: 'state-2',
    }));
    expect(grupos[0].events.map((e) => (e.kind === 'parcela' ? e.id : null))).toEqual(['nova']);
    expect(grupos[1].events.map((e) => (e.kind === 'parcela' ? e.id : null))).toEqual(['antiga']);
  });

  it('atualização sem lançamentos ainda rende os dois marcos', () => {
    const atualizacao: ContractStateSummary = {
      ...cadastro,
      id: 'state-2',
      version: 2,
      dataBase: '2026-10-10',
      source: 'atualizacao',
      createdAt: '2026-10-10T10:00:00.000Z',
    };
    const grupos = buildTimelineGroups(estado({ states: [cadastro, atualizacao], stateId: 'state-2' }));
    expect(grupos.map((g) => g.version)).toEqual([2, 1]);
    expect(grupos[0].marco.kind).toBe('atualizacao');
    expect(grupos[1].marco.kind).toBe('cadastro');
  });
});
