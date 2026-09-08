'use client';

import type { SimulationResult } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  base: SimulationResult;
  current: SimulationResult;
}

export function ScenarioCompare({ base, current }: Props) {
  const bestIdx = current.metrics.totalPago < base.metrics.totalPago ||
    (current.metrics.totalPago === base.metrics.totalPago && current.metrics.saldoZeroAt < base.metrics.saldoZeroAt) ? 1 : 0;
  const scenarios = [base, current];

  const rows: { label: string; values: [string, string] }[] = [
    {
      label: 'Total pago',
      values: [formatBRL(base.metrics.totalPago), formatBRL(current.metrics.totalPago)],
    },
    {
      label: 'Juros totais',
      values: [formatBRL(base.metrics.totalJuros), formatBRL(current.metrics.totalJuros)],
    },
    {
      label: 'Correção total',
      values: [formatBRL(base.metrics.totalCorrecao), formatBRL(current.metrics.totalCorrecao)],
    },
    {
      label: 'Seguro total',
      values: [formatBRL(base.metrics.totalSeguro), formatBRL(current.metrics.totalSeguro)],
    },
    {
      label: 'Dívida além da dívida',
      values: [
        formatBRL(base.metrics.dividaAlemDaDivida),
        formatBRL(current.metrics.dividaAlemDaDivida),
      ],
    },
    {
      label: 'Parcela inicial',
      values: [
        formatBRL(base.installments[0]?.parcela ?? 0),
        formatBRL(current.installments[0]?.parcela ?? 0),
      ],
    },
    {
      label: 'Quitação',
      values: [`${base.metrics.saldoZeroAt} meses`, `${current.metrics.saldoZeroAt} meses`],
    },
  ];

  return (
    <div className="rounded-2xl border border-muted-foreground/40 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-base font-semibold">Comparação de cenários</h3>
        <Badge>Melhor caminho: cenário {bestIdx === 0 ? 'sem' : 'com'} estratégia</Badge>
      </div>
      <Table className="font-mono tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead className="text-right">
              Sem estratégia {bestIdx === 0 && <span className="text-[#820AD1]">●</span>}
            </TableHead>
            <TableHead className="text-right">
              Com estratégia {bestIdx === 1 && <span className="text-[#820AD1]">●</span>}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="font-medium">{r.label}</TableCell>
              <TableCell className="text-right">{r.values[0]}</TableCell>
              <TableCell className="text-right">{r.values[1]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        {scenarios[bestIdx].metrics.totalPago === scenarios[1 - bestIdx].metrics.totalPago
          ? 'Cenários empatados em custo total.'
          : ''}
      </p>
    </div>
  );
}
