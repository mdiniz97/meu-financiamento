import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { recommend } from '@/lib/finance/recommend';
import type { SimulationResult, Strategies } from '@/lib/finance/types';

const PURPLE = '#820AD1';
const GRAY = '#6B7280';
const ROWS_PER_PAGE = 40;
const MAX_ROWS = 360;

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    color: '#111827',
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: PURPLE,
    paddingBottom: 8,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: PURPLE },
  subtitle: { fontSize: 8, color: GRAY, marginTop: 2 },
  section: { fontSize: 12, fontWeight: 'bold', color: PURPLE, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: '35%', color: GRAY },
  value: { width: '65%', fontWeight: 'bold' },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PURPLE, paddingBottom: 3, marginBottom: 3 },
  thCell: { fontWeight: 'bold', color: PURPLE },
  tr: { flexDirection: 'row', paddingVertical: 1.5, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  td: { fontSize: 8 },
  colM: { width: '8%' },
  colR: { width: '15.33%', textAlign: 'right' },
  rec: {
    backgroundColor: '#F5F0FA',
    borderLeftWidth: 3,
    borderLeftColor: PURPLE,
    padding: 8,
    fontSize: 8.5,
    color: '#111827',
  },
  metricsRow: { flexDirection: 'row', marginBottom: 6 },
  metricCard: {
    width: '50%',
    flexDirection: 'row',
    borderWidth: 0.5,
    borderColor: '#E9D5F5',
    borderRadius: 4,
    padding: 6,
  },
  metricLabel: { width: '55%', color: GRAY, fontSize: 8 },
  metricValue: { width: '45%', fontWeight: 'bold', fontSize: 8, textAlign: 'right' },
});

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v: number, digits = 2): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function fmt(d: number): string {
  return d.toLocaleString('pt-BR');
}

function Recommendation({ result }: { result: SimulationResult }) {
  const EMPTY: Strategies = { extraLumpSum: [], reduceMode: 'term' };
  const { best } = recommend(result.input, [EMPTY, result.strategies]);
  const isCurrent = best.system === result.system && best.metrics.totalPago === result.metrics.totalPago;
  const savings = best.metrics.totalPago === result.metrics.totalPago ? 0 : result.metrics.totalPago - best.metrics.totalPago;

  return (
    <View style={styles.rec}>
      <Text style={{ fontWeight: 'bold', color: PURPLE }}>Recomendação</Text>
      <Text style={{ marginTop: 4 }}>
        {isCurrent
          ? `As estratégias aplicadas apresentam o menor custo total (${brl(
              result.metrics.totalPago
            )}) e quitação em ${result.metrics.saldoZeroAt} meses.`
          : `O cenário base sem estratégias tem custo ${brl(
              Math.abs(savings)
            )} menor; revise as estratégias para reduzir o total pago.`}
      </Text>
    </View>
  );
}

function InstallmentsTable({
  installments,
  startPage,
}: {
  installments: SimulationResult['installments'];
  startPage: number;
}) {
  const rows = installments.slice(0, MAX_ROWS);
  const chunks: number[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE).map((r) => r.month));
  const header = (
    <View style={styles.th}>
      <Text style={[styles.thCell, styles.colM]}>Mês</Text>
      <Text style={[styles.thCell, styles.colR]}>Parcela</Text>
      <Text style={[styles.thCell, styles.colR]}>Juros</Text>
      <Text style={[styles.thCell, styles.colR]}>Amortização</Text>
      <Text style={[styles.thCell, styles.colR]}>Seguro</Text>
      <Text style={[styles.thCell, styles.colR]}>Correção</Text>
      <Text style={[styles.thCell, styles.colR]}>Saldo</Text>
    </View>
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));

  return chunks.map((months, i) => (
    <Page key={startPage + i} size="A4" style={styles.page}>
      <View style={[styles.header, { marginBottom: 8 }]}>
        <View>
          <Text style={styles.title}>Raio X do Financiamento</Text>
          <Text style={styles.subtitle}>Continuação — tabela de parcelas</Text>
        </View>
      </View>
      {header}
      {months.map((m) => {
        const r = byMonth.get(m)!;
        return (
          <View key={m} style={styles.tr}>
            <Text style={[styles.td, styles.colM]}>{r.month}</Text>
            <Text style={[styles.td, styles.colR]}>{brl(r.parcela)}</Text>
            <Text style={[styles.td, styles.colR]}>{brl(r.juros)}</Text>
            <Text style={[styles.td, styles.colR]}>{brl(r.amortizacao)}</Text>
            <Text style={[styles.td, styles.colR]}>{brl(r.seguro)}</Text>
            <Text style={[styles.td, styles.colR]}>{brl(r.correcao)}</Text>
            <Text style={[styles.td, styles.colR]}>{brl(r.saldo)}</Text>
          </View>
        );
      })}
    </Page>
  ));
}

export function ReportDocument({ result }: { result: SimulationResult }) {
  const { input, metrics } = result;
  const firstPage = 1;

  return (
    <Document title="Raio X do Financiamento">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Raio X do Financiamento</Text>
            <Text style={styles.subtitle}>
              {input.bank} · {new Date().toLocaleDateString('pt-BR')}
            </Text>
          </View>
          <Text style={styles.subtitle}>Gerado em meu-financiamento.app</Text>
        </View>

        <Text style={styles.section}>Resumo</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Sistema</Text>
          <Text style={styles.value}>{input.system}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Valor financiado</Text>
          <Text style={styles.value}>{brl(input.principal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Taxa de juros</Text>
          <Text style={styles.value}>{pct(input.annualRate)} a.a.</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Prazo</Text>
          <Text style={styles.value}>{fmt(input.months)} meses</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>TR (correção mensal)</Text>
          <Text style={styles.value}>{pct(input.trMonthly, 4)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Seguro mensal</Text>
          <Text style={styles.value}>{brl(input.insuranceMonthly)}</Text>
        </View>

        <Text style={styles.section}>Métricas</Text>
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { marginRight: 4 }]}>
            <Text style={styles.metricLabel}>CET anual</Text>
            <Text style={styles.metricValue}>{pct(metrics.cetRealAnual)}</Text>
          </View>
          <View style={[styles.metricCard, { marginLeft: 4 }]}>
            <Text style={styles.metricLabel}>Total pago</Text>
            <Text style={styles.metricValue}>{brl(metrics.totalPago)}</Text>
          </View>
        </View>
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { marginRight: 4 }]}>
            <Text style={styles.metricLabel}>Total de juros</Text>
            <Text style={styles.metricValue}>{brl(metrics.totalJuros)}</Text>
          </View>
          <View style={[styles.metricCard, { marginLeft: 4 }]}>
            <Text style={styles.metricLabel}>Total de seguro</Text>
            <Text style={styles.metricValue}>{brl(metrics.totalSeguro)}</Text>
          </View>
        </View>
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { marginRight: 4 }]}>
            <Text style={styles.metricLabel}>Amortização total</Text>
            <Text style={styles.metricValue}>{brl(metrics.totalAmortizacao)}</Text>
          </View>
          <View style={[styles.metricCard, { marginLeft: 4 }]}>
            <Text style={styles.metricLabel}>Dívida além da dívida</Text>
            <Text style={styles.metricValue}>{brl(metrics.dividaAlemDaDivida)}</Text>
          </View>
        </View>
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { marginRight: 4 }]}>
            <Text style={styles.metricLabel}>Saldo zerado em</Text>
            <Text style={styles.metricValue}>{fmt(metrics.saldoZeroAt)} meses</Text>
          </View>
          <View style={[styles.metricCard, { marginLeft: 4 }]}>
            <Text style={styles.metricLabel}>Parcela / dívida</Text>
            <Text style={styles.metricValue}>{pct(metrics.parcelaPagaDividaPct)}</Text>
          </View>
        </View>

        <Text style={styles.section}>Recomendação</Text>
        <Recommendation result={result} />

        <Text style={styles.section}>Tabela de parcelas</Text>
      </Page>
      <InstallmentsTable installments={result.installments} startPage={firstPage + 1} />
    </Document>
  );
}
