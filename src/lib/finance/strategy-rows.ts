import type { Strategies } from './types';

export type AporteTipo = 'pontual' | 'mensal' | 'pct' | 'recorrente' | 'anual' | 'sac';

export interface AporteRow {
  id: number;
  tipo: AporteTipo;
  amount: number;
  month: number;
  every: number;
  untilMonth?: number;
  mode?: 'term' | 'payment';
}

/** remove linhas cujo mês de início passa do prazo (o aporte nunca dispararia dentro do contrato; não move dinheiro para o último mês); clampa `untilMonth` no prazo */
export function clampUntilMonths(rows: AporteRow[], months: number): AporteRow[] {
  if (!(months >= 1)) return rows;
  let changed = false;
  const next: AporteRow[] = [];
  for (const r of rows) {
    if (r.month > months) {
      // mês de início além do prazo: linha cai fora em vez de aportar no
      // último mês do contrato (dinheiro novo silencioso dentro do prazo)
      changed = true;
      continue;
    }
    let row: AporteRow = r;
    if (r.untilMonth !== undefined && r.untilMonth > months) {
      changed = true;
      row = { ...row, untilMonth: months };
    }
    next.push(row);
  }
  return changed ? next : rows;
}

/** remove estratégias cujo mês de início passa do prazo (janela nunca dispararia dentro do contrato); clampa `untilMonth` no prazo */
export function clampStrategyUntilMonths(strategies: Strategies, months: number): Strategies {
  if (!(months >= 1)) return strategies;
  let changed = false;
  const next: Strategies = { ...strategies };
  if (strategies.extraMonthlyPctStartMonth !== undefined && strategies.extraMonthlyPctStartMonth > months) {
    // % extra começaria depois do fim do contrato: remove a janela inteira
    // (sem isso, apagar só o início faria o % disparar do mês 1 = dinheiro novo)
    delete next.extraMonthlyPct;
    delete next.extraMonthlyPctStartMonth;
    delete next.extraMonthlyPctUntilMonth;
    delete next.extraMonthlyPctReduceMode;
    changed = true;
  } else if (strategies.extraMonthlyPctUntilMonth !== undefined && strategies.extraMonthlyPctUntilMonth > months) {
    next.extraMonthlyPctUntilMonth = months;
    changed = true;
  }
  if (strategies.fgtsAnnual) {
    if (strategies.fgtsAnnual.startMonth !== undefined && strategies.fgtsAnnual.startMonth > months) {
      next.fgtsAnnual = undefined;
      changed = true;
    } else if (strategies.fgtsAnnual.untilMonth !== undefined && strategies.fgtsAnnual.untilMonth > months) {
      next.fgtsAnnual = { ...strategies.fgtsAnnual, untilMonth: months };
      changed = true;
    }
  }
  if (strategies.recurringExtra) {
    if (strategies.recurringExtra.startMonth > months) {
      next.recurringExtra = undefined;
      changed = true;
    } else if (strategies.recurringExtra.untilMonth !== undefined && strategies.recurringExtra.untilMonth > months) {
      next.recurringExtra = { ...strategies.recurringExtra, untilMonth: months };
      changed = true;
    }
  }
  if (strategies.fixedPayment) {
    if (strategies.fixedPayment.startMonth !== undefined && strategies.fixedPayment.startMonth > months) {
      next.fixedPayment = undefined;
      changed = true;
    } else if (strategies.fixedPayment.untilMonth !== undefined && strategies.fixedPayment.untilMonth > months) {
      next.fixedPayment = { ...strategies.fixedPayment, untilMonth: months };
      changed = true;
    }
  }
  return changed ? next : strategies;
}

export function ratioToPercentPoints(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < 0) throw new Error('Percentual recomendado inválido.');
  if (ratio > 1) throw new Error('Percentual recomendado deve estar entre 0 e 100%.');
  if (ratio === 0) return 0;
  const percentPoints = Math.ceil(ratio * 10_000 - 1e-9) / 100;
  if (percentPoints > 100) throw new Error('Percentual recomendado arredondado excede 100%.');
  return percentPoints;
}

export function nextAporteId(rows: AporteRow[]): number {
  return rows.reduce((largest, row) => Math.max(largest, row.id), 0) + 1;
}

export function applyRecommendedPercent(rows: AporteRow[], ratio: number): AporteRow[] {
  const amount = ratioToPercentPoints(ratio);
  const existingIndex = rows.findIndex((row) => row.tipo === 'pct');
  if (existingIndex === -1) {
    // linha fresca: mês 1, sem limite final, modo termo explícito (não herda
    // modo global de reduzir parcela) e ID novo
    return [
      ...rows,
      { id: nextAporteId(rows), tipo: 'pct', amount, month: 1, every: 12, mode: 'term' },
    ];
  }
  return rows.flatMap((row, index) => {
    if (index === existingIndex) {
      return [{ id: row.id, tipo: 'pct', amount, month: 1, every: row.every, mode: 'term' }];
    }
    return row.tipo === 'pct' ? [] : [row];
  });
}

/** mantém só a primeira linha percentual; duplicatas são descartadas (primeira vence, como `applyRecommendedPercent`) */
export function dedupePctRows(rows: AporteRow[]): AporteRow[] {
  let seen = false;
  const next = rows.filter((row) => {
    if (row.tipo !== 'pct') return true;
    if (seen) return false;
    seen = true;
    return true;
  });
  return next.length === rows.length ? rows : next;
}

export function deriveRows(strategies: Strategies): AporteRow[] {
  let nextId = 1;
  const rows: AporteRow[] = strategies.extraLumpSum.map((l) => ({
    id: nextId++,
    tipo: 'pontual' as const,
    amount: l.amount,
    month: l.month,
    every: 12,
    mode: l.reduceMode,
  }));
  // linha percentual deriva mesmo com valor zero (0%): fica visível/removível
  // e inerte no engine (pctAtivo exige > 0); sumir com ela silenciosamente
  // quebraria o round-trip com rowsToStrategies
  if (strategies.extraMonthlyPct !== undefined) {
    rows.push({
      id: nextId++,
      tipo: 'pct',
      amount: ratioToPercentPoints(strategies.extraMonthlyPct),
      month: strategies.extraMonthlyPctStartMonth ?? 1,
      every: 12,
      untilMonth: strategies.extraMonthlyPctUntilMonth,
      mode: strategies.extraMonthlyPctReduceMode,
    });
  }
  if (strategies.fixedPayment) {
    rows.push({
      id: nextId++,
      tipo: 'mensal',
      amount: strategies.fixedPayment.amount,
      month: strategies.fixedPayment.startMonth ?? 1,
      every: 1,
      untilMonth: strategies.fixedPayment.untilMonth,
      mode: strategies.fixedPayment.reduceMode,
    });
  }
  if (strategies.recurringExtra) {
    rows.push({
      id: nextId++,
      tipo: 'recorrente',
      amount: strategies.recurringExtra.amount,
      month: strategies.recurringExtra.startMonth,
      every: strategies.recurringExtra.every,
      untilMonth: strategies.recurringExtra.untilMonth,
      mode: strategies.recurringExtra.reduceMode,
    });
  }
  if (strategies.paySacParcela) {
    rows.push({ id: nextId++, tipo: 'sac', amount: 0, month: 1, every: 12 });
  }
  if (strategies.fgtsAnnual) {
    rows.push({
      id: nextId++,
      tipo: 'anual',
      amount: strategies.fgtsAnnual.amount,
      month: strategies.fgtsAnnual.startMonth ?? 12,
      every: 12,
      untilMonth: strategies.fgtsAnnual.untilMonth,
      mode: strategies.fgtsAnnual.reduceMode,
    });
  }
  return rows;
}

type RowStrategies = Pick<
  Strategies,
  | 'extraLumpSum'
  | 'extraMonthlyPct'
  | 'extraMonthlyPctStartMonth'
  | 'extraMonthlyPctUntilMonth'
  | 'extraMonthlyPctReduceMode'
  | 'fixedPayment'
  | 'recurringExtra'
  | 'fgtsAnnual'
  | 'paySacParcela'
>;

export function rowStrategiesFingerprint(strategies: Strategies): string {
  return JSON.stringify(rowsToStrategies(deriveRows(strategies)));
}

export function reconcileStrategyRows(
  rows: AporteRow[],
  strategies: Strategies,
  pendingFingerprints: string[]
): { rows: AporteRow[]; fingerprint: string; changed: boolean; pendingFingerprints: string[] } {
  const fingerprint = rowStrategiesFingerprint(strategies);
  const pendingIndex = pendingFingerprints.indexOf(fingerprint);
  if (pendingIndex !== -1) {
    // eco da própria edição local: consumido uma única vez (mesmo fora de ordem)
    return {
      rows,
      fingerprint,
      changed: false,
      pendingFingerprints: pendingFingerprints.filter((_, index) => index !== pendingIndex),
    };
  }
  // mudança externa: sincroniza as linhas e mantém a fila de pendentes, para
  // que ecos atrasados de edições locais anteriores sejam descartados e não
  // revertam a sincronização (a fila é limitada por addPendingFingerprint)
  return { rows: deriveRows(strategies), fingerprint, changed: true, pendingFingerprints };
}

const MAX_PENDING_FINGERPRINTS = 20;

export function addPendingFingerprint(pendingFingerprints: string[], fingerprint: string): string[] {
  return [...pendingFingerprints, fingerprint].slice(-MAX_PENDING_FINGERPRINTS);
}

export function rowsToStrategies(rows: AporteRow[], months?: number): RowStrategies {
  const rowsSafe = months !== undefined ? clampUntilMonths(rows, months) : rows;
  // linhas com valor zero são mantidas (aporte inerte visível na UI): a
  // reconciliação externa não pode fazê-las sumir silenciosamente
  const pctRow = rowsSafe.find((r) => r.tipo === 'pct');
  return {
    extraLumpSum: rowsSafe
      .filter((r) => r.tipo === 'pontual' && r.month >= 1)
      .map((r) => ({ month: r.month, amount: r.amount, ...(r.mode ? { reduceMode: r.mode } : {}) })),
    extraMonthlyPct: pctRow ? pctRow.amount / 100 : undefined,
    extraMonthlyPctStartMonth: pctRow && pctRow.month >= 1 ? pctRow.month : undefined,
    extraMonthlyPctUntilMonth: pctRow?.untilMonth,
    extraMonthlyPctReduceMode: pctRow?.mode,
    fixedPayment: (() => {
      const r = rowsSafe.find((x) => x.tipo === 'mensal');
      if (!r) return undefined;
      return {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      };
    })(),
    recurringExtra: (() => {
      const r = rowsSafe.find((x) => x.tipo === 'recorrente');
      if (!r) return undefined;
      return {
        amount: r.amount,
        every: Math.max(1, r.every),
        startMonth: Math.max(1, r.month),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      };
    })(),
    paySacParcela: rowsSafe.some((x) => x.tipo === 'sac'),
    fgtsAnnual: (() => {
      const r = rowsSafe.find((x) => x.tipo === 'anual');
      if (!r) return undefined;
      return {
        amount: r.amount,
        ...(r.month >= 1 ? { startMonth: r.month } : {}),
        ...(r.untilMonth ? { untilMonth: r.untilMonth } : {}),
        ...(r.mode ? { reduceMode: r.mode } : {}),
      };
    })(),
  };
}
