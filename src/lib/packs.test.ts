import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PACKS, seedPacks } from '../../scripts/seed-packs.mjs';

describe('seedPacks', () => {
  it('insere créditos e assinatura sem sobrescrever packs existentes', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 2 });

    await seedPacks({ query });

    expect(DEFAULT_PACKS).toEqual([
      { id: 'credits5', name: '5 créditos', priceCents: 1000, credits: 5, isSubscription: false },
      { id: 'unlimited', name: 'Ilimitado', priceCents: 11990, credits: null, isSubscription: true },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(query.mock.calls[0][1]).toEqual([
      'credits5',
      '5 créditos',
      1000,
      5,
      false,
      'unlimited',
      'Ilimitado',
      11990,
      null,
      true,
    ]);
  });
});
