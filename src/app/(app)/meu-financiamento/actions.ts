'use server';

import { and, desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { isUnlimited, requireUnlimited } from '@/lib/meu-financiamento/auth';
import { getContract, splitMovements, toBaseline, toContractParams, upsertDraft } from '@/lib/meu-financiamento/repo';
import {
  isValidDateString,
  primeiraPendente,
  projecao,
  validateContractInput,
} from '@/lib/finance/meu-financiamento/model';
import type {
  AmortizacaoExtra,
  Baseline,
  ContractParams,
  ParcelaPaga,
  Projecao,
} from '@/lib/finance/meu-financiamento/model';

export interface PageState {
  params: ContractParams;
  baseline: Baseline;
  pagas: ParcelaPaga[];
  extras: AmortizacaoExtra[];
  projecao: Projecao;
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

const INSURANCE_SPLIT = { taxPct: 0.25, insurancePct: 0.75 };

async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.userId) throw new Error('Não autenticado');
  return session.userId;
}

async function unlimitedError(userId: string): Promise<string | null> {
  try {
    await requireUnlimited(userId);
    return null;
  } catch {
    return 'Recurso exclusivo do plano Ilimitado';
  }
}

function isUniqueViolation(e: unknown): boolean {
  let err = e as { code?: unknown; cause?: unknown } | null;
  while (err && typeof err.code === 'undefined' && err.cause) {
    err = err.cause as { code?: unknown; cause?: unknown } | null;
  }
  return err?.code === '23505';
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
    projecao: projecao(data.params, data.baseline, pagas, extras),
    isUnlimited: await isUnlimited(userId),
  };
}

async function stateAfter(userId: string): Promise<PageState | null> {
  try {
    return await recomputeState(userId);
  } catch {
    return null;
  }
}

export async function saveDraft(payload: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUser();
  try {
    await upsertDraft(userId, payload);
  } catch {
    return { ok: false, error: 'Não foi possível salvar o rascunho' };
  }
  return { ok: true };
}

export async function createContract(payload: CreateContractInput): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const parsed = validateContractInput(payload);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;

  const created = await db.transaction(async (tx): Promise<boolean> => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${userId} FOR UPDATE`);
    const existing = await tx.query.contracts.findFirst({
      where: eq(schema.contracts.userId, userId),
    });
    if (existing) return false;
    const [contract] = await tx
      .insert(schema.contracts)
      .values({
        userId,
        bank: v.bank,
        system: v.system,
        annualRate: v.annualRate,
        trMonthly: v.trMonthly,
        insuranceMonthly: v.insuranceMonthly,
        insuranceSplit: INSURANCE_SPLIT,
        parcelasTotais: v.parcelasTotais,
      })
      .returning();
    await tx.insert(schema.contractStates).values({
      contractId: contract.id,
      version: 1,
      saldoDevedor: v.saldoDevedor,
      dataBase: v.dataBase,
      proximaParcelaNumero: v.proximaParcelaNumero,
      source: 'cadastro',
    });
    await tx.delete(schema.contractDrafts).where(eq(schema.contractDrafts.userId, userId));
    return true;
  });
  if (!created) return { ok: false, error: 'Contrato já cadastrado' };
  const state = await stateAfter(userId);
  if (!state) return { ok: false, error: 'Estado inconsistente' };
  return { ok: true, state };
}

export async function payInstallment(input: { valor: number; dataPagamento: string }): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  if (typeof input?.valor !== 'number' || !Number.isFinite(input.valor) || input.valor <= 0) {
    return { ok: false, error: 'Valor inválido' };
  }
  if (!isValidDateString(input.dataPagamento)) return { ok: false, error: 'Data inválida' };

  const data = await getContract(userId);
  if (!data) return { ok: false, error: 'Contrato não encontrado' };
  const { pagas } = splitMovements(data.movements);
  const primeira = primeiraPendente(data.params, data.baseline, pagas);
  if (primeira > data.params.parcelasTotais) return { ok: false, error: 'Contrato já quitado' };

  try {
    await db.insert(schema.movements).values({
      contractId: data.contract.id,
      stateId: data.state.id,
      type: 'parcela',
      parcelaNumero: primeira,
      valor: input.valor,
      dataPagamento: input.dataPagamento,
    });
  } catch (e) {
    // 23505: parcela já registrada (requisição duplicada ou corrida) — re-leitura
    // abaixo devolve o estado já consistente em vez do erro cru.
    if (!isUniqueViolation(e)) throw e;
  }

  const state = await stateAfter(userId);
  if (!state) return { ok: false, error: 'Estado inconsistente' };
  return { ok: true, state };
}

export async function registerAmortization(input: AmortizacaoInput): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const { valor, dataPagamento, origem, modo } = input ?? {};
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return { ok: false, error: 'Valor inválido' };
  }
  if (!isValidDateString(dataPagamento)) return { ok: false, error: 'Data inválida' };
  if (origem !== 'proprio' && origem !== 'fgts') return { ok: false, error: 'Origem inválida' };
  if (modo !== 'term' && modo !== 'payment') return { ok: false, error: 'Modo inválido' };

  const data = await getContract(userId);
  if (!data) return { ok: false, error: 'Contrato não encontrado' };
  if (dataPagamento < data.baseline.dataBase) return { ok: false, error: 'Data anterior à data-base' };

  await db.insert(schema.movements).values({
    contractId: data.contract.id,
    stateId: data.state.id,
    type: 'amortizacao',
    parcelaNumero: null,
    valor,
    dataPagamento,
    origem,
    modo,
  });
  const state = await stateAfter(userId);
  if (!state) return { ok: false, error: 'Estado inconsistente' };
  return { ok: true, state };
}

export async function recalibrate(input: RecalibrateInput): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const { saldoDevedor, dataBase, proximaParcelaNumero } = input ?? {};

  type Outcome = { ok: true } | { ok: false; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${userId} FOR UPDATE`);
    const contract = await tx.query.contracts.findFirst({
      where: eq(schema.contracts.userId, userId),
    });
    if (!contract) return { ok: false, error: 'Contrato não encontrado' };
    const [state] = await tx
      .select()
      .from(schema.contractStates)
      .where(eq(schema.contractStates.contractId, contract.id))
      .orderBy(desc(schema.contractStates.version))
      .limit(1);
    if (!state) return { ok: false, error: 'Contrato sem estado' };

    if (typeof saldoDevedor !== 'number' || !Number.isFinite(saldoDevedor) || saldoDevedor < 0) {
      return { ok: false, error: 'Saldo devedor inválido' };
    }
    if (!isValidDateString(dataBase)) return { ok: false, error: 'Data-base inválida' };

    const params = toContractParams(contract);
    const baseline = toBaseline(state);
    if (dataBase < baseline.dataBase) return { ok: false, error: 'Data-base anterior à vigente' };
    if (typeof proximaParcelaNumero !== 'number' || !Number.isInteger(proximaParcelaNumero)
      || proximaParcelaNumero < 1 || proximaParcelaNumero > params.parcelasTotais) {
      return { ok: false, error: 'Próxima parcela inválida' };
    }
    const movements = await tx
      .select()
      .from(schema.movements)
      .where(eq(schema.movements.contractId, contract.id));
    const { pagas } = splitMovements(movements);
    const primeira = primeiraPendente(params, baseline, pagas);
    if (proximaParcelaNumero < primeira) return { ok: false, error: 'Parcela anterior à pendente' };

    await tx.insert(schema.contractStates).values({
      contractId: contract.id,
      version: state.version + 1,
      saldoDevedor,
      dataBase,
      proximaParcelaNumero,
      source: saldoDevedor === 0 ? 'quitacao' : 'recalibracao',
    });
    return { ok: true };
  });

  if (!outcome.ok) return outcome;
  const state = await stateAfter(userId);
  if (!state) return { ok: false, error: 'Estado inconsistente' };
  return { ok: true, state };
}

export async function editMovement(id: string, patch: EditMovementPatch): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const data = await getContract(userId);
  if (!data) return { ok: false, error: 'Contrato não encontrado' };
  const [movement] = await db
    .select()
    .from(schema.movements)
    .where(and(eq(schema.movements.id, id), eq(schema.movements.contractId, data.contract.id)))
    .limit(1);
  if (!movement) return { ok: false, error: 'Movimento não encontrado' };

  const patchObj = patch ?? {};
  const set: { valor?: number; dataPagamento?: string; origem?: string; modo?: string } = {};

  if (patchObj.valor !== undefined) {
    if (typeof patchObj.valor !== 'number' || !Number.isFinite(patchObj.valor) || patchObj.valor <= 0) {
      return { ok: false, error: 'Valor inválido' };
    }
    set.valor = patchObj.valor;
  }
  if (patchObj.dataPagamento !== undefined) {
    if (!isValidDateString(patchObj.dataPagamento)) return { ok: false, error: 'Data inválida' };
    if (movement.type === 'amortizacao' && patchObj.dataPagamento < data.baseline.dataBase) {
      return { ok: false, error: 'Data anterior à data-base' };
    }
    set.dataPagamento = patchObj.dataPagamento;
  }
  if (patchObj.origem !== undefined || patchObj.modo !== undefined) {
    if (movement.type !== 'amortizacao') {
      return { ok: false, error: 'Parcela não aceita origem ou modo' };
    }
    const origem = patchObj.origem ?? movement.origem ?? 'proprio';
    const modo = patchObj.modo ?? movement.modo ?? 'term';
    if (origem !== 'proprio' && origem !== 'fgts') return { ok: false, error: 'Origem inválida' };
    if (modo !== 'term' && modo !== 'payment') return { ok: false, error: 'Modo inválido' };
    set.origem = origem;
    set.modo = modo;
  }

  if (Object.keys(set).length > 0) {
    await db
      .update(schema.movements)
      .set(set)
      .where(and(eq(schema.movements.id, id), eq(schema.movements.contractId, data.contract.id)));
  }
  const state = await stateAfter(userId);
  if (!state) return { ok: false, error: 'Estado inconsistente' };
  return { ok: true, state };
}

export async function deleteMovement(id: string): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const data = await getContract(userId);
  if (!data) return { ok: false, error: 'Contrato não encontrado' };
  const [movement] = await db
    .select()
    .from(schema.movements)
    .where(and(eq(schema.movements.id, id), eq(schema.movements.contractId, data.contract.id)))
    .limit(1);
  if (!movement) return { ok: false, error: 'Movimento não encontrado' };

  await db
    .delete(schema.movements)
    .where(and(eq(schema.movements.id, id), eq(schema.movements.contractId, data.contract.id)));
  const state = await stateAfter(userId);
  if (!state) return { ok: false, error: 'Estado inconsistente' };
  return { ok: true, state };
}
