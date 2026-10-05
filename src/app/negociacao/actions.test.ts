import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ auth: vi.fn(), findMany: vi.fn() }));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({
  db: { query: { simulations: { findMany: m.findMany } } },
  schema: { simulations: { userId: 'simulations.user_id', system: 'simulations.system' } },
}));
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
}));

import { listNegotiations } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: 'u1' });
  m.findMany.mockResolvedValue([
    { id: 'n1', name: 'Caixa', payload: {}, result: {}, createdAt: new Date('2026-10-01T00:00:00Z') },
    { id: 'n2', name: 'Itaú', payload: {}, result: {}, createdAt: new Date('2026-10-02T00:00:00Z') },
  ]);
});

describe('listNegotiations', () => {
  it('retorna as negociações do usuário, mais recentes primeiro', async () => {
    const rows = await listNegotiations();
    expect(rows.map((r) => r.id)).toEqual(['n2', 'n1']);
    expect(m.findMany).toHaveBeenCalled();
  });
  it('retorna vazio sem sessão', async () => {
    m.auth.mockResolvedValue(null);
    expect(await listNegotiations()).toEqual([]);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});
