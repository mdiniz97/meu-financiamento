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

export function InstallmentTable({ installments }: { installments: Installment[] }) {
  return (
    <ScrollArea className="max-h-[480px] rounded-2xl bg-white shadow-sm">
      <Table>
        <TableHeader className="sticky top-0 bg-white">
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Parcela</TableHead>
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
              <TableCell className="text-right">{formatBRL(i.parcela)}</TableCell>
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
