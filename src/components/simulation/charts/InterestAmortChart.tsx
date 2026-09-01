'use client';
import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Installment } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';

export function InterestAmortChart({ installments }: { installments: Installment[] }) {
  const data = useMemo(
    () =>
      installments.reduce<{ month: number; jurosAcum: number; amortAcum: number }[]>(
        (acc, i) => {
          const prev = acc[acc.length - 1];
          acc.push({
            month: i.month,
            jurosAcum: (prev?.jurosAcum ?? 0) + i.juros,
            amortAcum: (prev?.amortAcum ?? 0) + i.amortizacao,
          });
          return acc;
        },
        []
      ),
    [installments]
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="font-display text-sm font-semibold">Juros vs Amortização (acumulado)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <XAxis dataKey="month" tickFormatter={(m) => `m${m}`} />
          <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Area stackId="acum" dataKey="amortAcum" stroke="#820AD1" fill="#820AD1" fillOpacity={0.2} name="Amortização acumulada" />
          <Area stackId="acum" dataKey="jurosAcum" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} name="Juros acumulados" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
