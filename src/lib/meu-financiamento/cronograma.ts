import { addMonthsISO } from './dates';
import type { Baseline, Projecao } from '@/lib/finance/meu-financiamento/model';
import type { AmortizacaoComId, ParcelaPagaComId } from './repo';

/** Composição da competência pelo encadeamento do baseline vigente. */
export interface CronogramaComposicao {
  juros: number;
  correcao: number;
  seguro: number;
  amortizacao: number;
  saldo: number;
}

export type CronogramaSituacao = 'paga' | 'aberta' | 'historico';

export interface CronogramaParcela {
  kind: 'parcela';
  numero: number;
  /** Vencimento estimado pela data-base vigente ('YYYY-MM-DD'). */
  vencimento: string;
  /** Valor real (paga) ou projetado (em aberto). */
  valor: number;
  paga: { dataPagamento: string } | null;
  /** Paga no baseline vigente, em aberto ou paga de um período anterior. */
  situacao: CronogramaSituacao;
  /** Decomposição do encadeamento do estado vigente; null nas pagas de
   *  períodos anteriores (o modelo não as reconstrói) e nas linhas sem dados. */
  composicao: CronogramaComposicao | null;
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
  baseline: Pick<Baseline, 'dataBase' | 'proximaParcelaNumero' | 'diaVencimento'>,
  projecao: Pick<Projecao, 'parcelas' | 'pagas'>,
  historico: { pagas: ParcelaPagaComId[]; extras: AmortizacaoComId[] },
): CronogramaLinha[] {
  const vencimento = (numero: number) =>
    addMonthsISO(baseline.dataBase, numero - baseline.proximaParcelaNumero, baseline.diaVencimento);
  const pagasPorNumero = new Map(historico.pagas.map((p) => [p.parcelaNumero, p]));
  const projetadasPorNumero = new Map(projecao.parcelas.map((p) => [p.parcelaNumero, p]));
  const detalhesPorNumero = new Map(projecao.pagas.map((p) => [p.parcelaNumero, p]));
  const numeros = new Set<number>([
    ...projecao.parcelas.map((p) => p.parcelaNumero),
    ...historico.pagas.map((p) => p.parcelaNumero),
  ]);

  const ordenaveis: Ordenavel[] = [...numeros]
    .sort((a, b) => a - b)
    .map((numero) => {
      const paga = pagasPorNumero.get(numero);
      const projetada = projetadasPorNumero.get(numero);
      const detalhe = detalhesPorNumero.get(numero);
      const situacao: CronogramaSituacao = paga
        ? (detalhe ? 'paga' : 'historico')
        : 'aberta';
      const composicao: CronogramaComposicao | null = detalhe
        ? {
            juros: detalhe.juros,
            correcao: detalhe.correcao,
            seguro: detalhe.seguro,
            amortizacao: detalhe.amortizacao,
            saldo: detalhe.saldo,
          }
        : projetada
          ? {
              juros: projetada.juros,
              correcao: projetada.correcao,
              seguro: projetada.seguro,
              amortizacao: projetada.amortizacao,
              saldo: projetada.saldo,
            }
          : null;
      return {
        ordem: numero,
        rank: 0,
        data: '',
        indice: 0,
        linha: {
          kind: 'parcela',
          numero,
          vencimento: vencimento(numero),
          valor: paga?.valor ?? projetada?.parcela ?? 0,
          paga: paga ? { dataPagamento: paga.dataPagamento } : null,
          situacao,
          composicao,
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
