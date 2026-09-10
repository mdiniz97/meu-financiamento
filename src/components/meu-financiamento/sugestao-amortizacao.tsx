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
import { limiarUmaParcela } from '@/lib/finance/meu-financiamento/sugestao';
import { economiaAmortizacoes } from '@/lib/finance/meu-financiamento/economia';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

type OpcaoId = 'ideal' | 'meia' | 'extra';

interface Opcao {
  id: OpcaoId;
  titulo: string;
  /** Sufixo do aria-label "Aplicar ..." (labels E2E estáveis). */
  aria: string;
  aporte: number;
  /** Economia total (encargos evitados) da ação completa: parcela + aporte. */
  economia: number;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sugestão de amortização junto com a parcela do mês: ideal calculado (menor
 * aporte que corta 1 parcela), meia parcela e parcela extra, cada um com a
 * economia total (encargos evitados, mesma métrica do simulador) da ação real
 * (parcela + aporte). "Aplicar" abre o pagamento inline preenchido com o
 * aporte explícito no modo "Reduziu o prazo".
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
  const opcoes = useMemo(() => {
    const primeira = atual.parcelas[0];
    if (!primeira) return [];
    // O fluxo real paga a parcela do mês JUNTO com o aporte e o form aplica
    // `roundCents(parcela) + aporte`; o extra efetivo leva o desvio desse
    // arredondamento para o efeito exibido bater com o aplicado.
    const pagasComParcela: ParcelaPaga[] = [
      ...pagas,
      { parcelaNumero: primeira.parcelaNumero, valor: primeira.parcela, dataPagamento: hoje },
    ];
    const desvio = roundCents(primeira.parcela) - primeira.parcela;
    const economiaDoAporte = (aporte: number): number => {
      const aporteExtra: AmortizacaoExtra = {
        dataPagamento: hoje,
        valor: aporte + desvio,
        origem: 'proprio',
        modo: 'term',
      };
      // Economia MARGINAL da opção: desconta a economia já atribuída aos extras
      // existentes (senão a opção herdaria a economia de aportes antigos).
      return economiaAmortizacoes(params, baseline, pagasComParcela, [...extras, aporteExtra])
        - economiaAmortizacoes(params, baseline, pagasComParcela, extras);
    };

    const limiar = limiarUmaParcela(params, baseline, pagas, extras);
    const candidatas: Omit<Opcao, 'economia'>[] = [];
    if (limiar != null) {
      candidatas.push({ id: 'ideal', titulo: 'Ideal calculado', aria: 'ideal', aporte: limiar });
    }
    candidatas.push({
      id: 'meia',
      titulo: 'Meia parcela',
      aria: 'meia parcela',
      aporte: roundCents(primeira.parcela * 0.5),
    });
    candidatas.push({
      id: 'extra',
      titulo: 'Parcela extra',
      aria: 'parcela extra',
      aporte: roundCents(primeira.parcela),
    });
    return candidatas.map((candidata) => ({ ...candidata, economia: economiaDoAporte(candidata.aporte) }));
  }, [params, baseline, pagas, extras, atual, hoje]);

  return (
    <div
      data-sugestao-amortizacao
      className="flex flex-col gap-3 rounded-xl border border-[#820AD1]/30 bg-primary/[0.04] p-3"
    >
      <p className="text-sm font-medium">Quer amortizar junto?</p>
      {opcoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((opcao) => (
            <div
              key={opcao.id}
              data-opcao={opcao.id}
              className={`flex min-w-44 flex-col gap-2 rounded-xl border bg-card p-3 ${
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
              <Button
                type="button"
                variant={opcao.id === 'ideal' ? 'default' : 'outline'}
                size="sm"
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
