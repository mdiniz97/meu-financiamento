import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { Contract, ContractState, Movement } from '@/db/schema';
import { isUnlimited } from './auth';
import { projecao } from '@/lib/finance/meu-financiamento/model';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ContractSystem,
  ParcelaPaga,
  Projecao,
} from '@/lib/finance/meu-financiamento/model';

export interface ContractData {
  params: ContractParams;
  baseline: Baseline;
  movements: Movement[];
}

export interface ContractBundle extends ContractData {
  contract: Contract;
  state: ContractState;
  /** Todos os baselines do contrato em ordem de versão (histórico da timeline). */
  states: ContractState[];
}

/** Baseline serializável para a timeline (createdAt como ISO string). */
export interface ContractStateSummary {
  version: number;
  saldoDevedor: number;
  dataBase: string;
  source: 'cadastro' | 'recalibracao' | 'quitacao';
  createdAt: string;
}

export interface PageData {
  contract: ContractData | null;
  draft: unknown | null;
}

export interface PageState {
  params: ContractParams;
  baseline: Baseline;
  pagas: ParcelaPagaComId[];
  extras: AmortizacaoComId[];
  /** Histórico de baselines (cadastro e recalibrações) para a timeline. */
  states: ContractStateSummary[];
  projecao: Projecao;
  /** Contrato quitado segundo o BANCO (baseline vigente com saldo 0 /
   *  source 'quitacao'), não segundo o modelo. Lançamentos equivocados podem
   *  zerar saldoEfetivo com o contrato ainda ativo (quitado false). */
  quitado: boolean;
  isUnlimited: boolean;
}

export type MutationResult = { ok: true; state: PageState } | { ok: false; error: string };

export interface CreateContractInput {
  bank: string;
  system: 'PRICE' | 'SAC';
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  parcelasTotais: number;
  saldoDevedor: number;
  dataBase: string;
  proximaParcelaNumero: number;
}

export interface AmortizacaoInput {
  valor: number;
  dataPagamento: string;
  origem: 'proprio' | 'fgts';
  modo: 'term' | 'payment';
}

export interface RecalibrateInput {
  saldoDevedor: number;
  dataBase: string;
  proximaParcelaNumero: number;
}

export interface EditMovementPatch {
  valor?: number;
  dataPagamento?: string;
  origem?: 'proprio' | 'fgts';
  modo?: 'term' | 'payment';
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

/** Parcela paga com o id do lançamento (movements.id), necessário para editar/apagar na UI. */
export type ParcelaPagaComId = ParcelaPaga & { id: string; groupId?: string | null };

/** Amortização extra com o id do lançamento, necessário para editar/apagar na UI. */
export type AmortizacaoComId = AmortizacaoExtra & { id: string; groupId?: string | null };

export function splitMovements(movements: Movement[]): { pagas: ParcelaPagaComId[]; extras: AmortizacaoComId[] } {
  const pagas = movements
    .filter((m) => m.type === 'parcela' && m.parcelaNumero != null)
    .map((m) => ({
      id: m.id,
      groupId: m.groupId,
      parcelaNumero: m.parcelaNumero as number,
      valor: m.valor,
      dataPagamento: m.dataPagamento,
    }))
    .sort((a, b) => a.parcelaNumero - b.parcelaNumero);
  const extras = movements
    .filter((m) => m.type === 'amortizacao')
    .map((m) => ({
      id: m.id,
      groupId: m.groupId,
      dataPagamento: m.dataPagamento,
      valor: m.valor,
      origem: (m.origem ?? 'proprio') as 'proprio' | 'fgts',
      modo: (m.modo ?? 'term') as 'term' | 'payment',
    }))
    .sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento));
  return { pagas, extras };
}

export async function recomputeState(userId: string): Promise<PageState> {
  const data = await getContract(userId);
  if (!data) throw new Error('Contrato não encontrado');
  const { pagas, extras } = splitMovements(data.movements);
  return {
    params: data.params,
    baseline: data.baseline,
    pagas,
    extras,
    states: data.states.map((s) => ({
      version: s.version,
      saldoDevedor: s.saldoDevedor,
      dataBase: s.dataBase,
      source: s.source as ContractStateSummary['source'],
      createdAt: s.createdAt.toISOString(),
    })),
    projecao: projecao(data.params, data.baseline, pagas, extras),
    quitado: data.state.saldoDevedor === 0 || data.state.source === 'quitacao',
    isUnlimited: await isUnlimited(userId),
  };
}

async function loadBundle(userId: string): Promise<ContractBundle | null> {
  const contract = await db.query.contracts.findFirst({
    where: eq(schema.contracts.userId, userId),
  });
  if (!contract) return null;
  const states = await db
    .select()
    .from(schema.contractStates)
    .where(eq(schema.contractStates.contractId, contract.id))
    .orderBy(asc(schema.contractStates.version));
  const state = states[states.length - 1];
  if (!state) throw new Error('Contrato sem estado');
  // Movements são lançamentos DO ESTADO VIGENTE: cada linha aponta para o
  // contract_states em que foi registrada (stateId). Lançamentos de baselines
  // antigos são histórico — a recalibração já os incorporou no novo saldo e
  // na nova parcela pendente — e NUNCA são reaplicados: incluí-los aqui
  // recontaria parcelas pagas/amortizações de estados superados (duplo
  // desconto) e quebraria a contiguidade esperada pelo modelo.
  const movements = await db
    .select()
    .from(schema.movements)
    .where(and(
      eq(schema.movements.contractId, contract.id),
      eq(schema.movements.stateId, state.id),
    ))
    // created_at desempata lançamentos do mesmo dia (amortizações não têm
    // parcelaNumero e o NULL deixa a ordem do Postgres não determinística):
    // a UI lista na ordem em que foram registrados.
    .orderBy(asc(schema.movements.dataPagamento), asc(schema.movements.parcelaNumero), asc(schema.movements.createdAt));
  return { contract, state, states, params: toContractParams(contract), baseline: toBaseline(state), movements };
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
