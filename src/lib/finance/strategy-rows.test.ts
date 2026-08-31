import { describe, expect, it } from 'vitest';
import {
  applyRecommendedPercent,
  clampUntilMonths,
  clampStrategyUntilMonths,
  dedupePctRows,
  deriveRows,
  nextAporteId,
  normalizeAporteRowType,
  addPendingFingerprint,
  ratioToPercentPoints,
  reconcileStrategyRows,
  rowsToStrategies,
  rowStrategiesFingerprint,
  type AporteRow,
} from './strategy-rows';
import type { Strategies } from './types';

const EMPTY: Strategies = { extraLumpSum: [], reduceMode: 'term' };

describe('strategy row adapter', () => {
  it.each(['pontual', 'sac'] as const)(
    'descarta janela ao mudar para tipo %s e não a restaura em tipo recorrente',
    (destination) => {
      const monthly: AporteRow = {
        id: 1,
        tipo: 'mensal',
        amount: 5000,
        month: 1,
        every: 1,
        untilMonth: 10,
      };

      const normalized = normalizeAporteRowType(monthly, destination);
      expect(normalized).toEqual({ id: 1, tipo: destination, amount: 5000, month: 1, every: 1 });
      expect(normalizeAporteRowType(normalized, 'recorrente').untilMonth).toBeUndefined();
    }
  );
  it('converte razão para pontos percentuais com duas casas', () => {
    expect(ratioToPercentPoints(0.1417)).toBe(14.17);
    expect(ratioToPercentPoints(0.141701)).toBe(14.18);
  });

  it('absorve ruído de ponto flutuante abaixo de 1e-9 ao arredondar para cima', () => {
    expect(ratioToPercentPoints(0.10000000000001)).toBe(10);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.01])(
    'rejeita razão percentual inválida: %s',
    (ratio) => {
      expect(() => ratioToPercentPoints(ratio)).toThrow('Percentual recomendado inválido.');
    }
  );

  it('rejeita recomendação acima de 100% com erro acionável', () => {
    expect(() => ratioToPercentPoints(1.01)).toThrow('Percentual recomendado deve estar entre 0 e 100%.');
  });

  it('substitui primeiro aporte percentual, remove duplicados e preserva outras linhas', () => {
    const rows: AporteRow[] = [
      { id: 7, tipo: 'pontual', amount: 5000, month: 6, every: 12 },
      { id: 8, tipo: 'pct', amount: 5, month: 3, every: 12, untilMonth: 24, mode: 'payment' },
      { id: 8, tipo: 'mensal', amount: 4000, month: 2, every: 1 },
      { id: 8, tipo: 'pct', amount: 8, month: 4, every: 12 },
    ];

    expect(applyRecommendedPercent(rows, 0.1417)).toEqual([
      rows[0],
      { id: rows[1].id, tipo: 'pct', amount: 14.17, month: 1, every: rows[1].every, mode: 'term' },
      rows[2],
    ]);
  });

  it('recomendação remove início tardio, limite final e modo de redução herdado', () => {
    const rows: AporteRow[] = [
      { id: 3, tipo: 'pct', amount: 5, month: 24, every: 12, untilMonth: 60, mode: 'payment' },
    ];

    expect(applyRecommendedPercent(rows, 0.1417)).toEqual([
      { id: 3, tipo: 'pct', amount: 14.17, month: 1, every: 12, mode: 'term' },
    ]);
  });

  it('distingue mudança externa do eco da última edição local', () => {
    const initial = { ...EMPTY, extraMonthlyPct: 0.05 };
    const external = { ...EMPTY, extraMonthlyPct: 0.2, fixedPayment: { amount: 12000 } };
    const externalRows = deriveRows(external);
    const edited = rowsToStrategies(externalRows.map((row) =>
      row.tipo === 'pct' ? { ...row, amount: 25 } : row
    ));

    expect(rowStrategiesFingerprint(external)).not.toBe(rowStrategiesFingerprint(initial));
    expect(rowStrategiesFingerprint({ ...external, ...edited })).toBe(
      rowStrategiesFingerprint({ ...external, extraMonthlyPct: 0.25 })
    );
    expect(edited.fixedPayment).toMatchObject(external.fixedPayment!);
  });

  it('aplica substituição externa e edição seguinte preserva estratégia externa', () => {
    const initial = { ...EMPTY, extraMonthlyPct: 0.05 };
    const external = { ...EMPTY, extraMonthlyPct: 0.2, fixedPayment: { amount: 12000 } };
    const synchronized = reconcileStrategyRows(
      deriveRows(initial),
      external,
      []
    );
    const editedRows = synchronized.rows.map((row) =>
      row.tipo === 'pct' ? { ...row, amount: 25 } : row
    );
    const edited = { ...external, ...rowsToStrategies(editedRows) };

    expect(synchronized.changed).toBe(true);
    expect(synchronized.rows).toMatchObject([
      { tipo: 'pct', amount: 20 },
      { tipo: 'mensal', amount: 12000 },
    ]);
    expect(edited.extraMonthlyPct).toBe(0.25);
    expect(edited.fixedPayment).toMatchObject({ amount: 12000 });
  });

  it('ignora ecos A e B fora de ordem e sincroniza mudança externa C', () => {
    const a = { ...EMPTY, extraMonthlyPct: 0.1 };
    const b = { ...EMPTY, extraMonthlyPct: 0.2 };
    const c = { ...EMPTY, extraMonthlyPct: 0.3 };
    let pending: string[] = [];
    pending = addPendingFingerprint(pending, rowStrategiesFingerprint(a));
    pending = addPendingFingerprint(pending, rowStrategiesFingerprint(b));

    const echoA = reconcileStrategyRows(deriveRows(b), a, pending);
    const echoB = reconcileStrategyRows(echoA.rows, b, echoA.pendingFingerprints);
    const externalC = reconcileStrategyRows(echoB.rows, c, echoB.pendingFingerprints);

    expect(echoA.changed).toBe(false);
    expect(echoA.rows).toMatchObject([{ amount: 20 }]);
    expect(echoB.changed).toBe(false);
    expect(echoB.rows).toMatchObject([{ amount: 20 }]);
    expect(externalC.changed).toBe(true);
    expect(externalC.rows).toMatchObject([{ amount: 30 }]);
    expect(externalC.pendingFingerprints).toEqual([]);
  });

  it('eco atrasado de edição local não reverte sincronização externa posterior', () => {
    const a = { ...EMPTY, extraMonthlyPct: 0.1 };
    const c = { ...EMPTY, extraMonthlyPct: 0.3 };
    let pending: string[] = [];
    pending = addPendingFingerprint(pending, rowStrategiesFingerprint(a));

    // mudança externa C chega antes do eco de A
    const externalC = reconcileStrategyRows(deriveRows(a), c, pending);
    expect(externalC.changed).toBe(true);
    expect(externalC.rows).toMatchObject([{ amount: 30 }]);

    // eco atrasado de A: consumido como pendente, linhas continuam as de C
    const echoA = reconcileStrategyRows(externalC.rows, a, externalC.pendingFingerprints);
    expect(echoA.changed).toBe(false);
    expect(echoA.rows).toMatchObject([{ amount: 30 }]);
    expect(echoA.pendingFingerprints).toEqual([]);
  });

  it('limita fila de fingerprints pendentes', () => {
    let pending: string[] = [];
    for (let index = 0; index < 40; index++) pending = addPendingFingerprint(pending, String(index));
    expect(pending.length).toBeLessThanOrEqual(20);
    expect(pending.at(-1)).toBe('39');
  });

  it('deriva IDs sequenciais determinísticos sem estado global', () => {
    const strategies: Strategies = {
      ...EMPTY,
      extraLumpSum: [{ month: 2, amount: 1000 }, { month: 4, amount: 2000 }],
      extraMonthlyPct: 0.1417,
      fixedPayment: { amount: 5000 },
      recurringExtra: { amount: 3000, every: 6, startMonth: 3 },
      paySacParcela: true,
      fgtsAnnual: { amount: 10000 },
    };

    const first = deriveRows(strategies);
    const second = deriveRows(strategies);

    expect(first).toEqual(second);
    expect(first.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(nextAporteId(first)).toBe(8);
  });

  it('calcula próximo ID acima do máximo atual', () => {
    const rows: AporteRow[] = [
      { id: 4, tipo: 'pontual', amount: 1, month: 1, every: 12 },
      { id: 9, tipo: 'pontual', amount: 2, month: 2, every: 12 },
      { id: 9, tipo: 'mensal', amount: 3, month: 1, every: 1 },
    ];

    expect(nextAporteId(rows)).toBe(10);
  });

  it('limpa todos os campos percentuais quando linha percentual não existe', () => {
    expect(rowsToStrategies([])).toMatchObject({
      extraMonthlyPct: undefined,
      extraMonthlyPctStartMonth: undefined,
      extraMonthlyPctUntilMonth: undefined,
      extraMonthlyPctReduceMode: undefined,
    });
  });

  it('adiciona aporte percentual no mês 1 quando não existe', () => {
    const rows: AporteRow[] = [
      { id: 4, tipo: 'pontual', amount: 5000, month: 6, every: 12 },
    ];

    expect(applyRecommendedPercent(rows, 0.1)).toEqual([
      rows[0],
      { id: 5, tipo: 'pct', amount: 10, month: 1, every: 12, mode: 'term' },
    ]);
  });

  it('linha recomendada nova é fresca: mês 1, sem até o mês, modo termo explícito', () => {
    const rows: AporteRow[] = [
      { id: 4, tipo: 'pontual', amount: 5000, month: 6, every: 12 },
    ];

    const applied = applyRecommendedPercent(rows, 0.1)[1];

    expect(applied.month).toBe(1);
    expect(applied.untilMonth).toBeUndefined();
    expect(applied.mode).toBe('term');
    expect(applied.id).toBe(5);
  });

  it('rehidrata percentual com duas casas e preserva round-trip da razão', () => {
    const rows = deriveRows({ ...EMPTY, extraMonthlyPct: 0.1417 });

    expect(rows).toMatchObject([{ tipo: 'pct', amount: 14.17 }]);
    expect(rowsToStrategies(rows).extraMonthlyPct).toBe(0.1417);
  });

  it('preserva estratégias controladas no round-trip completo', () => {
    const strategies: Strategies = {
      ...EMPTY,
      extraLumpSum: [{ month: 2, amount: 1000, reduceMode: 'payment' }],
      extraMonthlyPct: 0.1417,
      extraMonthlyPctStartMonth: 3,
      extraMonthlyPctUntilMonth: 24,
      extraMonthlyPctReduceMode: 'payment',
      fixedPayment: { amount: 5000, startMonth: 2, untilMonth: 40, reduceMode: 'term' },
      recurringExtra: { amount: 3000, every: 6, startMonth: 4, untilMonth: 50, reduceMode: 'payment' },
      fgtsAnnual: { amount: 10000, startMonth: 12, untilMonth: 120, reduceMode: 'term' },
      paySacParcela: true,
    };

    expect(rowsToStrategies(deriveRows(strategies))).toEqual({
      extraLumpSum: strategies.extraLumpSum,
      extraMonthlyPct: strategies.extraMonthlyPct,
      extraMonthlyPctStartMonth: strategies.extraMonthlyPctStartMonth,
      extraMonthlyPctUntilMonth: strategies.extraMonthlyPctUntilMonth,
      extraMonthlyPctReduceMode: strategies.extraMonthlyPctReduceMode,
      fixedPayment: strategies.fixedPayment,
      recurringExtra: strategies.recurringExtra,
      fgtsAnnual: strategies.fgtsAnnual,
      paySacParcela: true,
    });
  });
});

describe('clamp de até o mês no prazo do contrato (fix5b)', () => {
  it('clampa linha com até o mês além do prazo e preserva as demais', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'mensal', amount: 5000, month: 1, every: 1, untilMonth: 400 },
      { id: 2, tipo: 'pct', amount: 5, month: 1, every: 12, untilMonth: 360 },
      { id: 3, tipo: 'pontual', amount: 5000, month: 6, every: 12 },
    ];

    const clamped = clampUntilMonths(rows, 360);

    expect(clamped[0]).toMatchObject({ id: 1, untilMonth: 360 });
    expect(clamped[1]).toBe(rows[1]); // igual ao prazo: mesma referência
    expect(clamped[2]).toBe(rows[2]); // sem até o mês: mesma referência
  });

  it('não muda nada quando nada passa do prazo (mesma referência)', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'mensal', amount: 5000, month: 1, every: 1, untilMonth: 300 },
    ];

    expect(clampUntilMonths(rows, 360)).toBe(rows);
  });

  it('prazo inválido não clampa nada', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'mensal', amount: 5000, month: 1, every: 1, untilMonth: 400 },
    ];

    expect(clampUntilMonths(rows, 0)).toBe(rows);
    expect(clampUntilMonths(rows, Number.NaN)).toBe(rows);
  });

  it('legado salvo com até o mês 400 em contrato de 360 clampa nas quatro janelas', () => {
    const legacy: Strategies = {
      ...EMPTY,
      extraMonthlyPctUntilMonth: 400,
      fgtsAnnual: { amount: 10000, untilMonth: 400 },
      recurringExtra: { amount: 3000, every: 1, startMonth: 1, untilMonth: 400 },
      fixedPayment: { amount: 12000, untilMonth: 400 },
    };

    const clamped = clampStrategyUntilMonths(legacy, 360);

    expect(clamped).not.toBe(legacy);
    expect(clamped.extraMonthlyPctUntilMonth).toBe(360);
    expect(clamped.fgtsAnnual!.untilMonth).toBe(360);
    expect(clamped.recurringExtra!.untilMonth).toBe(360);
    expect(clamped.fixedPayment!.untilMonth).toBe(360);
  });

  it('estratégia dentro do prazo mantém identidade (sem re-render em vão)', () => {
    const safe: Strategies = { ...EMPTY, fixedPayment: { amount: 12000, untilMonth: 360 } };

    expect(clampStrategyUntilMonths(safe, 360)).toBe(safe);
    expect(clampStrategyUntilMonths(safe, 0)).toBe(safe);
    expect(clampStrategyUntilMonths(EMPTY, 360)).toBe(EMPTY);
  });

  it('rowsToStrategies com prazo clampa antes de armazenar (defesa)', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'mensal', amount: 5000, month: 1, every: 1, untilMonth: 400 },
    ];

    expect(rowsToStrategies(rows, 360).fixedPayment).toMatchObject({ untilMonth: 360 });
    expect(rowsToStrategies(rows).fixedPayment).toMatchObject({ untilMonth: 400 });
  });
});

describe('linhas percentuais duplicadas (fix wave M2)', () => {
  it('mantém só a primeira linha percentual e preserva as demais', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pct', amount: 5, month: 3, every: 12, mode: 'payment' },
      { id: 2, tipo: 'pct', amount: 8, month: 4, every: 12 },
      { id: 3, tipo: 'pontual', amount: 1000, month: 6, every: 12 },
    ];

    expect(dedupePctRows(rows)).toEqual([rows[0], rows[2]]);
  });

  it('sem duplicatas mantém a mesma referência', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pct', amount: 5, month: 3, every: 12 },
      { id: 2, tipo: 'pontual', amount: 1000, month: 6, every: 12 },
    ];

    expect(dedupePctRows(rows)).toBe(rows);
  });

  it('engine usa a primeira linha percentual após dedupe (sem linha obsoleta)', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pct', amount: 5, month: 3, every: 12, mode: 'payment' },
      { id: 2, tipo: 'pct', amount: 8, month: 4, every: 12 },
    ];

    const strategies = rowsToStrategies(dedupePctRows(rows));

    expect(strategies.extraMonthlyPct).toBe(0.05);
    expect(strategies.extraMonthlyPctStartMonth).toBe(3);
    expect(strategies.extraMonthlyPctReduceMode).toBe('payment');
  });

  it('primeira linha com valor zero também vence (semântica de primeira linha)', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pct', amount: 0, month: 1, every: 12 },
      { id: 2, tipo: 'pct', amount: 8, month: 4, every: 12 },
    ];

    expect(dedupePctRows(rows)).toEqual([rows[0]]);
  });
});

describe('mês inicial além do prazo: linha é removida, não deslocada (fix wave final B)', () => {
  it('remove linha com mês de início além do prazo em vez de aportar no último mês', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pontual', amount: 5000, month: 400, every: 12 },
      { id: 2, tipo: 'mensal', amount: 2000, month: 500, every: 1, untilMonth: 400 },
      { id: 3, tipo: 'recorrente', amount: 1000, month: 370, every: 6 },
      { id: 4, tipo: 'pontual', amount: 3000, month: 12, every: 12 },
    ];

    const clamped = clampUntilMonths(rows, 360);

    expect(clamped).toEqual([
      { id: 4, tipo: 'pontual', amount: 3000, month: 12, every: 12 },
    ]);
  });

  it('mês inicial no último mês do prazo é mantido (só remove acima do prazo)', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pontual', amount: 5000, month: 360, every: 12 },
      { id: 2, tipo: 'mensal', amount: 2000, month: 300, every: 1 },
    ];

    expect(clampUntilMonths(rows, 360)).toBe(rows);
  });

  it('mês dentro do prazo mantém a mesma referência', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pontual', amount: 5000, month: 300, every: 12 },
    ];

    expect(clampUntilMonths(rows, 360)).toBe(rows);
  });

  it('legado com mês inicial 400 é removido nas quatro janelas de estratégia', () => {
    const legacy: Strategies = {
      ...EMPTY,
      extraMonthlyPct: 0.1,
      extraMonthlyPctStartMonth: 400,
      fgtsAnnual: { amount: 10000, startMonth: 400 },
      recurringExtra: { amount: 3000, every: 1, startMonth: 400 },
      fixedPayment: { amount: 12000, startMonth: 400 },
    };

    const clamped = clampStrategyUntilMonths(legacy, 360);

    expect(clamped).not.toBe(legacy);
    expect(clamped.extraMonthlyPct).toBeUndefined();
    expect(clamped.extraMonthlyPctStartMonth).toBeUndefined();
    expect(clamped.fgtsAnnual).toBeUndefined();
    expect(clamped.recurringExtra).toBeUndefined();
    expect(clamped.fixedPayment).toBeUndefined();
  });

  it('janela com início além do prazo é removida mesmo com até o mês válido', () => {
    const legacy: Strategies = {
      ...EMPTY,
      fixedPayment: { amount: 12000, startMonth: 400, untilMonth: 360 },
    };

    expect(clampStrategyUntilMonths(legacy, 360).fixedPayment).toBeUndefined();
  });

  it('janela sem início explícito clampa só o até o mês (início default fica)', () => {
    const legacy: Strategies = {
      ...EMPTY,
      extraMonthlyPct: 0.1,
      extraMonthlyPctStartMonth: 100,
      extraMonthlyPctUntilMonth: 400,
    };

    const clamped = clampStrategyUntilMonths(legacy, 360);

    expect(clamped.extraMonthlyPct).toBe(0.1);
    expect(clamped.extraMonthlyPctStartMonth).toBe(100);
    expect(clamped.extraMonthlyPctUntilMonth).toBe(360);
  });

  it('mês inicial e até o mês dentro do prazo mantêm identidade', () => {
    const safe: Strategies = { ...EMPTY, fixedPayment: { amount: 12000, startMonth: 24, untilMonth: 360 } };

    expect(clampStrategyUntilMonths(safe, 360)).toBe(safe);
  });
});

describe('linhas com valor zero permanecem visíveis e reconciliam sem sumir (fix wave final D)', () => {
  it('rowsToStrategies mantém linha pontual com valor zero', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pontual', amount: 0, month: 6, every: 12 },
    ];

    expect(rowsToStrategies(rows).extraLumpSum).toEqual([{ month: 6, amount: 0 }]);
  });

  it('rowsToStrategies mantém linha fixa com valor zero', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'mensal', amount: 0, month: 2, every: 1 },
    ];

    expect(rowsToStrategies(rows).fixedPayment).toEqual({ amount: 0, startMonth: 2 });
  });

  it('linha percentual com valor zero deriva e faz round-trip estável (visível e removível)', () => {
    const strategies: Strategies = { ...EMPTY, extraMonthlyPct: 0 };

    const rows = deriveRows(strategies);
    expect(rows).toMatchObject([{ tipo: 'pct', amount: 0, month: 1 }]);
    expect(rowsToStrategies(rows).extraMonthlyPct).toBe(0);
    expect(rowStrategiesFingerprint(strategies)).toBe(rowStrategiesFingerprint({ ...EMPTY, extraMonthlyPct: 0 }));
  });

  it('reconciliação externa preserva linha percentual zero (não é descartada)', () => {
    const zero: Strategies = { ...EMPTY, extraMonthlyPct: 0, extraMonthlyPctStartMonth: 3 };

    const synchronized = reconcileStrategyRows(deriveRows(EMPTY), zero, []);

    expect(synchronized.changed).toBe(true);
    expect(synchronized.rows).toMatchObject([{ tipo: 'pct', amount: 0, month: 3 }]);
    expect(rowsToStrategies(synchronized.rows).extraMonthlyPct).toBe(0);
  });

  it('edição local em outra linha não apaga linha com valor zero do round-trip', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pct', amount: 0, month: 1, every: 12 },
      { id: 2, tipo: 'pontual', amount: 5000, month: 6, every: 12 },
    ];

    const edited = rows.map((row) =>
      row.tipo === 'pontual' ? { ...row, amount: 8000 } : row
    );
    const strategies = rowsToStrategies(edited);

    expect(strategies.extraMonthlyPct).toBe(0);
    expect(deriveRows({ ...EMPTY, ...strategies })).toMatchObject([
      { tipo: 'pontual', amount: 8000, month: 6 },
      { tipo: 'pct', amount: 0, month: 1 },
    ]);
  });

  it('primeira linha com valor zero também vence no dedupe e reconcilia', () => {
    const rows: AporteRow[] = [
      { id: 1, tipo: 'pct', amount: 0, month: 1, every: 12 },
      { id: 2, tipo: 'pct', amount: 8, month: 4, every: 12 },
    ];

    const strategies = rowsToStrategies(dedupePctRows(rows));
    expect(strategies.extraMonthlyPct).toBe(0);
  });
});
