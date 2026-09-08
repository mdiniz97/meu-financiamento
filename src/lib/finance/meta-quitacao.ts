export interface MetaQuitacaoInput {
  saldoDevedor: number;
  taxaFinanciamento: number;
  prazoRestanteMeses: number;
  sistema: 'PRICE' | 'SAC';
  metaMeses: number;
}

export interface MetaQuitacaoResult {
  parcelaAtual: number;
  /** Primeira parcela com aporte no SAC; pagamento mensal constante no PRICE. */
  pagamentoTotal: number;
  /** Aporte extra fixo, alem da parcela de cada mes. */
  aporteMensal: number;
  jurosTotais: number;
  jurosOriginais: number;
  economiaJuros: number;
  metaMaiorQuePrazo: boolean;
}

function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

function priceParcela(saldo: number, taxaMensal: number, meses: number): number {
  if (taxaMensal === 0) return saldo / meses;
  return (saldo * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -meses));
}

export function calcularMetaQuitacao(input: MetaQuitacaoInput): MetaQuitacaoResult {
  if (!Number.isFinite(input.saldoDevedor) || !(input.saldoDevedor > 0))
    throw new Error('Saldo devedor deve ser maior que zero.');
  if (!Number.isFinite(input.taxaFinanciamento) || !(input.taxaFinanciamento >= 0))
    throw new Error('Taxa do financiamento inválida.');
  if (!Number.isSafeInteger(input.prazoRestanteMeses) || !(input.prazoRestanteMeses >= 1 && input.prazoRestanteMeses <= 600))
    throw new Error('Prazo restante deve ser inteiro entre 1 e 600 meses.');
  if (!Number.isSafeInteger(input.metaMeses) || !(input.metaMeses >= 1 && input.metaMeses <= 600))
    throw new Error('Meta deve ser inteira entre 1 e 600 meses.');

  const i = monthlyRate(input.taxaFinanciamento);
  const sac = input.sistema === 'SAC';
  const metaMaiorQuePrazo = input.metaMeses >= input.prazoRestanteMeses;
  const meses = Math.min(input.metaMeses, input.prazoRestanteMeses);

  const parcelaAtual = sac
    ? input.saldoDevedor / input.prazoRestanteMeses + input.saldoDevedor * i
    : priceParcela(input.saldoDevedor, i, input.prazoRestanteMeses);
  const aporteMensal = metaMaiorQuePrazo
    ? 0
    : sac
      ? input.saldoDevedor / meses - input.saldoDevedor / input.prazoRestanteMeses
      : priceParcela(input.saldoDevedor, i, meses) - parcelaAtual;
  const pagamentoTotal = parcelaAtual + aporteMensal;

  const jurosOriginais = i === 0
    ? 0
    : sac
      ? input.saldoDevedor * i * ((input.prazoRestanteMeses + 1) / 2)
      : parcelaAtual * input.prazoRestanteMeses - input.saldoDevedor;
  const jurosTotais = metaMaiorQuePrazo || i === 0
    ? jurosOriginais
    : sac
      ? input.saldoDevedor * i * ((meses + 1) / 2)
      : pagamentoTotal * meses - input.saldoDevedor;

  return {
    parcelaAtual,
    pagamentoTotal,
    aporteMensal,
    jurosTotais,
    jurosOriginais,
    economiaJuros: jurosOriginais - jurosTotais,
    metaMaiorQuePrazo,
  };
}
