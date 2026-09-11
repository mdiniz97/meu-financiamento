'use client';

import { useMemo } from 'react';
import { cenarioAporte, type EstadoCenarioAporte } from '@/lib/finance/meu-financiamento/aporte-cenario';
import { formatBRL } from '@/lib/utils';

export type EstadoProjecao = EstadoCenarioAporte;

function textoParcelas(n: number): string {
  return `${n} ${n === 1 ? 'parcela' : 'parcelas'}`;
}

/**
 * Preview do efeito de um aporte no estado vigente: economia total na métrica
 * do painel "E se?" e, no modo "Reduziu o prazo", quantas parcelas a projeção
 * perde. No modo "Reduziu a parcela" o prazo não muda; mostra a parcela
 * estimada quando pedida e menor que a parcela atual. Os números vêm do mesmo
 * helper `cenarioAporte` do card de sugestão.
 */
export function EfeitoAporte({
  estado,
  aporte,
  modo,
  mostrarParcelaEstimada = false,
}: {
  estado: EstadoProjecao;
  aporte: number;
  modo: 'term' | 'payment';
  /** No modo payment, exibe a parcela estimada quando a engine a reduz. */
  mostrarParcelaEstimada?: boolean;
}) {
  const { params, baseline, pagas, extras, projecao } = estado;
  const efeito = useMemo(
    () =>
      cenarioAporte({ params, baseline, pagas, extras, projecao }, aporte, modo, {
        parcelaEstimada: mostrarParcelaEstimada,
      }),
    [params, baseline, pagas, extras, projecao, aporte, modo, mostrarParcelaEstimada],
  );

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
        </>
      ) : efeito.parcelasEliminadas > 0 ? (
        <p className="text-muted-foreground">{`elimina ${textoParcelas(efeito.parcelasEliminadas)}`}</p>
      ) : (
        <p className="text-muted-foreground">não reduz o prazo</p>
      )}
    </div>
  );
}
