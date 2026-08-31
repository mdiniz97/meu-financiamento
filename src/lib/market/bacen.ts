export interface SgsRow {
  data: string;
  valor: string;
}

export interface OlindaRow {
  InicioPeriodo: string;
  FimPeriodo: string;
  codigoModalidade: string;
  Modalidade: string;
  InstituicaoFinanceira: string;
  TaxaJurosAoMes: number;
  TaxaJurosAoAno: number;
}

export interface MarketPoint {
  month: string;
  value: number;
}

export interface HistoryPoint {
  month: string;
  selic: number | null;
  ipca: number | null;
  tr: number | null;
}

export interface CurrentIndicator {
  value: number;
  unit: string;
  month: string;
  accumulatedYear: number | null;
  accumulated12Months: number | null;
  annualRate: number | null;
}

export interface MortgageProduct {
  code: string;
  type: 'mercado' | 'regulada';
  indexer: 'prefixado' | 'tr' | 'ipca';
  rateYear: number;
  rateMonth: number;
}

export interface MortgageInstitution {
  institution: string;
  products: MortgageProduct[];
}

export interface MarketOverview {
  updatedAt: string | null;
  indicators: {
    selic: CurrentIndicator | null;
    ipca: CurrentIndicator | null;
    tr: CurrentIndicator | null;
  };
  history: HistoryPoint[];
  mortgage: MortgageInstitution[];
}

const CACHE_SECONDS = 12 * 60 * 60;

const MODALIDADES: Record<string, { type: MortgageProduct['type']; indexer: MortgageProduct['indexer'] }> = {
  '903101': { type: 'mercado', indexer: 'prefixado' },
  '903201': { type: 'mercado', indexer: 'tr' },
  '903203': { type: 'mercado', indexer: 'ipca' },
  '905101': { type: 'regulada', indexer: 'prefixado' },
  '905201': { type: 'regulada', indexer: 'tr' },
  '905203': { type: 'regulada', indexer: 'ipca' },
};

const MORTGAGE_CODES = Object.keys(MODALIDADES);

export function parseSgsValue(raw: string): number {
  const cleaned = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  return Number.parseFloat(cleaned);
}

export function sgsToPoints(rows: SgsRow[]): MarketPoint[] {
  return rows.map((row) => {
    const [, month, year] = row.data.split('/');
    return { month: `${year}-${month}`, value: parseSgsValue(row.valor) };
  });
}

export function buildHistory(
  series: Record<'selic' | 'ipca' | 'tr', MarketPoint[]>,
  limit: number
): HistoryPoint[] {
  const months = new Set<string>([
    ...series.selic.map((p) => p.month),
    ...series.ipca.map((p) => p.month),
    ...series.tr.map((p) => p.month),
  ]);
  return [...months]
    .sort()
    .slice(-limit)
    .map((month) => ({
      month,
      selic: series.selic.find((p) => p.month === month)?.value ?? null,
      ipca: series.ipca.find((p) => p.month === month)?.value ?? null,
      tr: series.tr.find((p) => p.month === month)?.value ?? null,
    }));
}

export function accumulateSeries(points: MarketPoint[], year?: string): number | null {
  const filtered = year ? points.filter((p) => p.month.startsWith(`${year}-`)) : points;
  if (filtered.length === 0) return null;
  let factor = 1;
  for (const point of filtered) {
    factor *= 1 + point.value / 100;
  }
  return (factor - 1) * 100;
}

export function olindaToMortgage(rows: OlindaRow[]): MortgageInstitution[] {
  const latest = rows.reduce<string | null>((max, row) => {
    if (!row.FimPeriodo) return max;
    return max === null || row.FimPeriodo > max ? row.FimPeriodo : max;
  }, null);
  if (latest === null) return [];

  const byInstitution = new Map<string, MortgageProduct[]>();
  for (const row of rows) {
    if (row.FimPeriodo !== latest) continue;
    const modalidade = MODALIDADES[row.codigoModalidade];
    if (!modalidade) continue;
    const products = byInstitution.get(row.InstituicaoFinanceira) ?? [];
    products.push({
      code: row.codigoModalidade,
      type: modalidade.type,
      indexer: modalidade.indexer,
      rateYear: row.TaxaJurosAoAno,
      rateMonth: row.TaxaJurosAoMes,
    });
    byInstitution.set(row.InstituicaoFinanceira, products);
  }

  return [...byInstitution.entries()]
    .map(([institution, products]) => ({
      institution,
      products: products.sort(
        (a, b) =>
          a.rateYear - b.rateYear ||
          a.rateMonth - b.rateMonth ||
          a.code.localeCompare(b.code)
      ),
    }))
    .sort((a, b) => {
      const aMin = Math.min(...a.products.map((p) => p.rateYear));
      const bMin = Math.min(...b.products.map((p) => p.rateYear));
      return aMin - bMin || a.institution.localeCompare(b.institution);
    });
}

function formatBrasilDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

async function fetchSgsSeries(code: number, months: number): Promise<MarketPoint[]> {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1);
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${formatBrasilDate(start)}&dataFinal=${formatBrasilDate(end)}`;
  const response = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
  if (!response.ok) return [];
  const rows = (await response.json()) as SgsRow[];
  return sgsToPoints(rows);
}

async function fetchSgsLatest(code: number): Promise<number | null> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;
  const response = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
  if (!response.ok) return null;
  const rows = (await response.json()) as SgsRow[];
  const last = rows[rows.length - 1];
  return last ? parseSgsValue(last.valor) : null;
}

async function fetchMortgageRates(): Promise<MortgageInstitution[]> {
  const filter = MORTGAGE_CODES.map((code) => `codigoModalidade eq '${code}'`).join(' or ');
  const url = `https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/ConsultaUnificada?$top=1000&$filter=(${encodeURIComponent(filter)})&$format=json`;
  const response = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
  if (!response.ok) return [];
  const payload = (await response.json()) as { value?: OlindaRow[] };
  return olindaToMortgage(payload.value ?? []);
}

export function lastPoint(points: MarketPoint[], annualRate: number | null = null): CurrentIndicator | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const year = last.month.split('-')[0];
  return {
    value: last.value,
    unit: '% a.m.',
    month: last.month,
    accumulatedYear: accumulateSeries(points, year),
    accumulated12Months: accumulateSeries(points.slice(-12)),
    annualRate,
  };
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const [selic, ipca, tr, selicAnnual, mortgage] = await Promise.all([
    fetchSgsSeries(4390, 13),
    fetchSgsSeries(433, 13),
    fetchSgsSeries(7811, 13),
    fetchSgsLatest(432),
    fetchMortgageRates(),
  ]);

  const history = buildHistory({ selic, ipca, tr }, 12);
  return {
    updatedAt: history[history.length - 1]?.month ?? null,
    indicators: {
      selic: lastPoint(selic, selicAnnual),
      ipca: lastPoint(ipca),
      tr: lastPoint(tr),
    },
    history,
    mortgage,
  };
}
