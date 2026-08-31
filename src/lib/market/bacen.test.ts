import { describe, expect, it } from 'vitest';
import {
  accumulateSeries,
  buildHistory,
  lastPoint,
  olindaToMortgage,
  parseSgsValue,
  sgsToPoints,
  type OlindaRow,
  type SgsRow,
} from './bacen';

const SELIC_ROWS: SgsRow[] = [
  { data: '01/07/2026', valor: '1.22' },
  { data: '01/08/2026', valor: '1.04' },
];

const TR_ROWS: SgsRow[] = [
  { data: '01/07/2026', valor: '0.1729' },
  { data: '01/08/2026', valor: '0.1693' },
];

describe('parseSgsValue', () => {
  it('converte ponto decimal sem separador de milhar', () => {
    expect(parseSgsValue('1.22')).toBe(1.22);
    expect(parseSgsValue('0.1693')).toBe(0.1693);
  });

  it('aceita vírgula decimal como o SGS também entrega em alguns formatos', () => {
    expect(parseSgsValue('0,17')).toBe(0.17);
  });

  it('ignora ponto de milhar quando há vírgula decimal', () => {
    expect(parseSgsValue('1.234,56')).toBe(1234.56);
  });
});

describe('sgsToPoints', () => {
  it('extrai mês e valor de cada observação', () => {
    expect(sgsToPoints(SELIC_ROWS)).toEqual([
      { month: '2026-07', value: 1.22 },
      { month: '2026-08', value: 1.04 },
    ]);
  });
});

describe('accumulateSeries', () => {
  it('acumula variações mensais de forma composta', () => {
    const points = [
      { month: '2026-01', value: 0.5 },
      { month: '2026-02', value: 1 },
      { month: '2026-03', value: 2 },
    ];
    expect(accumulateSeries(points)).toBeCloseTo(3.5351, 4);
  });

  it('filtra por ano quando informado', () => {
    const points = [
      { month: '2025-12', value: 3 },
      { month: '2026-01', value: 0.5 },
      { month: '2026-02', value: 1 },
    ];
    expect(accumulateSeries(points, '2026')).toBeCloseTo(1.505, 3);
    expect(accumulateSeries(points, '2025')).toBeCloseTo(3, 3);
  });

  it('retorna null quando não há pontos no recorte', () => {
    expect(accumulateSeries([], '2026')).toBeNull();
    expect(accumulateSeries([{ month: '2025-12', value: 1 }], '2026')).toBeNull();
  });
});

describe('lastPoint', () => {
  it('usa a última observação como indicador atual', () => {
    const indicator = lastPoint([
      { month: '2026-06', value: 1.22 },
      { month: '2026-07', value: 1.22 },
    ]);
    expect(indicator?.value).toBe(1.22);
    expect(indicator?.month).toBe('2026-07');
  });

  it('carrega a taxa anual corrente quando informada', () => {
    const indicator = lastPoint(
      [{ month: '2026-08', value: 1.04 }],
      14
    );
    expect(indicator?.annualRate).toBe(14);
  });

  it('retorna null quando não há observações', () => {
    expect(lastPoint([])).toBeNull();
  });
});

describe('buildHistory', () => {
  it('junta séries pela chave de mês, ordena e limita aos últimos meses', () => {
    const history = buildHistory(
      {
        selic: sgsToPoints(SELIC_ROWS),
        ipca: sgsToPoints([{ data: '01/07/2026', valor: '0.07' }]),
        tr: sgsToPoints(TR_ROWS),
      },
      12
    );
    expect(history).toEqual([
      { month: '2026-07', selic: 1.22, ipca: 0.07, tr: 0.1729 },
      { month: '2026-08', selic: 1.04, ipca: null, tr: 0.1693 },
    ]);
  });

  it('limita à janela pedida quando há mais meses que o limite', () => {
    const history = buildHistory({ selic: sgsToPoints(SELIC_ROWS), ipca: [], tr: [] }, 1);
    expect(history).toEqual([{ month: '2026-08', selic: 1.04, ipca: null, tr: null }]);
  });
});

describe('olindaToMortgage', () => {
  const ROWS: OlindaRow[] = [
    {
      InicioPeriodo: '2026-06-01',
      FimPeriodo: '2026-06-30',
      codigoModalidade: '903101',
      Modalidade: 'Financiamento imobiliário com taxas de mercado - Prefixado',
      InstituicaoFinanceira: 'CAIXA ECONOMICA FEDERAL',
      TaxaJurosAoMes: 1.12,
      TaxaJurosAoAno: 14.3,
    },
    {
      InicioPeriodo: '2026-07-01',
      FimPeriodo: '2026-07-31',
      codigoModalidade: '903101',
      Modalidade: 'Financiamento imobiliário com taxas de mercado - Prefixado',
      InstituicaoFinanceira: 'CAIXA ECONOMICA FEDERAL',
      TaxaJurosAoMes: 1.11,
      TaxaJurosAoAno: 14.1,
    },
    {
      InicioPeriodo: '2026-07-01',
      FimPeriodo: '2026-07-31',
      codigoModalidade: '903201',
      Modalidade: 'Financiamento imobiliário com taxas de mercado - TR',
      InstituicaoFinanceira: 'CAIXA ECONOMICA FEDERAL',
      TaxaJurosAoMes: 0.86,
      TaxaJurosAoAno: 10.8,
    },
    {
      InicioPeriodo: '2026-07-01',
      FimPeriodo: '2026-07-31',
      codigoModalidade: '905101',
      Modalidade: 'Financiamento imobiliário com taxas reguladas - Prefixado',
      InstituicaoFinanceira: 'BCO DO BRASIL S.A.',
      TaxaJurosAoMes: 1.05,
      TaxaJurosAoAno: 13.2,
    },
    {
      InicioPeriodo: '2026-07-01',
      FimPeriodo: '2026-07-31',
      codigoModalidade: '999999',
      Modalidade: 'Modalidade desconhecida',
      InstituicaoFinanceira: 'BCO DO BRASIL S.A.',
      TaxaJurosAoMes: 9,
      TaxaJurosAoAno: 99,
    },
  ];

  it('mantém apenas a última publicação (maior FimPeriodo)', () => {
    const result = olindaToMortgage(ROWS);
    const caixa = result.find((i) => i.institution === 'CAIXA ECONOMICA FEDERAL');
    expect(caixa?.products.find((p) => p.code === '903101')?.rateYear).toBe(14.1);
    expect(result.every((i) => i.products.length > 0)).toBe(true);
  });

  it('agrupa por instituição e mapeia códigos para tipo e indexador', () => {
    const result = olindaToMortgage(ROWS);
    const caixa = result.find((i) => i.institution === 'CAIXA ECONOMICA FEDERAL');
    expect(caixa?.products).toEqual([
      { code: '903201', type: 'mercado', indexer: 'tr', rateYear: 10.8, rateMonth: 0.86 },
      { code: '903101', type: 'mercado', indexer: 'prefixado', rateYear: 14.1, rateMonth: 1.11 },
    ]);
    const bb = result.find((i) => i.institution === 'BCO DO BRASIL S.A.');
    expect(bb?.products).toEqual([
      { code: '905101', type: 'regulada', indexer: 'prefixado', rateYear: 13.2, rateMonth: 1.05 },
    ]);
  });

  it('ordena taxas da menor para a maior e instituições pela menor taxa', () => {
    const result = olindaToMortgage(ROWS);
    expect(result.map((i) => i.institution)).toEqual([
      'CAIXA ECONOMICA FEDERAL',
      'BCO DO BRASIL S.A.',
    ]);
    for (const institution of result) {
      const rates = institution.products.map((p) => p.rateYear);
      expect(rates).toEqual([...rates].sort((a, b) => a - b));
    }
  });
});
