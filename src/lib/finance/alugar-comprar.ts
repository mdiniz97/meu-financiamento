export interface AlugarComprarInput {
  imovelValor: number;
  entrada: number;
  aluguelMensal: number;
  taxaFinanciamento: number;
  selicAnual: number;
  valorizacaoAnual: number;
  prazoMeses: number;
  mesesFinanciamento: number;
}

export interface AlugarComprarMonth {
  month: number;
  patrimonioCompra: number;
  patrimonioAluguel: number;
}

export interface AlugarComprarResult {
  financiado: number;
  entrada: number;
  aluguelMensal: number;
  parcela: number;
  imovelFinal: number;
  patrimonioCompra: number;
  patrimonioAluguel: number;
  mesEmpate: number | null;
  monthly: AlugarComprarMonth[];
}

function monthlyRate(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

function priceParcela(saldo: number, taxaMensal: number, meses: number): number {
  if (taxaMensal === 0) return saldo / meses;
  return (saldo * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -meses));
}

export function calcularAlugarOuComprar(input: AlugarComprarInput): AlugarComprarResult {
  if (!(Number.isFinite(input.imovelValor) && input.imovelValor > 0)) throw new Error('Valor do imóvel deve ser maior que zero.');
  if (!(Number.isFinite(input.entrada) && input.entrada >= 0 && input.entrada < input.imovelValor))
    throw new Error('Entrada inválida.');
  if (!(Number.isFinite(input.aluguelMensal) && input.aluguelMensal > 0)) throw new Error('Aluguel deve ser maior que zero.');
  if (!(Number.isFinite(input.taxaFinanciamento) && input.taxaFinanciamento >= 0)) throw new Error('Taxa do financiamento inválida.');
  if (!(Number.isFinite(input.selicAnual) && input.selicAnual >= 0)) throw new Error('Taxa de investimento inválida.');
  if (!(Number.isFinite(input.valorizacaoAnual) && input.valorizacaoAnual > -1)) throw new Error('Taxa de valorização inválida.');
  if (!(Number.isInteger(input.prazoMeses) && input.prazoMeses >= 1 && input.prazoMeses <= 600))
    throw new Error('Horizonte deve ficar entre 1 e 600 meses.');
  if (!(Number.isInteger(input.mesesFinanciamento) && input.mesesFinanciamento >= 1 && input.mesesFinanciamento <= 600))
    throw new Error('Prazo do financiamento inválido.');
  if (input.prazoMeses > input.mesesFinanciamento)
    throw new Error('O horizonte não pode ultrapassar o prazo do financiamento neste modelo: a sobra após a quitação ainda não é comparada.');

  const iFin = monthlyRate(input.taxaFinanciamento);
  const iSelic = monthlyRate(input.selicAnual);
  const valorizMensal = Math.pow(1 + input.valorizacaoAnual, 1 / 12) - 1;

  const financiado = input.imovelValor - input.entrada;
  const parcela = priceParcela(financiado, iFin, input.mesesFinanciamento);
  if (input.aluguelMensal > parcela)
    throw new Error('O aluguel não pode superar a parcela neste modelo: a sobra mensal de quem compra ainda não é comparada.');

  let divida = financiado;
  let investidoAluguel = input.entrada;
  const monthly: AlugarComprarMonth[] = [];
  let mesEmpate: number | null = null;

  for (let m = 1; m <= input.prazoMeses; m += 1) {
    divida = Math.max(0, divida * (1 + iFin) - parcela);
    const imovel = input.imovelValor * Math.pow(1 + valorizMensal, m);
    const patrimonioCompra = imovel - divida;

    // Locatário: paga o aluguel e investe a entrada + a diferença (parcela − aluguel).
    const diferenca = Math.max(0, parcela - input.aluguelMensal);
    investidoAluguel = investidoAluguel * (1 + iSelic) + diferenca;
    const patrimonioAluguel = investidoAluguel;
    if (![parcela, divida, imovel, patrimonioCompra, patrimonioAluguel].every(Number.isFinite))
      throw new Error('Valores muito altos para calcular uma comparação finita.');

    monthly.push({ month: m, patrimonioCompra, patrimonioAluguel });
    if (mesEmpate === null && patrimonioCompra >= patrimonioAluguel) mesEmpate = m;
  }

  const last = monthly[monthly.length - 1];
  return {
    financiado,
    entrada: input.entrada,
    aluguelMensal: input.aluguelMensal,
    parcela,
    imovelFinal: input.imovelValor * Math.pow(1 + valorizMensal, input.prazoMeses),
    patrimonioCompra: last.patrimonioCompra,
    patrimonioAluguel: last.patrimonioAluguel,
    mesEmpate,
    monthly,
  };
}
