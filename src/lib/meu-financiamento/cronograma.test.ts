import { expect, it } from 'vitest';
import { agregarAportes, buildCronograma, type CronogramaParcela } from './cronograma';
import { addMonthsISO } from './dates';
import type { Projecao } from '@/lib/finance/meu-financiamento/model';
import type { AmortizacaoComId, ParcelaPagaComId } from './repo';

const BASELINE = { dataBase: '2026-09-08', proximaParcelaNumero: 141 };

function projetadas(...numeros: number[]): Pick<Projecao, 'parcelas' | 'pagas'> {
  return {
    parcelas: numeros.map((n) => ({
      parcelaNumero: n,
      parcela: 10000 + n,
      juros: 0,
      seguro: 0,
      correcao: 0,
      amortizacao: 0,
      saldo: 0,
    })),
    pagas: [],
  };
}

/** Projeção sintética com composição não nula: paga 141 no encadeamento do
 *  estado vigente e futura 143 em aberto. */
function projecaoComposta(): Pick<Projecao, 'parcelas' | 'pagas'> {
  return {
    parcelas: [
      { parcelaNumero: 143, parcela: 10043, juros: 1, seguro: 2, correcao: 3, amortizacao: 4, saldo: 5 },
    ],
    pagas: [
      {
        parcelaNumero: 141,
        parcelaReal: 9999,
        juros: 10,
        correcao: 11,
        seguro: 12,
        amortizacao: 13,
        saldo: 14,
        dataPagamento: '2026-08-05',
      },
    ],
  };
}

function paga(numero: number, valor: number, dataPagamento: string, stateId = 's1'): ParcelaPagaComId {
  return { id: `p-${numero}-${stateId}`, stateId, parcelaNumero: numero, valor, dataPagamento };
}

function amortizacao(
  valor: number,
  dataPagamento: string,
  over: Partial<AmortizacaoComId> = {},
): AmortizacaoComId {
  return {
    id: `a-${valor}-${dataPagamento}`,
    stateId: 's1',
    valor,
    dataPagamento,
    origem: 'proprio',
    modo: 'term',
    ...over,
  };
}

interface LinhaAporte {
  numero: number;
  vencimento: string;
  paga: { dataPagamento: string } | null;
}

function linha(numero: number, vencimento: string, pagaEm: string | null = null): LinhaAporte {
  return { numero, vencimento, paga: pagaEm ? { dataPagamento: pagaEm } : null };
}

// 141 e 142 pagas com atraso (20/09 e 20/10, após o vencimento), 143 em aberto.
const PARCELAS_APORTE: LinhaAporte[] = [
  linha(141, '2026-09-10', '2026-09-20'),
  linha(142, '2026-10-10', '2026-10-20'),
  linha(143, '2026-11-10'),
];

const PARCELAS_ABERTAS: LinhaAporte[] = [
  linha(141, '2026-09-10'),
  linha(142, '2026-10-10'),
  linha(143, '2026-11-10'),
];

it('agrega aporte depois da paga 1 e antes da paga 2 na linha da paga 1', () => {
  const mapa = agregarAportes(PARCELAS_APORTE, [{ dataPagamento: '2026-09-25', valor: 100 }]);
  expect(mapa.get(141)).toBe(100);
  expect(mapa.get(142)).toBeUndefined();
});

it('agrega aporte depois da paga 2 na linha da paga 2', () => {
  const mapa = agregarAportes(PARCELAS_APORTE, [{ dataPagamento: '2026-10-25', valor: 250 }]);
  expect(mapa.get(142)).toBe(250);
  expect(mapa.get(141)).toBeUndefined();
});

it('agrega aporte no mesmo dia de uma paga naquela paga', () => {
  const mapa = agregarAportes(PARCELAS_APORTE, [{ dataPagamento: '2026-10-20', valor: 300 }]);
  expect(mapa.get(142)).toBe(300);
});

it('sem paga até a data, cai na primeira parcela em aberto', () => {
  const mapa = agregarAportes(PARCELAS_ABERTAS, [{ dataPagamento: '2026-09-15', valor: 250 }]);
  expect(mapa.get(141)).toBe(250);
  expect(mapa.get(142)).toBeUndefined();
});

it('aporte anterior a toda paga cai na primeira parcela em aberto', () => {
  const mapa = agregarAportes(PARCELAS_APORTE, [{ dataPagamento: '2026-08-01', valor: 100 }]);
  expect(mapa.get(143)).toBe(100);
});

it('soma múltiplos aportes na mesma paga', () => {
  const mapa = agregarAportes(PARCELAS_APORTE, [
    { dataPagamento: '2026-09-21', valor: 100 },
    { dataPagamento: '2026-09-24', valor: 50 },
  ]);
  expect(mapa.get(141)).toBe(150);
  expect([...mapa.keys()]).toEqual([141]);
});

it('sem extra devolve mapa vazio', () => {
  expect(agregarAportes(PARCELAS_APORTE, []).size).toBe(0);
});

it('sem parcelas, extras não geram linhas', () => {
  expect(agregarAportes([], [{ dataPagamento: '2026-08-01', valor: 100 }]).size).toBe(0);
});

it('sem lançamentos, lista as parcelas projetadas com vencimento estimado', () => {
  const linhas = buildCronograma(BASELINE, projetadas(141, 142), { pagas: [] }, []);
  expect(linhas).toHaveLength(2);
  expect(linhas[0]).toEqual({
    kind: 'parcela',
    numero: 141,
    vencimento: BASELINE.dataBase,
    valor: 10141,
    paga: null,
    situacao: 'aberta',
    composicao: { juros: 0, correcao: 0, seguro: 0, amortizacao: 0, saldo: 0 },
    aporte: 0,
  });
  expect(linhas[1]).toEqual({
    kind: 'parcela',
    numero: 142,
    vencimento: addMonthsISO(BASELINE.dataBase, 1),
    valor: 10142,
    paga: null,
    situacao: 'aberta',
    composicao: { juros: 0, correcao: 0, seguro: 0, amortizacao: 0, saldo: 0 },
    aporte: 0,
  });
});

it('mapeia o aporte do estado vigente para a linha da última paga anterior', () => {
  const linhas = buildCronograma(BASELINE, projetadas(143), {
    pagas: [paga(141, 9999, '2026-09-20'), paga(142, 10001, '2026-10-20')],
  }, [
    amortizacao(500, '2026-09-25'),
    amortizacao(100, '2026-10-25'),
  ]);
  expect(linhas.map((l) => [l.numero, l.aporte])).toEqual([
    [141, 500],
    [142, 100],
    [143, 0],
  ]);
});

it('marca a composição das pagas do estado vigente e o histórico das anteriores', () => {
  const linhas = buildCronograma(BASELINE, projecaoComposta(), {
    pagas: [paga(141, 9999, '2026-08-05', 's1'), paga(142, 10001, '2026-09-05', 's0')],
  });
  const p141 = linhas.find((l): l is CronogramaParcela => l.kind === 'parcela' && l.numero === 141)!;
  const p142 = linhas.find((l): l is CronogramaParcela => l.kind === 'parcela' && l.numero === 142)!;
  expect(p141.situacao).toBe('paga');
  expect(p141.composicao).toEqual({ juros: 10, correcao: 11, seguro: 12, amortizacao: 13, saldo: 14 });
  expect(p141.aporte).toBe(0);
  expect(p142.situacao).toBe('historico');
  expect(p142.composicao).toBeNull();
});

it('compõe a parcela projetada com juros, correção, seguro, amortização e saldo', () => {
  const linhas = buildCronograma(BASELINE, projecaoComposta(), { pagas: [] });
  const aberta = linhas.find((l): l is CronogramaParcela => l.kind === 'parcela' && l.numero === 143)!;
  expect(aberta.situacao).toBe('aberta');
  expect(aberta.composicao).toEqual({ juros: 1, correcao: 3, seguro: 2, amortizacao: 4, saldo: 5 });
});

it('inclui parcelas pagas de estados anteriores com valor real e sem duplicar projetadas', () => {
  const linhas = buildCronograma(BASELINE, projetadas(143, 144), {
    pagas: [paga(141, 9999, '2026-08-05', 's0'), paga(142, 10001, '2026-09-05', 's0')],
  });
  expect(linhas.map((l) => l.numero)).toEqual([141, 142, 143, 144]);
  expect(linhas[0]).toMatchObject({ kind: 'parcela', numero: 141, valor: 9999, paga: { dataPagamento: '2026-08-05' } });
  expect(linhas[2]).toMatchObject({ kind: 'parcela', numero: 143, valor: 10143, paga: null });
});

it('deduplica parcela paga que também aparece na projeção (paga vence)', () => {
  const linhas = buildCronograma(BASELINE, projetadas(141, 142), {
    pagas: [paga(141, 9999, '2026-08-05')],
  });
  expect(linhas).toHaveLength(2);
  expect(linhas[0]).toMatchObject({ kind: 'parcela', numero: 141, valor: 9999, paga: { dataPagamento: '2026-08-05' } });
});

it('projeção vazia (quitado) não lista linhas nem aportes', () => {
  const linhas = buildCronograma(BASELINE, projetadas(), { pagas: [] }, [
    amortizacao(500, '2026-09-20'),
  ]);
  expect(linhas).toEqual([]);
});
