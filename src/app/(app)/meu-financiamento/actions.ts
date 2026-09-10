'use server';

import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, schema } from '@/db';
import { requireUnlimited } from '@/lib/meu-financiamento/auth';
import { getContract, recomputeState, splitMovements, toBaseline, toContractParams, upsertDraft } from '@/lib/meu-financiamento/repo';
import type {
  AmortizacaoInput,
  CreateContractInput,
  EditMovementPatch,
  MutationResult,
  RecalibrateInput,
  UpdateContractInput,
} from '@/lib/meu-financiamento/repo';
import { isValidDateString, primeiraPendente, projecao, validateContractInput } from '@/lib/finance/meu-financiamento/model';
import type { Baseline, ContractParams } from '@/lib/finance/meu-financiamento/model';
import { splitPagamento } from '@/lib/finance/meu-financiamento/split-payment';
import { todayISO } from '@/lib/meu-financiamento/dates';

const INSURANCE_SPLIT = { taxPct: 0.25, insurancePct: 0.75 };
const NAO_AMORTIZA = 'Dados não amortizam no modelo; revise taxa, TR e prazo';

/** Dry-run da projeção sobre o baseline proposto com o estado novo vazio
 *  (movimentos de estados superados nunca são reaplicados). A engine rejeita
 *  combinações que o range de validação aceita (ex.: taxa anual 0 com TR alta)
 *  — gravar antes de validar deixaria o usuário preso num contrato que o
 *  wizard recusa recriar. */
function projecaoValida(params: ContractParams, baseline: Baseline): boolean {
  try {
    projecao(params, baseline, [], []);
    return true;
  } catch {
    return false;
  }
}

// Guarda do rascunho: payload pequeno, raso e sem ciclos. O tamanho usa a
// serialização real (UTF-8) para não depender de heurística de contagem.
const MAX_DRAFT_BYTES = 8 * 1024;
const MAX_DRAFT_DEPTH = 4;

function depthOf(value: unknown, seen: Set<object>): number {
  if (typeof value !== 'object' || value === null) return 0;
  if (seen.has(value)) return 0;
  seen.add(value);
  let depth = 0;
  for (const child of Object.values(value)) {
    depth = Math.max(depth, depthOf(child, seen));
  }
  return depth + 1;
}

function isValidDraftPayload(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return false;
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return false; // ciclo de referência: JSON.stringify lança
  }
  return bytes <= MAX_DRAFT_BYTES && depthOf(payload, new Set()) <= MAX_DRAFT_DEPTH;
}

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

async function stateAfter(userId: string): Promise<MutationResult | null> {
  try {
    const state = await recomputeState(userId);
    return { ok: true, state };
  } catch {
    return null;
  }
}

export async function saveDraft(payload: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUser();
  if (!isValidDraftPayload(payload)) {
    return { ok: false, error: 'Rascunho inválido' };
  }
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

  type Outcome = { ok: true } | { ok: false; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    await tx.execute(sql`SELECT id FROM ${schema.users} WHERE id = ${userId} FOR UPDATE`);
    const existing = await tx.query.contracts.findFirst({
      where: eq(schema.contracts.userId, userId),
    });
    if (existing) return { ok: false, error: 'Contrato já cadastrado' };
    const params: ContractParams = {
      bank: v.bank,
      system: v.system,
      annualRate: v.annualRate,
      trMonthly: v.trMonthly,
      insuranceMonthly: v.insuranceMonthly,
      parcelasTotais: v.parcelasTotais,
    };
    const baseline: Baseline = {
      version: 1,
      saldoDevedor: v.saldoDevedor,
      dataBase: v.dataBase,
      proximaParcelaNumero: v.proximaParcelaNumero,
    };
    if (!projecaoValida(params, baseline)) return { ok: false, error: NAO_AMORTIZA };
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
      diaVencimento: v.diaVencimento,
      source: 'cadastro',
      bank: v.bank,
      system: v.system,
      annualRate: v.annualRate,
      trMonthly: v.trMonthly,
      insuranceMonthly: v.insuranceMonthly,
      parcelasTotais: v.parcelasTotais,
    });
    await tx.delete(schema.contractDrafts).where(eq(schema.contractDrafts.userId, userId));
    return { ok: true };
  });
  if (!outcome.ok) return outcome;
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
}

export async function payInstallment(input: {
  valor: number;
  dataPagamento: string;
  excedenteModo?: 'term' | 'payment';
}): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const { valor, dataPagamento, excedenteModo } = input ?? {};
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return { ok: false, error: 'Valor inválido' };
  }
  if (!isValidDateString(dataPagamento)) return { ok: false, error: 'Data inválida' };
  if (excedenteModo !== undefined && excedenteModo !== 'term' && excedenteModo !== 'payment') {
    return { ok: false, error: 'Modo inválido' };
  }

  // Transação com lock do usuário: recalibração concorrente não pode intercalar
  // entre a leitura do baseline e o insert (senão o lançamento gravaria com o
  // stateId do estado superado e sumiria do recompute). Toda a lógica é
  // revalidada dentro da tx, contra o estado vigente no commit.
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
    if (state.saldoDevedor === 0) return { ok: false, error: 'Contrato já quitado' };

    const params = toContractParams(state);
    const baseline = toBaseline(state);
    const movements = await tx
      .select()
      .from(schema.movements)
      .where(and(
        eq(schema.movements.contractId, contract.id),
        eq(schema.movements.stateId, state.id),
      ));
    const { pagas, extras } = splitMovements(movements);
    const primeira = primeiraPendente(params, baseline, pagas);
    if (primeira > params.parcelasTotais) return { ok: false, error: 'Contrato já quitado' };

    // Parcela projetada da primeira pendente: alvo do split entre parcela e
    // amortização extra. Sem parcela projetada (saldo já zerado no modelo) não
    // há boleto a pagar.
    let projetada: number | undefined;
    try {
      projetada = projecao(params, baseline, pagas, extras).parcelas[0]?.parcela;
    } catch {
      return { ok: false, error: 'Não foi possível projetar a próxima parcela' };
    }
    if (projetada === undefined) return { ok: false, error: 'Sem parcela projetada para pagar' };

    const split = splitPagamento(projetada, valor);
    const groupId = split.amortizacao > 0 ? crypto.randomUUID() : null;
    // Colisão de parcela: o unique é (contractId, parcelaNumero). Se a parcela
    // já tem lançamento de um estado ANTERIOR (edição retroativa que reabriu a
    // competência sobre um período já recalibrado), registrar de novo violaria
    // o unique; e a transação abortada pelo 23505 não permite consultar o
    // conflito depois. O lock do usuário serializa os fluxos, então a checagem
    // prévia basta. Colisão com o MESMO estado segue idempotente no catch.
    const [existente] = await tx
      .select({ stateId: schema.movements.stateId })
      .from(schema.movements)
      .where(and(
        eq(schema.movements.contractId, contract.id),
        eq(schema.movements.type, 'parcela'),
        eq(schema.movements.parcelaNumero, primeira),
      ))
      .limit(1);
    if (existente && existente.stateId !== state.id) {
      return { ok: false, error: 'Esta parcela já tem lançamento de um período anterior; recalibre ou ajuste o contrato' };
    }
    try {
      await tx.insert(schema.movements).values({
        contractId: contract.id,
        stateId: state.id,
        type: 'parcela',
        parcelaNumero: primeira,
        valor: split.parcela,
        dataPagamento,
        groupId,
      });
      if (split.amortizacao > 0) {
        await tx.insert(schema.movements).values({
          contractId: contract.id,
          stateId: state.id,
          type: 'amortizacao',
          parcelaNumero: null,
          valor: split.amortizacao,
          dataPagamento,
          origem: 'proprio',
          modo: excedenteModo ?? 'term',
          groupId,
        });
      }
    } catch (e) {
      // 23505: parcela já registrada por outro fluxo — re-leitura idempotente
      // (recompute abaixo reflete a linha que já existe). O groupId novo a cada
      // tentativa não conflita: a unique é da parcela.
      if (!isUniqueViolation(e)) throw e;
    }
    return { ok: true };
  });

  if (!outcome.ok) return outcome;
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
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
  if (dataPagamento > todayISO()) return { ok: false, error: 'Data futura' };
  if (origem !== 'proprio' && origem !== 'fgts') return { ok: false, error: 'Origem inválida' };
  if (modo !== 'term' && modo !== 'payment') return { ok: false, error: 'Modo inválido' };

  // Transação com lock do usuário serializa duplo clique e revalida contra o
  // baseline vigente no commit (recalibração concorrente não furar a regra de
  // data). Não há índice único: amortizações legítimas repetem valor/data; a
  // proteção de duplo clique na UI (botão desabilitado durante pending) é a
  // Task 6.
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
    if (state.saldoDevedor === 0) return { ok: false, error: 'Contrato já quitado' };
    if (dataPagamento < state.dataBase) return { ok: false, error: 'Data anterior à data-base' };

    await tx.insert(schema.movements).values({
      contractId: contract.id,
      stateId: state.id,
      type: 'amortizacao',
      parcelaNumero: null,
      valor,
      dataPagamento,
      origem,
      modo,
    });
    return { ok: true };
  });
  if (!outcome.ok) return outcome;
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
}

export async function recalibrate(input: RecalibrateInput): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const { saldoDevedor, dataBase, proximaParcelaNumero, diaVencimento } = input ?? {};

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

    const params = toContractParams(state);
    const baseline = toBaseline(state);
    if (dataBase < baseline.dataBase) return { ok: false, error: 'Data-base anterior à vigente' };
    if (typeof proximaParcelaNumero !== 'number' || !Number.isInteger(proximaParcelaNumero)
      || proximaParcelaNumero < 1 || proximaParcelaNumero > params.parcelasTotais) {
      return { ok: false, error: 'Próxima parcela inválida' };
    }
    if (typeof diaVencimento !== 'number' || !Number.isInteger(diaVencimento)
      || diaVencimento < 1 || diaVencimento > 31) {
      return { ok: false, error: 'Dia do vencimento inválido' };
    }
    // Guarda de contiguidade: movimentos do estado vigente (o que será
    // superado); lançamentos de estados mais antigos já viraram histórico.
    const movements = await tx
      .select()
      .from(schema.movements)
      .where(and(
        eq(schema.movements.contractId, contract.id),
        eq(schema.movements.stateId, state.id),
      ));
    const { pagas } = splitMovements(movements);
    const primeira = primeiraPendente(params, baseline, pagas);
    if (proximaParcelaNumero < primeira) return { ok: false, error: 'Parcela anterior à pendente' };

    // Paridade com o baseline vigente: criar versão nova com os MESMOS
    // saldo/data-base/próxima parcela esconderia os lançamentos do usuário
    // (movements do estado superado viram histórico) sem nenhum efeito.
    // Saldo em centavos: valores de ponto flutuante da mesma origem.
    const saldoIgual = Math.round(saldoDevedor * 100) === Math.round(state.saldoDevedor * 100);
    if (saldoIgual && dataBase === state.dataBase && proximaParcelaNumero === state.proximaParcelaNumero
      && diaVencimento === state.diaVencimento) {
      return { ok: false, error: 'Nada a recalibrar: saldo, data-base e próxima parcela já são os atuais' };
    }

    // Dry-run da projeção do estado novo (movimentos vazios) antes do insert:
    // combinação no range validado que a engine rejeita não pode gravar uma
    // versão que o recompute não consegue projetar. Contrato quitado (saldo 0)
    // pode ser reativado aqui: saldo > 0 com data-base/parcela novas gera
    // version+1 com source 'recalibracao' e o histórico dos estados antigos.
    const novoBaseline: Baseline = {
      version: state.version + 1,
      saldoDevedor,
      dataBase,
      proximaParcelaNumero,
    };
    if (!projecaoValida(params, novoBaseline)) return { ok: false, error: NAO_AMORTIZA };

    await tx.insert(schema.contractStates).values({
      contractId: contract.id,
      version: state.version + 1,
      saldoDevedor,
      dataBase,
      proximaParcelaNumero,
      diaVencimento,
      source: saldoDevedor === 0 ? 'quitacao' : 'recalibracao',
      bank: params.bank,
      system: params.system,
      annualRate: params.annualRate,
      trMonthly: params.trMonthly,
      insuranceMonthly: params.insuranceMonthly,
      parcelasTotais: params.parcelasTotais,
    });
    return { ok: true };
  });

  if (!outcome.ok) return outcome;
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
}

export async function updateContract(input: UpdateContractInput): Promise<MutationResult> {
  const userId = await requireUser();
  const limited = await unlimitedError(userId);
  if (limited) return { ok: false, error: limited };

  const parsed = validateContractInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const v = parsed.value;

  // Portabilidade, mudança de taxa/sistema ou acordo de prazo: grava uma
  // versão nova do baseline com os parâmetros novos. Os movements do estado
  // vigente ficam congelados (nunca são reaplicados), então o histórico
  // anterior não é recalculado. Mesma tx com lock do usuário do recalibrate.
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
    // Contrato quitado não é editável pela UI; reativar saldo tem fluxo
    // próprio (recalibrar pelo extrato), que grava source 'recalibracao'.
    if (state.saldoDevedor === 0) return { ok: false, error: 'Contrato já quitado' };

    const baseline = toBaseline(state);
    if (v.dataBase < baseline.dataBase) return { ok: false, error: 'Data-base anterior à vigente' };

    // Sem guarda de contiguidade: a parcela pode ser ANTERIOR à pendente (ex.:
    // corrigir a competência informada). Movimentos do estado vigente que ficam
    // no futuro da nova posição são APAGADOS logo abaixo (voltar no tempo);
    // estados anteriores permanecem intactos como histórico.
    const movements = await tx
      .select()
      .from(schema.movements)
      .where(and(
        eq(schema.movements.contractId, contract.id),
        eq(schema.movements.stateId, state.id),
      ));
    const { pagas } = splitMovements(movements);
    const primeira = primeiraPendente(toContractParams(state), baseline, pagas);
    const retroativo = v.proximaParcelaNumero < primeira;

    // Paridade total: gravar versão nova sem nenhuma mudança esconderia os
    // lançamentos do usuário (movements do estado superado viram histórico)
    // sem efeito. Comparações arredondadas (taxa/TR em 4 casas percentuais,
    // dinheiro em centavos) para ruído de ponto flutuante não gravar versão
    // "sem mudança". Retroativo escapa da paridade: a remoção dos lançamentos
    // futuros (abaixo) é efeito suficiente para a versão nova.
    const rateEq = (a: number, b: number) => Math.round(a * 1e6) === Math.round(b * 1e6);
    const centsEq = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);
    const nadaMudou = centsEq(v.saldoDevedor, state.saldoDevedor)
      && v.dataBase === state.dataBase
      && v.proximaParcelaNumero === state.proximaParcelaNumero
      && v.diaVencimento === state.diaVencimento
      && v.bank === state.bank
      && v.system === state.system
      && rateEq(v.annualRate, state.annualRate)
      && rateEq(v.trMonthly, state.trMonthly)
      && centsEq(v.insuranceMonthly, state.insuranceMonthly)
      && v.parcelasTotais === state.parcelasTotais;
    if (nadaMudou && !retroativo) return { ok: false, error: 'Nada a atualizar: os dados são os atuais' };

    const novosParams: ContractParams = {
      bank: v.bank,
      system: v.system,
      annualRate: v.annualRate,
      trMonthly: v.trMonthly,
      insuranceMonthly: v.insuranceMonthly,
      parcelasTotais: v.parcelasTotais,
    };
    const novoBaseline: Baseline = {
      version: state.version + 1,
      saldoDevedor: v.saldoDevedor,
      dataBase: v.dataBase,
      proximaParcelaNumero: v.proximaParcelaNumero,
    };
    // Dry-run da projeção do estado novo (movimentos vazios) antes do insert:
    // combinação no range validado que a engine rejeita não pode gravar uma
    // versão que o recompute não consegue projetar.
    if (!projecaoValida(novosParams, novoBaseline)) return { ok: false, error: NAO_AMORTIZA };

    // Edição retroativa = voltar no tempo: apaga do estado vigente as parcelas
    // com número >= à nova posição e as amortizações com data >= à data-base
    // nova. Congelá-las deixaria competências já registradas reabertas com o
    // unique (contractId, parcelaNumero) ocupado e o pagamento seguinte
    // colidiria para sempre (23505 engolido). A remoção é só do estado vigente:
    // lançamentos de estados anteriores continuam no histórico. Roda depois de
    // TODAS as validações e imediatamente antes do insert: um retorno de erro
    // aqui depois deixaria a remoção commitada sem o estado novo.
    if (retroativo) {
      await tx.delete(schema.movements).where(and(
        eq(schema.movements.contractId, contract.id),
        eq(schema.movements.stateId, state.id),
        or(
          and(
            eq(schema.movements.type, 'parcela'),
            gte(schema.movements.parcelaNumero, v.proximaParcelaNumero),
          ),
          and(
            eq(schema.movements.type, 'amortizacao'),
            gte(schema.movements.dataPagamento, v.dataBase),
          ),
        ),
      ));
    }

    await tx.insert(schema.contractStates).values({
      contractId: contract.id,
      version: state.version + 1,
      saldoDevedor: v.saldoDevedor,
      dataBase: v.dataBase,
      proximaParcelaNumero: v.proximaParcelaNumero,
      diaVencimento: v.diaVencimento,
      source: 'atualizacao',
      bank: v.bank,
      system: v.system,
      annualRate: v.annualRate,
      trMonthly: v.trMonthly,
      insuranceMonthly: v.insuranceMonthly,
      parcelasTotais: v.parcelasTotais,
    });
    return { ok: true };
  });

  if (!outcome.ok) return outcome;
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
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
  // Só o estado VIGENTE é editável: lançamento de baseline superado já foi
  // absorvido pela recalibração (histórico) e alterá-lo não muda a projeção.
  if (movement.stateId !== data.state.id) {
    return { ok: false, error: 'Lançamento anterior à última recalibração; recalibre novamente se precisar corrigir' };
  }
  // Parcela com excedente tem amortização vinculada (groupId): editar só a
  // parcela deixaria o excedente contado em dobro pelo modelo. A amortização
  // isolada continua editável.
  if (movement.type === 'parcela' && movement.groupId) {
    return {
      ok: false,
      error: 'Parcela com amortização extra vinculada não pode ser editada; apague o lançamento e registre novamente',
    };
  }

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
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
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
  // Guarda dupla contra estado superado: além de bloquear exclusão de parcela
  // do meio do bloco, movimentos de baselines antigos (histórico absorvido pela
  // recalibração) não podem ser apagados silenciosamente.
  if (movement.stateId !== data.state.id) {
    return { ok: false, error: 'Lançamento anterior à última recalibração; recalibre novamente se precisar corrigir' };
  }

  if (movement.type === 'parcela') {
    // Apagar parcela do meio do bloco quebra a contiguidade que o modelo exige
    // (projecao lança 'Parcelas pagas não são contínuas') e trava o contrato:
    // só a parcela de maior número entre as pagas do estado vigente pode sair.
    // A amortização vinculada (groupId) não entra em pagas, então o guard segue
    // valendo só para a parcela.
    const { pagas } = splitMovements(data.movements);
    const maxPaga = pagas.reduce((maior, p) => Math.max(maior, p.parcelaNumero), 0);
    if (movement.parcelaNumero !== maxPaga) {
      return { ok: false, error: 'Parcela excluída criaria lacuna; apague da mais recente para a mais antiga' };
    }
  }

  // Pagamento com excedente: parcela e amortização extra foram gravadas com o
  // mesmo groupId; apagar a parcela apaga o grupo inteiro na mesma tx.
  await db.transaction(async (tx) => {
    if (movement.type === 'parcela' && movement.groupId) {
      await tx
        .delete(schema.movements)
        .where(and(
          eq(schema.movements.contractId, data.contract.id),
          eq(schema.movements.groupId, movement.groupId),
        ));
      return;
    }
    await tx
      .delete(schema.movements)
      .where(and(eq(schema.movements.id, id), eq(schema.movements.contractId, data.contract.id)));
  });
  return (await stateAfter(userId)) ?? { ok: false, error: 'Estado inconsistente' };
}
