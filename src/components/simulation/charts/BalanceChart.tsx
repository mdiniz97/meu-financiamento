'use client';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL } from '@/lib/utils';

export function BalanceChart({ data }: { data: { month: number; saldo: number }[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
      <h3 className="text-sm font-semibold">Saldo devedor</h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <XAxis dataKey="month" tickFormatter={(m) => `m${m}`} />
          <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Area dataKey="saldo" stroke="#820AD1" fill="#820AD1" fillOpacity={0.2} name="Saldo devedor" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
