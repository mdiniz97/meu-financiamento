import type { Installment } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function InstallmentTable({ installments, height = 'h-[480px]', showAporte = true }: { installments: Installment[]; height?: string; showAporte?: boolean }) {
  return (
    <ScrollArea className={`${height} rounded-2xl bg-card shadow-sm`}>
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Parcela</TableHead>
            {showAporte && <TableHead className="text-right">Aporte</TableHead>}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Juros</TableHead>
            <TableHead className="text-right">Amortização</TableHead>
            <TableHead className="text-right">Seguro</TableHead>
            <TableHead className="text-right">Correção</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((i) => (
            <TableRow key={i.month}>
              <TableCell className="font-medium">{i.month}</TableCell>
              <TableCell className="text-right">{formatBRL(Math.max(0, i.parcela - i.extra))}</TableCell>
              <TableCell className="text-right">
                {i.extra > 0 ? <span className="font-medium text-primary">{formatBRL(i.extra)}</span> : '-'}
              </TableCell>
              <TableCell className="text-right font-semibold">{formatBRL(i.parcela)}</TableCell>
              <TableCell className="text-right">{formatBRL(i.juros)}</TableCell>
              <TableCell className="text-right">{formatBRL(i.amortizacao)}</TableCell>
              <TableCell className="text-right">{formatBRL(i.seguro)}</TableCell>
              <TableCell className="text-right">{formatBRL(i.correcao)}</TableCell>
              <TableCell className="text-right">{formatBRL(i.saldo)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
