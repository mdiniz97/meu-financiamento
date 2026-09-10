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
    // O fluxo real paga a parcela do mês JUNTO com o aporte. A sugestão é
    // calculada com essa parcela já quitada para o "quita 1 parcela antes" e o
    // "corta k parcelas" valerem para a ação completa, não só para o aporte
    // isolado (o limiar de centavo muda quando a parcela também é paga).
    const primeira = atual.parcelas[0];
    const pagasComParcela: ParcelaPaga[] = primeira
      ? [...pagas, { parcelaNumero: primeira.parcelaNumero, valor: primeira.parcela, dataPagamento: hoje }]
      : pagas;
    const semAporte = projecao(params, baseline, pagasComParcela, extras);
    const baseQuita = semAporte.quitaEm;
    const chipsVisiveis: ChipSugestao[] = CHIPS.filter((chip) => chip.valor <= atual.saldoEfetivo).map(
      (chip) => {
        const aporte: AmortizacaoExtra = {
          dataPagamento: hoje,
          valor: chip.valor,
          origem: 'proprio',
          modo: 'term',
        };
        const comAporte = projecao(params, baseline, pagasComParcela, [...extras, aporte]);
        const parcelas = baseQuita == null
          ? 0
          : comAporte.saldoEfetivo === 0
            ? baseQuita - semAporte.primeiraPendente + 1
            : comAporte.quitaEm == null
              ? 0
              : baseQuita - comAporte.quitaEm;
        return {
          valor: chip.valor,
          label: chip.label,
          parcelas,
          // Economia MARGINAL do aporte: a diferença desconta a economia já
          // atribuída aos extras existentes (senão o chip roubaria para si a
          // economia de amortizações antigas).
          economia: economiaAmortizacoes(params, baseline, pagasComParcela, [...extras, aporte])
            - economiaAmortizacoes(params, baseline, pagasComParcela, extras),
        };
      },
    );
    return { limiar: limiarUmaParcela(params, baseline, pagasComParcela, extras), chips: chipsVisiveis };
  }, [params, baseline, pagas, extras, atual, hoje]);

  return (
    <div
      data-sugestao-amortizacao
      className="flex flex-col gap-3 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-3"
    >
      <p className="text-sm font-medium">Quer amortizar junto?</p>
      {limiar != null ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            + <span className="font-mono font-semibold tabular-nums text-foreground">{formatBRL(limiar)}</span> e
            quita 1 parcela antes
          </p>
          <Button type="button" size="sm" onClick={() => onAplicar(limiar)}>
            Aplicar {formatBRL(limiar)}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem efeito no prazo neste cenário</p>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <div
              key={chip.valor}
              data-aporte={chip.valor}
              className={`flex min-w-44 flex-col gap-2 rounded-xl border bg-card p-3 ${
                chip.parcelas > 0
                  ? 'border-[#820AD1]/50 ring-1 ring-[#820AD1]/20'
                  : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => onAplicar(chip.valor)}
                className="w-fit rounded-full border border-[#820AD1]/40 px-3 py-1 text-sm font-medium text-[#820AD1] transition-colors hover:bg-[#820AD1]/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {chip.label}
              </button>
              <p className={`text-xs ${chip.parcelas > 0 ? 'font-medium text-[#820AD1]' : 'text-muted-foreground'}`}>
                {chip.parcelas > 0
                  ? `corta ${chip.parcelas} ${chip.parcelas === 1 ? 'parcela' : 'parcelas'} · evita ${formatBRL(chip.economia)} em juros e encargos`
                  : `abate ${formatBRL(chip.valor)} do saldo · evita ${formatBRL(chip.economia)} em juros e encargos`}
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
