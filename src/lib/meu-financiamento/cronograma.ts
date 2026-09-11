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
   *  (após o pagamento desta parcela e até o pagamento da próxima, ou no
   *  vencimento em aberto quando não há paga anterior). */
  aporte: number;
}

/**
 * Distribui cada amortização extra do estado vigente para a linha-alvo (mesma
 * regra do `agregarAportes`) preservando o vínculo com o lançamento, para a UI
 * poder oferecer Editar/Apagar por aporte. Cada extra entra na linha da ÚLTIMA
 * parcela PAGA cuja `dataPagamento` é <= a data do aporte; sem paga até a data,
 * cai na PRIMEIRA parcela em aberto; sem aberta, na última linha (defensivo).
 */
export function distribuirAportes<T extends { dataPagamento: string; valor: number }>(
  parcelas: readonly { numero: number; paga: { dataPagamento: string } | null }[],
  extras: readonly T[],
): Map<number, T[]> {
  const porNumero = new Map<number, T[]>();
  if (parcelas.length === 0) return porNumero;
  const pagas: { numero: number; dataPagamento: string }[] = [];
  const abertas: number[] = [];
  for (const p of parcelas) {
    if (p.paga) pagas.push({ numero: p.numero, dataPagamento: p.paga.dataPagamento });
    else abertas.push(p.numero);
  }
  const primeiraAberta = abertas[0] ?? parcelas[parcelas.length - 1].numero;
  for (const extra of extras) {
    let alvo: { numero: number; dataPagamento: string } | null = null;
    for (const p of pagas) {
      if (p.dataPagamento <= extra.dataPagamento && (alvo == null || p.dataPagamento >= alvo.dataPagamento)) {
        alvo = p;
      }
    }
    const numero = alvo?.numero ?? primeiraAberta;
    const lista = porNumero.get(numero) ?? [];
    lista.push(extra);
    porNumero.set(numero, lista);
  }
  return porNumero;
}

/**
 * Agrega o valor das amortizações extras do estado vigente por parcela (soma do
 * `distribuirAportes`). Mantido para os totais exibidos na coluna Aporte.
 */
export function agregarAportes(
  parcelas: readonly { numero: number; vencimento: string; paga: { dataPagamento: string } | null }[],
  extras: readonly { dataPagamento: string; valor: number }[],
): Map<number, number> {
  const porNumero = new Map<number, number>();
  for (const [numero, lista] of distribuirAportes(parcelas, extras)) {
    porNumero.set(numero, lista.reduce((soma, extra) => soma + extra.valor, 0));
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
