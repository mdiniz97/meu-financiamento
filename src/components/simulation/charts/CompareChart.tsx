'use client';
import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL } from '@/lib/utils';

export function CompareChart({
  base,
  withStrategy,
}: {
  base: number[];
  withStrategy: number[];
}) {
  const data = useMemo(() => {
    const len = Math.max(base.length, withStrategy.length);
    return Array.from({ length: len }, (_, i) => ({
      month: i + 1,
      base: base[i] ?? null,
      withStrategy: withStrategy[i] ?? null,
    }));
  }, [base, withStrategy]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Comparação de cenários</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <XAxis dataKey="month" tickFormatter={(m) => `m${m}`} />
          <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Line type="monotone" dataKey="base" stroke="#9CA3AF" strokeWidth={2} dot={false} name="Sem estratégia" />
          <Line type="monotone" dataKey="withStrategy" stroke="#820AD1" strokeWidth={2} dot={false} name="Com estratégia" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
