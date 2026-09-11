import { simulate } from '../engine';
import { projecao, toLoanInput } from './model';
import type { AmortizacaoExtra, ParcelaPaga } from './model';
import { cenarioAporte, type EstadoCenarioAporte } from './aporte-cenario';
import { economiaDoAporte, limiarParcelaEngine } from './economia';
import { limiarUmaParcela } from './sugestao';
import { formatBRL } from '@/lib/utils';

export type OpcaoId = 'ideal' | 'meia' | 'extra';

export interface OpcaoSugestao {
  id: OpcaoId;
  titulo: string;
  /** Sufixo do aria-label "Aplicar/Usar ..." (labels E2E estáveis). */
  aria: string;
  aporte: number;
  /** Economia total (métrica do E se?) da ação completa: parcela + aporte. */
  economia: number;
  /** Efeito no prazo: "elimina N parcela(s)" (ideal com o valor da última) ou "não reduz o prazo". */
  efeito?: string;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Opções de aporte junto com a parcela do mês: ideal calculado (menor aporte
 * que corta 1 parcela na tela E no painel "E se?"), meia parcela e parcela
 * extra, cada um com a economia do MESMO helper do E se? (`economiaDoAporte`).
 * Compartilhado pelo card de sugestão e pelos atalhos do modal de pagamento.
 */
export function opcoesSugestao(estado: EstadoCenarioAporte, hoje: string): OpcaoSugestao[] {
  const { params, baseline, pagas, extras, projecao: atual } = estado;
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
  // Cenário compartilhado com o preview dos formulários (mesmo desvio de
  // arredondamento): evita o card dizer "elimina N" e o preview "não reduz".
  const estadoCenario: EstadoCenarioAporte = { params, baseline, pagas, extras, projecao: atual };

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
    const corta = (valor: number): boolean => modeloCorta(valor) && engineCorta(valor);
    // Menor centavo que corta nas duas camadas (model e engine).
    let minimo = Math.ceil(Math.max(limiarModelo, limiarEngine) * 100) / 100;
    for (let tentativa = 0; tentativa < 20 && !corta(minimo); tentativa += 1) {
      minimo = roundCents(minimo + 0.01);
    }
    if (corta(minimo)) {
      // Folga de R$ 1,00: o ideal exibido/aplicado ainda precisa cortar 1 real
      // abaixo, absorvendo divergências de arredondamento/estado entre o
      // cliente e o servidor. Sem folga encontrada, cai no mínimo validado.
      let comFolga = minimo;
      for (
        let tentativa = 0;
        tentativa < 200 && !(corta(comFolga) && corta(roundCents(comFolga - 1)));
        tentativa += 1
      ) {
        comFolga = roundCents(comFolga + 0.01);
      }
      const idealValor = corta(comFolga) && corta(roundCents(comFolga - 1)) ? comFolga : minimo;
      ideal = idealValor;
      // Efeito exibido no cenário ATUAL (sem a parcela do mês): quantas
      // parcelas o aporte elimina da projeção vigente e o valor da última
      // parcela que deixa de existir. Mesma conta do preview dos forms.
      const eliminadas = Math.max(1, cenarioAporte(estadoCenario, idealValor, 'term')?.parcelasEliminadas ?? 1);
      const valorUltima = atual.parcelas.at(-1)?.parcela;
      idealEfeito = `elimina ${eliminadas} ${eliminadas === 1 ? 'parcela' : 'parcelas'}${
        valorUltima != null ? ` (${formatBRL(valorUltima)})` : ''
      }`;
    }
  }

  // Efeito no prazo das opções meia/extra pelo mesmo cenário do preview
  // (zero vira "não reduz o prazo": amortização pequena pode não cortar).
  const efeitoPrazo = (aporte: number): string => {
    const eliminadas = cenarioAporte(estadoCenario, aporte, 'term')?.parcelasEliminadas ?? 0;
    return eliminadas > 0
      ? `elimina ${eliminadas} ${eliminadas === 1 ? 'parcela' : 'parcelas'}`
      : 'não reduz o prazo';
  };

  const candidatas: Omit<OpcaoSugestao, 'economia'>[] = [];
  if (ideal != null) {
    candidatas.push({ id: 'ideal', titulo: 'Ideal calculado', aria: 'ideal', aporte: ideal, efeito: idealEfeito });
  }
  const meia = roundCents(primeira.parcela * 0.5);
  const extra = roundCents(primeira.parcela);
  candidatas.push({
    id: 'meia',
    titulo: 'Meia parcela',
    aria: 'meia parcela',
    aporte: meia,
    efeito: efeitoPrazo(meia),
  });
  candidatas.push({
    id: 'extra',
    titulo: 'Parcela extra',
    aria: 'parcela extra',
    aporte: extra,
    efeito: efeitoPrazo(extra),
  });
  return candidatas.map((candidata) => ({
    ...candidata,
    economia: economiaDoAporte(input, candidata.aporte, 'term'),
  }));
}
