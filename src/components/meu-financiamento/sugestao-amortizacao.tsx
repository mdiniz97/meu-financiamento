'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { simulate } from '@/lib/finance/engine';
import { projecao, toLoanInput } from '@/lib/finance/meu-financiamento/model';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ParcelaPaga,
  Projecao,
} from '@/lib/finance/meu-financiamento/model';
import { limiarUmaParcela } from '@/lib/finance/meu-financiamento/sugestao';
import { economiaDoAporte, limiarParcelaEngine } from '@/lib/finance/meu-financiamento/economia';
import { todayISO } from '@/lib/meu-financiamento/dates';
import { formatBRL } from '@/lib/utils';

type OpcaoId = 'ideal' | 'meia' | 'extra';

interface Opcao {
  id: OpcaoId;
  titulo: string;
  /** Sufixo do aria-label "Aplicar ..." (labels E2E estáveis). */
  aria: string;
  aporte: number;
  /** Economia total (métrica do E se?) da ação completa: parcela + aporte. */
  economia: number;
  /** Efeito no prazo (só o ideal): "elimina 1 parcela (R$ ...)". */
  efeito?: string;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sugestão de amortização junto com a parcela do mês: ideal calculado (menor
 * aporte que corta 1 parcela na tela E no painel "E se?"), meia parcela e
 * parcela extra, cada um com a economia total do MESMO helper do E se?
 * (`economiaDoAporte`). "Aplicar" abre o pagamento inline preenchido com o
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
    const meses = params.parcelasTotais - atual.primeiraPendente + 1;
    if (!primeira || atual.saldoEfetivo <= 0 || meses < 1) return [];

    // Posição vigente com a MESMA base do painel E se? (saldo efetivo e meses
    // restantes), para economia e limiar serem idênticos aos de lá.
    const input = {
      ...toLoanInput(params, baseline),
      principal: atual.saldoEfetivo,
      months: meses,
    };
    // O form aplica `roundCents(parcela) + aporte`; o extra efetivo no model
    // leva o desvio desse arredondamento.
    const desvio = roundCents(primeira.parcela) - primeira.parcela;
    const pagasComParcela: ParcelaPaga[] = [
      ...pagas,
      { parcelaNumero: primeira.parcelaNumero, valor: primeira.parcela, dataPagamento: hoje },
    ];
    const aporteModelo = (valor: number): AmortizacaoExtra => ({
      dataPagamento: hoje,
      valor: valor + desvio,
      origem: 'proprio',
      modo: 'term',
    });

    // Ideal: precisa cortar 1 parcela na TELA (model: parcela paga + aporte) e
    // no E se? (engine: aporte pontual). O maior dos dois limiares mínimos
    // satisfaz ambos por monotonicidade; valida e soma centavos se necessário.
    const limiarModelo = limiarUmaParcela(params, baseline, pagas, extras);
    const limiarEngine = limiarParcelaEngine(input);
    let ideal: number | null = null;
    let idealEfeito: string | undefined;
    if (limiarModelo != null && limiarEngine != null) {
      const baseModelo = projecao(params, baseline, pagasComParcela, extras).quitaEm;
      const baseEngineZero = simulate(input).metrics.saldoZeroAt;
      const modeloCorta = (valor: number): boolean => {
        if (baseModelo == null) return false;
        const comAporte = projecao(params, baseline, pagasComParcela, [...extras, aporteModelo(valor)]);
        if (comAporte.saldoEfetivo === 0) return true;
        return comAporte.quitaEm != null && comAporte.quitaEm <= baseModelo - 1;
      };
      const engineCorta = (valor: number): boolean =>
        simulate(input, {
          extraLumpSum: [{ month: 1, amount: valor, reduceMode: 'term' }],
          reduceMode: 'term',
        }).metrics.saldoZeroAt < baseEngineZero;
      let candidato = Math.ceil(Math.max(limiarModelo, limiarEngine) * 100) / 100;
      for (let tentativa = 0; tentativa < 20 && (!modeloCorta(candidato) || !engineCorta(candidato)); tentativa += 1) {
        candidato = roundCents(candidato + 0.01);
      }
      if (modeloCorta(candidato) && engineCorta(candidato)) {
        ideal = candidato;
        // Efeito exibido no cenário ATUAL (sem a parcela do mês): quantas
        // parcelas o aporte elimina da projeção vigente e o valor da última
        // parcela que deixa de existir.
        const comAporte = projecao(params, baseline, pagas, [...extras, aporteModelo(candidato)]);
        const eliminadas = Math.max(1, atual.parcelas.length - comAporte.parcelas.length);
        const valorUltima = atual.parcelas.at(-1)?.parcela;
        idealEfeito = `elimina ${eliminadas} ${eliminadas === 1 ? 'parcela' : 'parcelas'}${
          valorUltima != null ? ` (${formatBRL(valorUltima)})` : ''
        }`;
      }
    }

    const candidatas: Omit<Opcao, 'economia'>[] = [];
    if (ideal != null) {
      candidatas.push({ id: 'ideal', titulo: 'Ideal calculado', aria: 'ideal', aporte: ideal, efeito: idealEfeito });
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
    return candidatas.map((candidata) => ({
      ...candidata,
      economia: economiaDoAporte(input, candidata.aporte, 'term'),
    }));
  }, [params, baseline, pagas, extras, atual, hoje]);

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
                size="sm"
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
