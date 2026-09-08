export interface InvestInput {
  saldoDevedor: number;
  prazoRestanteMeses: number;
  taxaFinanciamento: number;
  valorDisponivel: number;
  selicAnual: number;
  /** @deprecated Mantido para consumidores existentes; a comparacao vai ate quitar. */
  horizonteMeses: number;
  sistema: 'PRICE' | 'SAC';
}

export type CenarioId = 'reduzir-parcela' | 'reduzir-prazo' | 'investir-rendimento';

export interface EstrategiaResult {
  id: CenarioId;
  parcela: number | null;
  quitaEmMeses: number | null;
  jurosTotais: number;
  economiaJuros: number;
  mantemPrincipal: boolean;
}

export interface InvestResult {
  parcelaOriginal: number;
  jurosTotaisOriginal: number;
  estrategias: Record<CenarioId, EstrategiaResult>;
  melhorEconomia: CenarioId;
}

export interface PlantaInvestInput {
  entrada: number;
  mesesAteEntrega: number;
  custoJurosDeObra: number;
  selicAnual: number;
}

export interface PlantaInvestResult {
  entradaFinal: number;
  rendimentoBruto: number;
  imposto: number;
  rendimentoLiquido: number;
  coberturaPct: number;
  veredito: 'investir' | 'comprar';
}

function irRateForMonths(months: number): number {
  if (months <= 6) return 0.225;
  if (months <= 12) return 0.2;
  if (months <= 24) return 0.175;
  return 0.15;
}

function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

function priceParcela(saldo: number, taxaMensal: number, meses: number): number {
  if (taxaMensal === 0) return saldo / meses;
  return (saldo * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -meses));
}

interface SimOutcome {
  quitaEmMeses: number | null;
  jurosTotais: number;
}

/** Simula o saldo até quitar (ou até o teto de meses), somando os juros pagos. */
function simulateUntilPaid(
  saldoInicial: number,
  taxaMensal: number,
  parcela: number,
  amortizacaoSac?: number,
  extraAmortizacaoPorMes?: (m: number) => number
): SimOutcome {
  if (saldoInicial === 0) return { quitaEmMeses: 0, jurosTotais: 0 };
  // Tolerancia relativa, limitada a meio centavo, sem apagar parcelas de saldos pequenos.
  const tolerancia = Math.min(0.005, saldoInicial * 1e-10);
  let saldo = saldoInicial;
  let juros = 0;
  let quita: number | null = null;
  for (let m = 1; m <= 600; m += 1) {
    const jurosMes = saldo * taxaMensal;
    juros += jurosMes;
    const amortizacao = amortizacaoSac ?? parcela - jurosMes;
    saldo -= amortizacao + (extraAmortizacaoPorMes?.(m) ?? 0);
    if (saldo <= tolerancia) {
      quita = m;
      break;
    }
  }
  return { quitaEmMeses: quita, jurosTotais: juros };
}

export function calcularInvestOuAmortizar(input: InvestInput): InvestResult {
  if (!Number.isFinite(input.saldoDevedor) || !(input.saldoDevedor > 0))
    throw new Error('Saldo devedor deve ser maior que zero.');
  if (!Number.isSafeInteger(input.prazoRestanteMeses) || !(input.prazoRestanteMeses >= 1 && input.prazoRestanteMeses <= 600))
    throw new Error('Prazo restante deve ser inteiro entre 1 e 600 meses.');
  if (!Number.isFinite(input.valorDisponivel) || !(input.valorDisponivel > 0 && input.valorDisponivel <= input.saldoDevedor))
    throw new Error('Valor disponível deve ser maior que zero e não superar o saldo.');
  if (!Number.isFinite(input.taxaFinanciamento) || !(input.taxaFinanciamento >= 0))
    throw new Error('Taxa do financiamento inválida.');
  if (!Number.isFinite(input.selicAnual) || !(input.selicAnual >= 0))
    throw new Error('Taxa de investimento inválida.');
  if (!Number.isSafeInteger(input.horizonteMeses) || !(input.horizonteMeses >= 1 && input.horizonteMeses <= input.prazoRestanteMeses))
    throw new Error('Horizonte deve ser inteiro entre 1 e o prazo restante.');

  const tmSelic = monthlyRate(input.selicAnual);
  const tmFin = monthlyRate(input.taxaFinanciamento);
  const sac = input.sistema === 'SAC';
  const amortizacaoOriginal = input.saldoDevedor / input.prazoRestanteMeses;
  const amortizacaoAmortizar =
    (input.saldoDevedor - input.valorDisponivel) / input.prazoRestanteMeses;

  const parcelaOriginal = sac
    ? amortizacaoOriginal + input.saldoDevedor * tmFin
    : priceParcela(input.saldoDevedor, tmFin, input.prazoRestanteMeses);
  const parcelaReduzida = sac
    ? amortizacaoAmortizar + (input.saldoDevedor - input.valorDisponivel) * tmFin
    : priceParcela(
        input.saldoDevedor - input.valorDisponivel,
        tmFin,
        input.prazoRestanteMeses
      );

  const original = simulateUntilPaid(
    input.saldoDevedor,
    tmFin,
    parcelaOriginal,
    sac ? amortizacaoOriginal : undefined
  );

  // 1) Reduzir a parcela: parcela menor, prazo cheio.
  const reduzirParcela = simulateUntilPaid(
    input.saldoDevedor - input.valorDisponivel,
    tmFin,
    parcelaReduzida,
    sac ? amortizacaoAmortizar : undefined
  );

  // 2) SAC preserva a amortizacao original; PRICE preserva a prestacao original.
  const reduzirPrazo = simulateUntilPaid(
    input.saldoDevedor - input.valorDisponivel,
    tmFin,
    parcelaOriginal,
    sac ? amortizacaoOriginal : undefined
  );

  // 3) Investir e amortizar com o rendimento: principal fica investido e rendendo;
  //    todo mês o rendimento líquido (após IR) é usado para amortizar a dívida.
  const investirRendimento = simulateUntilPaid(
    input.saldoDevedor,
    tmFin,
    parcelaOriginal,
    sac ? amortizacaoOriginal : undefined,
    (m) => input.valorDisponivel * tmSelic * (1 - irRateForMonths(m))
  );

  const estrategias: Record<CenarioId, EstrategiaResult> = {
    'reduzir-parcela': {
      id: 'reduzir-parcela',
      parcela: parcelaReduzida,
      quitaEmMeses: reduzirParcela.quitaEmMeses,
      jurosTotais: reduzirParcela.jurosTotais,
      economiaJuros: original.jurosTotais - reduzirParcela.jurosTotais,
      mantemPrincipal: false,
    },
    'reduzir-prazo': {
      id: 'reduzir-prazo',
      parcela: null,
      quitaEmMeses: reduzirPrazo.quitaEmMeses,
      jurosTotais: reduzirPrazo.jurosTotais,
      economiaJuros: original.jurosTotais - reduzirPrazo.jurosTotais,
      mantemPrincipal: false,
    },
    'investir-rendimento': {
      id: 'investir-rendimento',
      parcela: null,
      quitaEmMeses: investirRendimento.quitaEmMeses,
      jurosTotais: investirRendimento.jurosTotais,
      economiaJuros: original.jurosTotais - investirRendimento.jurosTotais,
      mantemPrincipal: true,
    },
  };

  const melhorEconomia = (
    ['reduzir-parcela', 'reduzir-prazo', 'investir-rendimento'] as CenarioId[]
  ).reduce((best, id) =>
    estrategias[id].economiaJuros > estrategias[best].economiaJuros ? id : best
  );

  return {
    parcelaOriginal,
    jurosTotaisOriginal: original.jurosTotais,
    estrategias,
    melhorEconomia,
  };
}

export function compararPlantaOuInvestir(input: PlantaInvestInput): PlantaInvestResult {
  if (!(input.entrada > 0)) throw new Error('Entrada deve ser maior que zero.');
  if (!(input.mesesAteEntrega >= 1)) throw new Error('Prazo até a entrega inválido.');
  if (!(input.custoJurosDeObra >= 0)) throw new Error('Custo de juros de obra inválido.');
  if (!(input.selicAnual >= 0)) throw new Error('Taxa de investimento inválida.');

  const tmSelic = monthlyRate(input.selicAnual);
  const entradaFinal = input.entrada * Math.pow(1 + tmSelic, input.mesesAteEntrega);
  const rendimentoBruto = entradaFinal - input.entrada;
  const imposto = rendimentoBruto * irRateForMonths(input.mesesAteEntrega);
  const rendimentoLiquido = rendimentoBruto - imposto;
  const coberturaPct = (rendimentoLiquido / input.custoJurosDeObra) * 100;

  return {
    entradaFinal,
    rendimentoBruto,
    imposto,
    rendimentoLiquido,
    coberturaPct,
    veredito: rendimentoLiquido >= input.custoJurosDeObra ? 'investir' : 'comprar',
  };
}
