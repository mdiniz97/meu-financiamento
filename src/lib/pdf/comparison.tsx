import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { computeComparator, type ProposalOutcome } from '@/lib/comparator/calculate';
import type { ComparatorInput } from '@/lib/comparator/types';

const PURPLE = '#820AD1';
const GRAY = '#6B7280';

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#111827', fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 'bold', color: PURPLE },
  subtitle: { fontSize: 8, color: GRAY, marginTop: 2 },
  section: { fontSize: 12, fontWeight: 'bold', color: PURPLE, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: '35%', color: GRAY },
  value: { width: '65%', fontWeight: 'bold' },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PURPLE, paddingBottom: 3, marginBottom: 3 },
  thCell: { fontWeight: 'bold', color: PURPLE, width: '16.6%', fontSize: 8 },
  tr: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  td: { width: '16.6%', fontSize: 8 },
  note: { fontSize: 7, color: GRAY, marginTop: 8 },
});

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

export function buildComparisonPdf(input: ComparatorInput) {
  const { ranked, smartRanked } = computeComparator(input).v1;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Comparação de propostas</Text>
        <Text style={styles.subtitle}>
          Gerado em {new Date().toLocaleString('pt-BR')} · Orçamento mensal: {brl(input.monthlyBudget)} · Exclusivo do plano Ilimitado
        </Text>

        <Text style={styles.section}>Ranking por custo total da aquisição</Text>
        <View style={styles.th}>
          {['Proposta', 'Custo aquisição', 'Custo financiam.', '/R$100 mil', 'Parcela 1', 'CET calc.'].map((h) => (
            <Text key={h} style={styles.thCell}>
              {h}
            </Text>
          ))}
        </View>
        {ranked.map((o: ProposalOutcome, i: number) => (
          <View key={o.proposal.id} style={styles.tr}>
            <Text style={styles.td}>
              {i + 1}º {o.proposal.bank} ({o.proposal.system})
            </Text>
            <Text style={styles.td}>{brl(o.acquisitionCost)}</Text>
            <Text style={styles.td}>{brl(o.financingCost)}</Text>
            <Text style={styles.td}>{brl(o.costPer100k)}</Text>
            <Text style={styles.td}>{brl(o.result.installments[0]?.parcela ?? 0)}</Text>
            <Text style={styles.td}>
              {pct(o.cetCalculated)}
              {o.cetAlert ? ' ⚠' : ''}
            </Text>
          </View>
        ))}

        <Text style={styles.section}>CET: informado vs calculado</Text>
        {ranked.map((o: ProposalOutcome) => (
          <View key={o.proposal.id} style={styles.row}>
            <Text style={styles.label}>{o.proposal.bank}</Text>
            <Text style={styles.value}>
              {pct(o.proposal.cetInformed)} informado · {pct(o.cetCalculated)} calculado
              {o.cetAlert ? ' · divergência' : ''}
            </Text>
          </View>
        ))}

        <Text style={styles.section}>Amortizador inteligente</Text>
        {smartRanked.map((o: ProposalOutcome) => (
          <View key={o.proposal.id} style={styles.row}>
            <Text style={styles.label}>{o.proposal.bank}</Text>
            <Text style={styles.value}>
              {o.smart?.feasible
                ? `Quita em ${o.smart.recommended.best?.result.metrics.saldoZeroAt ?? '-'} meses com aporte de ${brl(o.smart.recommended.best?.extraMonthlyAmount ?? 0)}/mês`
                : `Não cabe no orçamento: mínimo de ${brl(o.smart?.minBudget ?? 0)}/mês`}
            </Text>
          </View>
        ))}

        <Text style={styles.note}>
          Custo da aquisição = entrada + total pago (parcelas, seguro e correção) + tarifas. Custo do financiamento exclui a
          entrada. Números dependem dos dados informados e não constituem proposta oficial dos bancos.
        </Text>
      </Page>
    </Document>
  );
}
