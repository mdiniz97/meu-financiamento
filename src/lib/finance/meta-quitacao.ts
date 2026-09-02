export interface MetaQuitacaoInput {
  saldoDevedor: number;
  taxaFinanciamento: number;
  prazoRestanteMeses: number;
  sistema: 'PRICE' | 'SAC';
  metaMeses: number;
}

export interface MetaQuitacaoResult {
  parcelaAtual: number;
  pagamentoTotal: number;
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
  if (!(input.saldoDevedor > 0)) throw new Error('Saldo devedor deve ser maior que zero.');
  if (!(input.taxaFinanciamento >= 0)) throw new Error('Taxa do financiamento inválida.');
  if (!(input.prazoRestanteMeses >= 1 && input.prazoRestanteMeses <= 600))
    throw new Error('Prazo restante deve ficar entre 1 e 600 meses.');
  if (!(input.metaMeses >= 1 && input.metaMeses <= 600))
    throw new Error('Meta deve ficar entre 1 e 600 meses.');

  const i = monthlyRate(input.taxaFinanciamento);

  const parcelaAtual =
    input.sistema === 'SAC'
      ? input.saldoDevedor / input.prazoRestanteMeses + input.saldoDevedor * i
      : priceParcela(input.saldoDevedor, i, input.prazoRestanteMeses);
  const pagamentoTotal = priceParcela(input.saldoDevedor, i, input.metaMeses);
  const aporteMensal = pagamentoTotal - parcelaAtual;

  const jurosOriginais = parcelaAtual * input.prazoRestanteMeses - input.saldoDevedor;
  const jurosTotais = pagamentoTotal * input.metaMeses - input.saldoDevedor;

  return {
    parcelaAtual,
    pagamentoTotal,
    aporteMensal,
    jurosTotais,
    jurosOriginais,
    economiaJuros: jurosOriginais - jurosTotais,
    metaMaiorQuePrazo: input.metaMeses >= input.prazoRestanteMeses,
  };
}
