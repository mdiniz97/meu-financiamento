'use client';

import { useMemo } from 'react';
import { simulate } from '@/lib/finance/engine';
import { projecao, toLoanInput } from '@/lib/finance/meu-financiamento/model';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ParcelaPaga,
  Projecao,
} from '@/lib/finance/meu-financiamento/model';
import { economiaDoAporte } from '@/lib/finance/meu-financiamento/economia';
import { formatBRL } from '@/lib/utils';

/** Estado vigente do contrato necessário para simular o efeito de um aporte. */
export interface EstadoProjecao {
  params: ContractParams;
  baseline: Baseline;
  pagas: ParcelaPaga[];
  extras: AmortizacaoExtra[];
  projecao: Projecao;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function textoParcelas(n: number): string {
  return `${n} ${n === 1 ? 'parcela' : 'parcelas'}`;
}

/**
 * Preview do efeito de um aporte no estado vigente: economia total na métrica
 * do painel "E se?" (`economiaDoAporte`) e, no modo "Reduziu o prazo", quantas
 * parcelas a projeção do estado perde (`projecao` com o aporte term). No modo
 * "Reduziu a parcela" o prazo não muda; mostra a parcela estimada quando pedida
 * e menor que a parcela atual.
 */
export function EfeitoAporte({
  estado,
  aporte,
  modo,
  caption,
  mostrarParcelaEstimada = false,
}: {
  estado: EstadoProjecao;
  aporte: number;
  modo: 'term' | 'payment';
  /** Texto auxiliar do modo payment; ausente não renderiza caption. */
  caption?: string;
  /** No modo payment, exibe a parcela estimada quando a engine a reduz. */
  mostrarParcelaEstimada?: boolean;
}) {
  const { params, baseline, pagas, extras, projecao: atual } = estado;
  const efeito = useMemo(() => {
    if (!Number.isFinite(aporte) || aporte <= 0) return null;
    if (atual.saldoEfetivo <= 0) return null;
    const meses = params.parcelasTotais - atual.primeiraPendente + 1;
    if (meses < 1) return null;
    const input = { ...toLoanInput(params, baseline), principal: atual.saldoEfetivo, months: meses };
    const economia = economiaDoAporte(input, aporte, modo);
    if (modo === 'payment') {
      let parcelaEstimada: number | null = null;
      if (mostrarParcelaEstimada) {
        try {
          const cenario = simulate(input, {
            extraLumpSum: [{ month: 1, amount: aporte, reduceMode: 'payment' }],
            reduceMode: 'payment',
          });
          const proxima = cenario.installments[1]?.parcela ?? cenario.installments[0]?.parcela ?? null;
          const atualParcela = atual.parcelas[0]?.parcela ?? null;
          parcelaEstimada =
            proxima != null && atualParcela != null && proxima < atualParcela - 0.005
              ? roundCents(proxima)
              : null;
        } catch {
          parcelaEstimada = null;
        }
      }
      return { economia, parcelas: 0, parcelaEstimada };
    }
    const comAporte = projecao(params, baseline, pagas, [
      ...extras,
      { dataPagamento: baseline.dataBase, valor: aporte, origem: 'proprio', modo: 'term' },
    ]);
    return {
      economia,
      parcelas: Math.max(0, atual.parcelas.length - comAporte.parcelas.length),
      parcelaEstimada: null,
    };
  }, [params, baseline, pagas, extras, atual, aporte, modo, mostrarParcelaEstimada]);

  if (!efeito) return null;

  return (
    <div data-efeito-aporte className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/40 p-3 text-xs">
      <p
        className={`font-medium tabular-nums ${
          efeito.economia > 0 ? 'text-[#820AD1]' : 'text-muted-foreground'
        }`}
      >
        {efeito.economia > 0
          ? `Economia total de ${formatBRL(efeito.economia)}`
          : 'sem economia no modelo'}
      </p>
      {modo === 'payment' ? (
        <>
          <p className="text-muted-foreground">não reduz o prazo</p>
          {efeito.parcelaEstimada != null && (
            <p className="min-w-0 break-words text-muted-foreground">
              Parcela estimada:{' '}
              <span className="font-mono tabular-nums">{formatBRL(efeito.parcelaEstimada)}</span>
            </p>
          )}
          {caption && <p className="text-muted-foreground">{caption}</p>}
        </>
      ) : efeito.parcelas > 0 ? (
        <p className="text-muted-foreground">{`elimina ${textoParcelas(efeito.parcelas)}`}</p>
      ) : (
        <p className="text-muted-foreground">não reduz o prazo</p>
      )}
    </div>
  );
}
