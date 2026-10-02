import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ access: vi.fn(), contract: vi.fn() }));
vi.mock('@/lib/subscriptions/access', () => ({ hasActiveAccess: mocks.access }));
vi.mock('@/db', () => ({ db: { query: { contracts: { findFirst: mocks.contract } } },
  schema: { contracts: { userId: 'user_id' } } }));
import { canOpenFinancing } from './account-access';

beforeEach(() => { vi.clearAllMocks(); });

it('retains financing navigation when paid access expires but contract remains', async () => {
  mocks.access.mockResolvedValue(false);
  mocks.contract.mockResolvedValue({ id: 'existing-contract' });
  expect(await canOpenFinancing('user')).toBe(true);
});

it('routes a free account without contract to simulations', async () => {
  mocks.access.mockResolvedValue(false);
  mocks.contract.mockResolvedValue(undefined);
  expect(await canOpenFinancing('user')).toBe(false);
});

it('allows unlimited onboarding without an existing contract', async () => {
  mocks.access.mockResolvedValue(true);
  expect(await canOpenFinancing('user')).toBe(true);
  expect(mocks.contract).not.toHaveBeenCalled();
});
