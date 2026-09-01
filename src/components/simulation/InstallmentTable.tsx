import type { Installment } from '@/lib/finance/types';
import { formatBRL } from '@/lib/utils';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const HEAD_BASE = 'sticky top-0 z-10 bg-card h-10 px-2 align-middle font-medium whitespace-nowrap text-foreground';

export function InstallmentTable({ installments, height = 'h-[480px]', showAporte = true, minimal = false }: { installments: Installment[]; height?: string; showAporte?: boolean; minimal?: boolean }) {
  return (
    <div className={`${height} overflow-auto rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10`}>
      <table className="w-full caption-bottom border-separate border-spacing-0 font-mono tabular-nums text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className={`${HEAD_BASE} sticky left-0 z-20 border-r border-border`}>
              Mês
            </TableHead>
            <TableHead className={`${HEAD_BASE} text-right`}>Parcela</TableHead>
            {!minimal && showAporte && <TableHead className={`${HEAD_BASE} text-right`}>Aporte</TableHead>}
            {!minimal && (
              <>
                <TableHead className={`${HEAD_BASE} text-right`}>Total</TableHead>
                <TableHead className={`${HEAD_BASE} text-right`}>Juros</TableHead>
                <TableHead className={`${HEAD_BASE} text-right`}>Amortização</TableHead>
                <TableHead className={`${HEAD_BASE} text-right`}>Seguro</TableHead>
                <TableHead className={`${HEAD_BASE} text-right`}>Correção</TableHead>
                <TableHead className={`${HEAD_BASE} text-right`}>Saldo</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((i) => (
            <TableRow key={i.month}>
              <TableCell className="sticky left-0 z-10 border-r border-border bg-card font-medium">
                {i.month}
              </TableCell>
              <TableCell className="text-right">{formatBRL(Math.max(0, i.parcela - i.extra))}</TableCell>
              {!minimal && (
                <>
                  <TableCell className="text-right">
                    {i.extra > 0 ? <span className="font-medium text-primary">{formatBRL(i.extra)}</span> : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(i.parcela)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.juros)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.amortizacao)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.seguro)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.correcao)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.saldo)}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}
