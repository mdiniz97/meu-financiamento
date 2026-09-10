'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PageState } from '@/lib/meu-financiamento/repo';
import { buildCronograma } from '@/lib/meu-financiamento/cronograma';
import { origemLabel } from '@/lib/meu-financiamento/timeline';
import { formatDataBr } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

const LINHAS_POR_VEZ = 24;

function modoCurto(modo: 'term' | 'payment'): string {
  return modo === 'term' ? 'Reduziu o prazo' : 'Reduziu a parcela';
}

/**
 * Accordion "Todas as parcelas": cronograma completo a partir do estado vigente
 * (projetadas + pagas do histórico + amortizações extras intercaladas). Fechado
 * por padrão e sem ações: leitura pura, inclusive no readOnly.
 */
export function TodasParcelas({
  state,
}: {
  state: Pick<PageState, 'baseline' | 'projecao' | 'historico'>;
}) {
  const [limite, setLimite] = useState(LINHAS_POR_VEZ);
  const linhas = buildCronograma(state.baseline, state.projecao, state.historico);
  const visiveis = linhas.slice(0, limite);

  return (
    <details className="group rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-display text-lg font-semibold [&::-webkit-details-marker]:hidden">
        Todas as parcelas
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma parcela para exibir.</p>
        ) : (
          <>
            <ol className="flex flex-col">
              {visiveis.map((linha) => {
                if (linha.kind === 'amortizacao') {
                  return (
                    <li
                      key={`amortizacao-${linha.id}`}
                      className="rounded-lg bg-[#820AD1]/5 px-3 py-2 text-sm text-[#820AD1]"
                    >
                      Amortização extra de {formatBRL(linha.valor)} ({origemLabel(linha.origem)},{' '}
                      {modoCurto(linha.modo)}) em {formatDataBr(linha.dataPagamento)}
                    </li>
                  );
                }
                return (
                  <li
                    key={`parcela-${linha.numero}`}
                    className="flex flex-col gap-0.5 border-b border-border/60 py-2 last:border-b-0"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">Parcela {linha.numero}</p>
                      {!linha.paga && (
                        <p className="font-mono text-sm tabular-nums">{formatBRL(linha.valor)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Vencimento estimado: {formatDataBr(linha.vencimento)}
                      </span>
                      {linha.paga ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <Check className="size-3" />
                          Paga em {formatDataBr(linha.paga.dataPagamento)} ·{' '}
                          <span className="font-mono tabular-nums">{formatBRL(linha.valor)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Em aberto</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
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
