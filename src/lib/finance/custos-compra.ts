export interface CustosCompraInput {
  valorImovel: number;
  entradaPct: number;
  uf: string;
  custosExtras: number;
}

export interface CustosCompraResult {
  entrada: number;
  financiado: number;
  itbi: number;
  registro: number;
  extras: number;
  totalDesembolso: number;
}

export const UF_CUSTOS: Record<string, { itbi: number; registro: number }> = {
  AC: { itbi: 2, registro: 1.5 },
  AL: { itbi: 3, registro: 1.5 },
  AP: { itbi: 2.5, registro: 1.5 },
  AM: { itbi: 2, registro: 1.5 },
  BA: { itbi: 3, registro: 1.5 },
  CE: { itbi: 2.5, registro: 1.5 },
  DF: { itbi: 3, registro: 1.5 },
  ES: { itbi: 2.5, registro: 1.5 },
  GO: { itbi: 2.5, registro: 1.5 },
  MA: { itbi: 2.5, registro: 1.5 },
  MT: { itbi: 2.5, registro: 1.5 },
  MS: { itbi: 2.5, registro: 1.5 },
  MG: { itbi: 3, registro: 1.5 },
  PA: { itbi: 2, registro: 1.5 },
  PB: { itbi: 3, registro: 1.5 },
  PR: { itbi: 2.5, registro: 1.5 },
  PE: { itbi: 2.5, registro: 1.5 },
  PI: { itbi: 2.5, registro: 1.5 },
  RJ: { itbi: 2, registro: 1.5 },
  RN: { itbi: 3, registro: 1.5 },
  RS: { itbi: 3, registro: 1.5 },
  RO: { itbi: 2, registro: 1.5 },
  RR: { itbi: 2, registro: 1.5 },
  SC: { itbi: 2.5, registro: 1.5 },
  SP: { itbi: 3, registro: 1.5 },
  SE: { itbi: 3, registro: 1.5 },
  TO: { itbi: 2.5, registro: 1.5 },
};

export function calcularCustosCompra(input: CustosCompraInput): CustosCompraResult {
  if (!(input.valorImovel > 0)) throw new Error('Informe o valor do imóvel.');
  if (!(input.entradaPct >= 5 && input.entradaPct <= 95))
    throw new Error('Entrada deve ficar entre 5% e 95%.');
  const uf = UF_CUSTOS[input.uf];
  if (!uf) throw new Error('Selecione um estado.');
  if (!(input.custosExtras >= 0)) throw new Error('Custos extras inválidos.');

  const entrada = (input.valorImovel * input.entradaPct) / 100;
  const itbi = (input.valorImovel * uf.itbi) / 100;
  const registro = (input.valorImovel * uf.registro) / 100;

  return {
    entrada,
    financiado: input.valorImovel - entrada,
    itbi,
    registro,
    extras: input.custosExtras,
    totalDesembolso: entrada + itbi + registro + input.custosExtras,
  };
}
