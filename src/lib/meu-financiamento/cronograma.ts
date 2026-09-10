import { addMonthsISO } from './dates';
import type { Baseline, Projecao } from '@/lib/finance/meu-financiamento/model';
import type { AmortizacaoComId, ParcelaPagaComId } from './repo';

export interface CronogramaParcela {
  kind: 'parcela';
  numero: number;
  /** Vencimento estimado pela data-base vigente ('YYYY-MM-DD'). */
  vencimento: string;
  /** Valor real (paga) ou projetado (em aberto). */
  valor: number;
  paga: { dataPagamento: string } | null;
}

export interface CronogramaAmortizacao {
  kind: 'amortizacao';
  id: string;
  valor: number;
  dataPagamento: string;
  origem: 'proprio' | 'fgts';
  modo: 'term' | 'payment';
}

export type CronogramaLinha = CronogramaParcela | CronogramaAmortizacao;

interface Ordenavel {
  ordem: number;
  rank: number;
  data: string;
  indice: number;
  linha: CronogramaLinha;
}

/**
 * Cronograma completo a partir do estado vigente: parcelas projetadas
 * (projecao.parcelas, que já começam na primeira pendente) + parcelas pagas de
 * TODO o histórico (valor real e data) + amortizações extras do histórico,
 * intercaladas após a última parcela cujo vencimento estimado é ≤ a data do
 * aporte. Ordem final por número de parcela ascendente; empate de posição
 * resolve pela data do lançamento.
 */
export function buildCronograma(
  baseline: Pick<Baseline, 'dataBase' | 'proximaParcelaNumero'>,
  projecao: Pick<Projecao, 'parcelas'>,
  historico: { pagas: ParcelaPagaComId[]; extras: AmortizacaoComId[] },
): CronogramaLinha[] {
  const vencimento = (numero: number) =>
    addMonthsISO(baseline.dataBase, numero - baseline.proximaParcelaNumero);
  const pagasPorNumero = new Map(historico.pagas.map((p) => [p.parcelaNumero, p]));
  const projetadasPorNumero = new Map(projecao.parcelas.map((p) => [p.parcelaNumero, p]));
  const numeros = new Set<number>([
    ...projecao.parcelas.map((p) => p.parcelaNumero),
    ...historico.pagas.map((p) => p.parcelaNumero),
  ]);

  const ordenaveis: Ordenavel[] = [...numeros]
    .sort((a, b) => a - b)
    .map((numero) => {
      const paga = pagasPorNumero.get(numero);
      return {
        ordem: numero,
        rank: 0,
        data: '',
        indice: 0,
        linha: {
          kind: 'parcela',
          numero,
          vencimento: vencimento(numero),
          valor: paga?.valor ?? projetadasPorNumero.get(numero)?.parcela ?? 0,
          paga: paga ? { dataPagamento: paga.dataPagamento } : null,
        },
      };
    });
  const menorNumero = ordenaveis.length > 0 ? ordenaveis[0].ordem : 1;
  historico.extras.forEach((extra, indice) => {
    let apos: number | null = null;
    for (const ordenavel of ordenaveis) {
      if (ordenavel.linha.kind === 'parcela' && ordenavel.linha.vencimento <= extra.dataPagamento) {
        apos = ordenavel.linha.numero;
      }
    }
    ordenaveis.push({
      ordem: apos ?? menorNumero - 1,
      rank: 1,
      data: extra.dataPagamento,
      indice,
      linha: {
        kind: 'amortizacao',
        id: extra.id,
        valor: extra.valor,
        dataPagamento: extra.dataPagamento,
        origem: extra.origem,
        modo: extra.modo,
      },
    });
  });

  ordenaveis.sort((a, b) =>
    (a.ordem - b.ordem)
    || (a.rank - b.rank)
    || a.data.localeCompare(b.data)
    || (a.indice - b.indice),
  );
  return ordenaveis.map((o) => o.linha);
}
