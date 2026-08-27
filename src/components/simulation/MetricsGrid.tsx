import type { SimulationMetrics } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';

const pct = (v: number, digits = 2) => `${(v * 100).toFixed(digits)}%`;

interface Item {
  label: string;
  value: string;
  highlight?: boolean;
  years?: string;
}

export function MetricsGrid({ metrics }: { metrics: SimulationMetrics }) {
  const items: Item[] = [
    { label: 'CET real (a.a.)', value: pct(metrics.cetRealAnual) },
    { label: 'Total pago', value: formatBRL(metrics.totalPago) },
    { label: 'Juros totais', value: formatBRL(metrics.totalJuros) },
    { label: 'Dívida além da dívida', value: formatBRL(metrics.dividaAlemDaDivida) },
    { label: 'Dívida cai em 12 meses', value: formatBRL(metrics.dividaCai12m) },
    { label: 'Dívida cai em 3 anos', value: formatBRL(metrics.dividaCai3a) },
    { label: 'Parcela paga da dívida', value: pct(metrics.parcelaPagaDividaPct, 1) },
    { label: 'Quita em', value: `${metrics.saldoZeroAt} meses`, years: (metrics.saldoZeroAt / 12).toFixed(1), highlight: true },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm"
        >
          <span className="text-xs text-muted-foreground">{it.label}</span>
          <span
            className={
              it.highlight ? 'text-lg font-semibold text-primary' : 'text-lg font-semibold'
            }
          >
            {it.value}
            {it.years && <span className="text-xs font-normal text-muted-foreground"> ({it.years} anos)</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
