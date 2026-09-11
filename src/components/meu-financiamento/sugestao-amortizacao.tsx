'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ParcelaPaga,
  Projecao,
} from '@/lib/finance/meu-financiamento/model';
import { opcoesSugestao } from '@/lib/finance/meu-financiamento/sugestao-opcoes';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

/**
 * Sugestão de amortização junto com a parcela do mês: ideal calculado (menor
 * aporte que corta 1 parcela na tela E no painel "E se?"), meia parcela e
 * parcela extra, cada um com a economia total do MESMO helper do E se?
 * (`economiaDoAporte`). "Aplicar" abre o pagamento preenchido com o aporte
 * explícito no modo "Reduziu o prazo".
 */
export function SugestaoAmortizacao({
  params,
  baseline,
  pagas,
  extras,
  projecao: atual,
  onAplicar,
}: {
  params: ContractParams;
  baseline: Baseline;
  pagas: ParcelaPaga[];
  extras: AmortizacaoExtra[];
  projecao: Projecao;
  onAplicar: (aporte: number) => void;
}) {
  const hoje = todayISO();
  const opcoes = useMemo(
    () => opcoesSugestao({ params, baseline, pagas, extras, projecao: atual }, hoje),
    [params, baseline, pagas, extras, atual, hoje],
  );

  return (
    <div
      data-sugestao-amortizacao
      className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4"
    >
      <p className="text-sm font-medium">Quer amortizar junto?</p>
      {opcoes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {opcoes.map((opcao) => (
            <div
              key={opcao.id}
              data-opcao={opcao.id}
              className={`flex flex-col gap-2 rounded-xl border bg-card p-3 ${
                opcao.id === 'ideal'
                  ? 'border-[#820AD1]/50 ring-1 ring-[#820AD1]/20'
                  : 'border-border'
              }`}
            >
              <p className="text-sm font-medium">{opcao.titulo}</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                + {formatBRL(opcao.aporte)}
              </p>
              <p className={`text-xs ${opcao.economia > 0 ? 'font-medium text-[#820AD1]' : 'text-muted-foreground'}`}>
                {opcao.economia > 0
                  ? `Economia total de ${formatBRL(opcao.economia)}`
                  : 'sem economia no modelo'}
              </p>
              {opcao.efeito && <p className="text-xs text-muted-foreground">{opcao.efeito}</p>}
              <Button
                type="button"
                variant={opcao.id === 'ideal' ? 'default' : 'outline'}
                className="mt-auto"
                aria-label={`Aplicar ${opcao.aria}`}
                onClick={() => onAplicar(opcao.aporte)}
              >
                Aplicar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
