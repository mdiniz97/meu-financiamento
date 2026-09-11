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
  /** Soma das amortizações extras do estado vigente que caem nesta competência
   *  (data do aporte até o vencimento estimado desta parcela). */
  aporte: number;
}

/**
 * Agrega o valor das amortizações extras do estado vigente por parcela: cada
 * extra entra na PRIMEIRA parcela cujo vencimento estimado é >= a data do
 * aporte. Extras anteriores à primeira parcela caem nela; extras entre duas
 * competências caem na seguinte. `parcelas` deve estar ordenada por vencimento
 * ascendente (é a ordem natural do cronograma por número). Extras posteriores
 * ao vencimento da última parcela caem nela, defensivamente, porque as actions
 * rejeitam data futura e o cronograma cobre todas as competências.
 *
 * Extras de períodos anteriores ficam de fora: já foram absorvidos pelo saldo
 * do baseline vigente e reaplicá-los duplicaria a amortização.
 */
export function agregarAportes(
  parcelas: readonly { numero: number; vencimento: string }[],
  extras: readonly { dataPagamento: string; valor: number }[],
): Map<number, number> {
  const porNumero = new Map<number, number>();
  if (parcelas.length === 0) return porNumero;
  for (const extra of extras) {
    const alvo = parcelas.find((p) => p.vencimento >= extra.dataPagamento) ?? parcelas[parcelas.length - 1];
    porNumero.set(alvo.numero, (porNumero.get(alvo.numero) ?? 0) + extra.valor);
  }
  return porNumero;
}

/**
 * Cronograma completo a partir do estado vigente: parcelas projetadas
 * (projecao.parcelas, que já começam na primeira pendente) + parcelas pagas de
 * TODO o histórico (valor real e data), ordenadas por número de parcela
 * ascendente. As amortizações extras do estado vigente entram na coluna
 * `aporte` da linha da competência correspondente (ver `agregarAportes`); as
 * extras de baselines superados já estão incorporadas no saldo vigente e não
 * aparecem como linha.
 */
export function buildCronograma(
  baseline: Pick<Baseline, 'dataBase' | 'proximaParcelaNumero' | 'diaVencimento'>,
  projecao: Pick<Projecao, 'parcelas' | 'pagas'>,
  historico: { pagas: ParcelaPagaComId[] },
  extras: readonly AmortizacaoComId[] = [],
): CronogramaParcela[] {
  const vencimento = (numero: number) =>
    addMonthsISO(baseline.dataBase, numero - baseline.proximaParcelaNumero, baseline.diaVencimento);
  const pagasPorNumero = new Map(historico.pagas.map((p) => [p.parcelaNumero, p]));
  const projetadasPorNumero = new Map(projecao.parcelas.map((p) => [p.parcelaNumero, p]));
  const detalhesPorNumero = new Map(projecao.pagas.map((p) => [p.parcelaNumero, p]));
  const numeros = new Set<number>([
    ...projecao.parcelas.map((p) => p.parcelaNumero),
    ...historico.pagas.map((p) => p.parcelaNumero),
  ]);

  const linhas: CronogramaParcela[] = [...numeros]
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
        kind: 'parcela',
        numero,
        vencimento: vencimento(numero),
        valor: paga?.valor ?? projetada?.parcela ?? 0,
        paga: paga ? { dataPagamento: paga.dataPagamento } : null,
        situacao,
        composicao,
        aporte: 0,
      };
    });

  const aportes = agregarAportes(linhas, extras);
  return linhas.map((linha) => ({ ...linha, aporte: aportes.get(linha.numero) ?? 0 }));
}
