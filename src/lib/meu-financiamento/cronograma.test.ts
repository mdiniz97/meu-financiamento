import { expect, it } from 'vitest';
import { buildCronograma } from './cronograma';
import { addMonthsISO } from './dates';
import type { Projecao } from '@/lib/finance/meu-financiamento/model';
import type { AmortizacaoComId, ParcelaPagaComId } from './repo';

const BASELINE = { dataBase: '2026-09-08', proximaParcelaNumero: 141 };

function projetadas(...numeros: number[]): Pick<Projecao, 'parcelas'> {
  return {
    parcelas: numeros.map((n) => ({
      parcelaNumero: n,
      parcela: 10000 + n,
      juros: 0,
      seguro: 0,
      amortizacao: 0,
      saldo: 0,
    })),
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

it('sem lançamentos, lista as parcelas projetadas com vencimento estimado', () => {
  const linhas = buildCronograma(BASELINE, projetadas(141, 142), { pagas: [], extras: [] });
  expect(linhas).toHaveLength(2);
  expect(linhas[0]).toEqual({
    kind: 'parcela',
    numero: 141,
    vencimento: BASELINE.dataBase,
    valor: 10141,
    paga: null,
  });
  expect(linhas[1]).toEqual({
    kind: 'parcela',
    numero: 142,
    vencimento: addMonthsISO(BASELINE.dataBase, 1),
    valor: 10142,
    paga: null,
  });
});

it('inclui parcelas pagas de estados anteriores com valor real e sem duplicar projetadas', () => {
  const linhas = buildCronograma(BASELINE, projetadas(143, 144), {
    pagas: [paga(141, 9999, '2026-08-05', 's0'), paga(142, 10001, '2026-09-05', 's0')],
    extras: [],
  });
  expect(linhas.map((l) => (l.kind === 'parcela' ? l.numero : l.id))).toEqual([141, 142, 143, 144]);
  expect(linhas[0]).toMatchObject({ kind: 'parcela', numero: 141, valor: 9999, paga: { dataPagamento: '2026-08-05' } });
  expect(linhas[2]).toMatchObject({ kind: 'parcela', numero: 143, valor: 10143, paga: null });
});

it('deduplica parcela paga que também aparece na projeção (paga vence)', () => {
  const linhas = buildCronograma(BASELINE, projetadas(141, 142), {
    pagas: [paga(141, 9999, '2026-08-05')],
    extras: [],
  });
  expect(linhas).toHaveLength(2);
  expect(linhas[0]).toMatchObject({ kind: 'parcela', numero: 141, valor: 9999, paga: { dataPagamento: '2026-08-05' } });
});

it('intercala amortizações pela data: antes da primeira, entre parcelas e depois da última', () => {
  const venc141 = BASELINE.dataBase;
  const venc142 = addMonthsISO(BASELINE.dataBase, 1);
  const linhas = buildCronograma(BASELINE, projetadas(141, 142, 143), {
    pagas: [],
    extras: [
      amortizacao(500, venc142), // empata com o vencimento da 142: entra depois dela
      amortizacao(100, addMonthsISO(venc141, -1)), // antes da 141
      amortizacao(900, addMonthsISO(venc142, 1)), // depois da 143
    ],
  });
  expect(linhas.map((l) => (l.kind === 'parcela' ? `p${l.numero}` : `a${l.valor}`))).toEqual([
    'a100', 'p141', 'p142', 'a500', 'p143', 'a900',
  ]);
});

it('ordena amortizações na mesma posição pela data', () => {
  const linhas = buildCronograma(BASELINE, projetadas(141, 142), {
    pagas: [],
    extras: [amortizacao(700, '2026-09-20'), amortizacao(300, '2026-09-10')],
  });
  expect(linhas.map((l) => (l.kind === 'parcela' ? `p${l.numero}` : `a${l.valor}`))).toEqual([
    'p141', 'a300', 'a700', 'p142',
  ]);
});

it('projeção vazia (quitado) lista só as amortizações do histórico em ordem de data', () => {
  const linhas = buildCronograma(BASELINE, projetadas(), {
    pagas: [],
    extras: [amortizacao(500, '2026-09-20'), amortizacao(300, '2026-09-10')],
  });
  expect(linhas.map((l) => (l.kind === 'amortizacao' ? l.valor : l.numero))).toEqual([300, 500]);
});
