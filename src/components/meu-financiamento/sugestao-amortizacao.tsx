'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { projecao } from '@/lib/finance/meu-financiamento/model';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ParcelaPaga,
  Projecao,
} from '@/lib/finance/meu-financiamento/model';
import { economiaAmortizacoes } from '@/lib/finance/meu-financiamento/economia';
import { limiarUmaParcela } from '@/lib/finance/meu-financiamento/sugestao';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

const CHIPS = [
  { valor: 500, label: 'R$ 500' },
  { valor: 1000, label: 'R$ 1.000' },
  { valor: 2000, label: 'R$ 2.000' },
];

interface ChipSugestao {
  valor: number;
  label: string;
  /** Parcelas eliminadas do prazo (0 quando o aporte não encurta). */
  parcelas: number;
  economia: number;
}

/**
 * Sugestão de amortização junto com a parcela: o menor aporte com efeito no
 * prazo (limiar) e atalhos de R$ 500/1.000/2.000 com o efeito calculado pelo
 * modelo. "Aplicar" (ou o próprio chip) abre o pagamento inline já preenchido
 * com parcela + aporte no modo "Reduziu o prazo".
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
  const { limiar, chips } = useMemo(() => {
    const baseQuita = atual.quitaEm;
    const chipsVisiveis: ChipSugestao[] = CHIPS.filter((chip) => chip.valor <= atual.saldoEfetivo).map(
      (chip) => {
        const aporte: AmortizacaoExtra = {
          dataPagamento: hoje,
          valor: chip.valor,
          origem: 'proprio',
          modo: 'term',
        };
        const comAporte = projecao(params, baseline, pagas, [...extras, aporte]);
        const parcelas = baseQuita == null
          ? 0
          : comAporte.saldoEfetivo === 0
            ? baseQuita - atual.primeiraPendente + 1
            : comAporte.quitaEm == null
              ? 0
              : baseQuita - comAporte.quitaEm;
        return {
          valor: chip.valor,
          label: chip.label,
          parcelas,
          economia: economiaAmortizacoes(params, baseline, pagas, [...extras, aporte]),
        };
      },
    );
    return { limiar: limiarUmaParcela(params, baseline, pagas, extras), chips: chipsVisiveis };
  }, [params, baseline, pagas, extras, atual, hoje]);

  return (
    <div
      data-sugestao-amortizacao
      className="flex flex-col gap-3 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-3"
    >
      <p className="text-sm font-medium">Quer amortizar junto?</p>
      <p className="text-sm text-muted-foreground">
        {limiar != null ? (
          <>
            + <span className="font-mono font-semibold tabular-nums text-foreground">{formatBRL(limiar)}</span> e
            quita 1 parcela antes
          </>
        ) : (
          'Sem efeito no prazo neste cenário'
        )}
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <div
              key={chip.valor}
              data-aporte={chip.valor}
              className="flex min-w-44 flex-col gap-2 rounded-xl border border-border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => onAplicar(chip.valor)}
                className="w-fit rounded-full border border-[#820AD1]/40 px-3 py-1 text-sm font-medium text-[#820AD1] transition-colors hover:bg-[#820AD1]/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {chip.label}
              </button>
              <p className="text-xs text-muted-foreground">
                {chip.parcelas > 0
                  ? `quita ${chip.parcelas} ${chip.parcelas === 1 ? 'parcela' : 'parcelas'} antes · economiza ${formatBRL(chip.economia)}`
                  : `não encurta o prazo · economiza ${formatBRL(chip.economia)}`}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => onAplicar(chip.valor)}>
                Aplicar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
