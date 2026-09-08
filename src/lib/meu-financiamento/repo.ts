import { asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Contract, ContractState, Movement } from '@/db/schema';
import type { AmortizacaoExtra, Baseline, ContractParams, ContractSystem, ParcelaPaga } from '@/lib/finance/meu-financiamento/model';

export interface ContractData {
  params: ContractParams;
  baseline: Baseline;
  movements: Movement[];
}

export interface ContractBundle extends ContractData {
  contract: Contract;
  state: ContractState;
}

export interface PageData {
  contract: ContractData | null;
  draft: unknown | null;
}

export function toContractParams(row: Contract): ContractParams {
  return {
    bank: row.bank,
    system: row.system as ContractSystem,
    annualRate: row.annualRate,
    trMonthly: row.trMonthly,
    insuranceMonthly: row.insuranceMonthly,
    parcelasTotais: row.parcelasTotais,
  };
}

export function toBaseline(row: ContractState): Baseline {
  return {
    version: row.version,
    saldoDevedor: row.saldoDevedor,
    dataBase: row.dataBase,
    proximaParcelaNumero: row.proximaParcelaNumero,
  };
}

export function splitMovements(movements: Movement[]): { pagas: ParcelaPaga[]; extras: AmortizacaoExtra[] } {
  const pagas = movements
    .filter((m) => m.type === 'parcela' && m.parcelaNumero != null)
    .map((m) => ({ parcelaNumero: m.parcelaNumero as number, valor: m.valor, dataPagamento: m.dataPagamento }))
    .sort((a, b) => a.parcelaNumero - b.parcelaNumero);
  const extras = movements
    .filter((m) => m.type === 'amortizacao')
    .map((m) => ({
      dataPagamento: m.dataPagamento,
      valor: m.valor,
      origem: (m.origem ?? 'proprio') as 'proprio' | 'fgts',
      modo: (m.modo ?? 'term') as 'term' | 'payment',
    }))
    .sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento));
  return { pagas, extras };
}

async function loadBundle(userId: string): Promise<ContractBundle | null> {
  const contract = await db.query.contracts.findFirst({
    where: eq(schema.contracts.userId, userId),
  });
  if (!contract) return null;
  const [state] = await db
    .select()
    .from(schema.contractStates)
    .where(eq(schema.contractStates.contractId, contract.id))
    .orderBy(desc(schema.contractStates.version))
    .limit(1);
  if (!state) throw new Error('Contrato sem estado');
  const movements = await db
    .select()
    .from(schema.movements)
    .where(eq(schema.movements.contractId, contract.id))
    .orderBy(asc(schema.movements.dataPagamento), asc(schema.movements.parcelaNumero));
  return { contract, state, params: toContractParams(contract), baseline: toBaseline(state), movements };
}

export async function getContract(userId: string): Promise<ContractBundle | null> {
  return loadBundle(userId);
}

export async function getDraft(userId: string): Promise<unknown | null> {
  const row = await db.query.contractDrafts.findFirst({
    where: eq(schema.contractDrafts.userId, userId),
  });
  return row?.payload ?? null;
}

export async function upsertDraft(userId: string, payload: unknown): Promise<void> {
  await db
    .insert(schema.contractDrafts)
    .values({ userId, payload })
    .onConflictDoUpdate({
      target: schema.contractDrafts.userId,
      set: { payload, updatedAt: new Date() },
    });
}

export async function clearDraft(userId: string): Promise<void> {
  await db.delete(schema.contractDrafts).where(eq(schema.contractDrafts.userId, userId));
}

export async function getPageData(userId: string): Promise<PageData> {
  const bundle = await loadBundle(userId);
  const draft = await getDraft(userId);
  return {
    contract: bundle ? { params: bundle.params, baseline: bundle.baseline, movements: bundle.movements } : null,
    draft,
  };
}
