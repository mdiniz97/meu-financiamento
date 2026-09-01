'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { HistoryPoint } from '@/lib/market/bacen';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthLabel(month: string): string {
  const [, m] = month.split('-');
  return MONTHS_SHORT[Number(m) - 1] ?? month;
}

export function HistoryChart({ data }: { data: HistoryPoint[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Evolução dos indicadores</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          Fonte: BACEN
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <XAxis dataKey="month" tickFormatter={monthLabel} />
          <YAxis tickFormatter={(v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`} />
          <Tooltip
            labelFormatter={(label) => monthLabel(String(label))}
            formatter={(value: unknown, name: unknown) => [
              `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.m.`,
              name === 'selic' ? 'Selic' : name === 'ipca' ? 'IPCA' : 'TR',
            ]}
          />
          <Line type="monotone" dataKey="selic" stroke="#820AD1" strokeWidth={2} dot={false} name="selic" connectNulls />
          <Line type="monotone" dataKey="ipca" stroke="#2563EB" strokeWidth={2} dot={false} name="ipca" connectNulls />
          <Line type="monotone" dataKey="tr" stroke="#9CA3AF" strokeWidth={2} dot={false} name="tr" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
