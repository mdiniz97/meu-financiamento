'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PageState } from '@/lib/meu-financiamento/repo';
import {
  buildCronograma,
  type CronogramaParcela,
} from '@/lib/meu-financiamento/cronograma';
import { origemLabel } from '@/lib/meu-financiamento/timeline';
import { formatDataBr } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const LINHAS_POR_VEZ = 24;
const HEAD_BASE = 'sticky top-0 z-10 bg-card h-10 px-2 align-middle font-medium whitespace-nowrap text-foreground';

function modoCurto(modo: 'term' | 'payment'): string {
  return modo === 'term' ? 'Reduziu o prazo' : 'Reduziu a parcela';
}

/** Célula numérica da composição: "—" quando o encadeamento não reconstruiu a
 *  paga (período anterior), senão o valor projetado/real em BRL. */
function celulaValor(valor: number | undefined): string {
  return valor == null ? '—' : formatBRL(valor);
}

/** O saldo por competência das pagas é o do encadeamento SEM extras; quando
 *  existe amortização extra do estado vigente até a data da paga ele deixa de
 *  representar o saldo real e vira "—", para não conflitar com o saldo efetivo
 *  do estado. Nas parcelas em aberto o saldo é sempre exibido. */
function saldoParcela(linha: CronogramaParcela, extraAplicavel: (data: string) => boolean): string {
  if (!linha.composicao) return '—';
  if (linha.situacao !== 'aberta' && extraAplicavel(linha.paga?.dataPagamento ?? '')) return '—';
  return formatBRL(linha.composicao.saldo);
}

const STICKY_BG: Record<CronogramaParcela['situacao'], string> = {
  paga: 'bg-emerald-50 dark:bg-emerald-950',
  historico: 'bg-muted',
  aberta: 'bg-card',
};

const ROW_BG: Record<CronogramaParcela['situacao'], string> = {
  paga: 'bg-emerald-50/40 dark:bg-emerald-950/20',
  historico: 'bg-muted/30',
  aberta: '',
};

function Situacao({ linha }: { linha: CronogramaParcela }) {
  if (linha.situacao === 'aberta') {
    return <span className="text-muted-foreground">Em aberto</span>;
  }
  if (linha.situacao === 'paga') {
    return (
      <span className="inline-flex flex-col text-emerald-700 dark:text-emerald-400">
        <span className="inline-flex items-center gap-1 font-medium">
          <Check className="size-3" />
          Paga
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {formatDataBr(linha.paga?.dataPagamento ?? '')}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col text-muted-foreground">
      <span className="font-medium">Histórico</span>
      <span className="text-xs">{formatDataBr(linha.paga?.dataPagamento ?? '')}</span>
    </span>
  );
}

/**
 * Accordion "Parcelas do Financiamento": cronograma completo a partir do
 * estado vigente (projetadas + pagas do histórico + amortizações extras
 * intercaladas) no padrão da tabela do simulador (scroll interno, header
 * sticky e primeira coluna sticky). Fechado por padrão e sem ações: leitura
 * pura, inclusive no readOnly.
 *
 * As pagas do estado vigente exibem a composição calculada pelo mesmo
 * encadeamento do model (`projecao.pagas`, sem extras); as pagas de baselines
 * anteriores não são reconstruíveis e aparecem como "Histórico", com apenas o
 * valor real, a data e "—" nas células de composição. O Saldo das pagas vira
 * "—" quando há amortização extra do estado vigente até a data da paga, porque
 * o encadeamento sem extras não representa o saldo real daquele ponto.
 */
export function ParcelasDoFinanciamento({
  state,
}: {
  state: Pick<PageState, 'baseline' | 'projecao' | 'historico' | 'extras'>;
}) {
  const [limite, setLimite] = useState(LINHAS_POR_VEZ);
  const linhas = buildCronograma(state.baseline, state.projecao, state.historico);
  const visiveis = linhas.slice(0, limite);
  const temExtraAplicavel = (data: string) => state.extras.some((e) => e.dataPagamento <= data);

  return (
    <details className="group rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
        Parcelas do Financiamento
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma parcela para exibir.</p>
        ) : (
          <>
            <div className="h-[480px] overflow-auto rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
              <table className="w-full caption-bottom border-separate border-spacing-0 font-mono tabular-nums text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className={`${HEAD_BASE} sticky left-0 z-20 border-r border-border`}>
                      Nº
                    </TableHead>
                    <TableHead scope="col" className={HEAD_BASE}>Vencimento</TableHead>
                    <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Parcela</TableHead>
                    <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Juros</TableHead>
                    <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Amortização</TableHead>
                    <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Seguro</TableHead>
                    <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Correção</TableHead>
                    <TableHead scope="col" className={`${HEAD_BASE} text-right`}>Saldo</TableHead>
                    <TableHead scope="col" className={HEAD_BASE}>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((linha) => {
                    if (linha.kind === 'amortizacao') {
                      return (
                        <TableRow
                          key={`amortizacao-${linha.id}`}
                          data-row="amortizacao"
                          data-extra={linha.id}
                          className="bg-[#820AD1]/5 text-[#820AD1]"
                        >
                          <TableCell colSpan={3} className="font-medium whitespace-normal">
                            Amortização extra de {formatBRL(linha.valor)} · {origemLabel(linha.origem)} ·{' '}
                            {modoCurto(linha.modo)} · {formatDataBr(linha.dataPagamento)}
                          </TableCell>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <TableCell key={i} className="text-right text-muted-foreground">
                              —
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow
                        key={`parcela-${linha.numero}`}
                        data-row="parcela"
                        data-numero={linha.numero}
                        data-situacao={linha.situacao}
                        className={ROW_BG[linha.situacao]}
                      >
                        <TableCell
                          className={`sticky left-0 z-10 border-r border-border font-medium ${STICKY_BG[linha.situacao]}`}
                        >
                          {linha.numero}
                        </TableCell>
                        <TableCell>{formatDataBr(linha.vencimento)}</TableCell>
                        <TableCell className="text-right">{formatBRL(linha.valor)}</TableCell>
                        <TableCell className="text-right">{celulaValor(linha.composicao?.juros)}</TableCell>
                        <TableCell className="text-right">{celulaValor(linha.composicao?.amortizacao)}</TableCell>
                        <TableCell className="text-right">{celulaValor(linha.composicao?.seguro)}</TableCell>
                        <TableCell className="text-right">{celulaValor(linha.composicao?.correcao)}</TableCell>
                        <TableCell data-cell="saldo" className="text-right">
                          {saldoParcela(linha, temExtraAplicavel)}
                        </TableCell>
                        <TableCell>
                          <Situacao linha={linha} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
            {limite < linhas.length && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLimite((atual) => atual + LINHAS_POR_VEZ)}
                >
                  Mostrar mais
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
