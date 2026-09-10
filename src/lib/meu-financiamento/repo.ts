import { asc, eq } from 'drizzle-orm';
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
  /** TODOS os lançamentos do contrato (todos os baselines), em ordem. */
  historico: Movement[];
}

/** Baseline serializável para a timeline (createdAt como ISO string). */
export interface ContractStateSummary {
  version: number;
  saldoDevedor: number;
  dataBase: string;
  source: 'cadastro' | 'recalibracao' | 'quitacao' | 'atualizacao';
  /** Parâmetros contratuais vigentes nesta versão (para a timeline comparar). */
  bank: string;
  system: ContractSystem;
  annualRate: number;
  trMonthly: number;
  insuranceMonthly: number;
  parcelasTotais: number;
  createdAt: string;
}

export interface PageData {
  contract: ContractData | null;
  draft: unknown | null;
}

export interface PageState {
  params: ContractParams;
  baseline: Baseline;
  /** Lançamentos do baseline VIGENTE: base do cálculo/projeção e dos guards de edição. */
  pagas: ParcelaPagaComId[];
  extras: AmortizacaoComId[];
  /** Lançamentos de TODOS os baselines: a timeline e o total pago continuam
   *  visíveis após recalibração/atualização, que congelam o passado. */
  historico: { pagas: ParcelaPagaComId[]; extras: AmortizacaoComId[] };
  /** Id do baseline vigente: a UI só edita/apaga lançamentos deste estado. */
  stateId: string;
  /** Histórico de baselines (cadastro, recalibrações e atualizações) para a timeline. */
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

/** Portabilidade/mudança de taxa ou sistema: mesmos campos do cadastro. */
export type UpdateContractInput = CreateContractInput;

export interface EditMovementPatch {
  valor?: number;
  dataPagamento?: string;
  origem?: 'proprio' | 'fgts';
  modo?: 'term' | 'payment';
}

export function toContractParams(state: ContractState): ContractParams {
  return {
    bank: state.bank,
    system: state.system as ContractSystem,
    annualRate: state.annualRate,
    trMonthly: state.trMonthly,
    insuranceMonthly: state.insuranceMonthly,
    parcelasTotais: state.parcelasTotais,
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

/** Parcela paga com o id do lançamento (movements.id) e o baseline em que foi
 *  registrada, necessário para editar/apagar na UI e separar histórico. */
export type ParcelaPagaComId = ParcelaPaga & { id: string; groupId?: string | null; stateId: string };

/** Amortização extra com o id do lançamento e o baseline em que foi registrada. */
export type AmortizacaoComId = AmortizacaoExtra & { id: string; groupId?: string | null; stateId: string };

export function splitMovements(movements: Movement[]): { pagas: ParcelaPagaComId[]; extras: AmortizacaoComId[] } {
  const pagas = movements
    .filter((m) => m.type === 'parcela' && m.parcelaNumero != null)
    .map((m) => ({
      id: m.id,
      groupId: m.groupId,
      stateId: m.stateId,
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
      stateId: m.stateId,
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
  const historico = splitMovements(data.historico);
  return {
    params: data.params,
    baseline: data.baseline,
    pagas,
    extras,
    historico,
    stateId: data.state.id,
    states: data.states.map((s) => ({
      version: s.version,
      saldoDevedor: s.saldoDevedor,
      dataBase: s.dataBase,
      source: s.source as ContractStateSummary['source'],
      bank: s.bank,
      system: s.system as ContractSystem,
      annualRate: s.annualRate,
      trMonthly: s.trMonthly,
      insuranceMonthly: s.insuranceMonthly,
      parcelasTotais: s.parcelasTotais,
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
  // Movements de TODOS os baselines: os do estado vigente entram no cálculo
  // (pagas/extras) e os de estados superados alimentam apenas o histórico
  // visível (timeline/total pago) — nunca são reaplicados no modelo, porque a
  // recalibração/atualização já os incorporou no saldo do estado novo.
  const todos = await db
    .select()
    .from(schema.movements)
    .where(eq(schema.movements.contractId, contract.id))
    // created_at desempata lançamentos do mesmo dia (amortizações não têm
    // parcelaNumero e o NULL deixa a ordem do Postgres não determinística):
    // a UI lista na ordem em que foram registrados.
    .orderBy(asc(schema.movements.dataPagamento), asc(schema.movements.parcelaNumero), asc(schema.movements.createdAt));
  const movements = todos.filter((m) => m.stateId === state.id);
  return {
    contract,
    state,
    states,
    params: toContractParams(state),
    baseline: toBaseline(state),
    movements,
    historico: todos,
  };
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
