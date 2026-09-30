import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), assertSameOrigin: vi.fn(), activateTrial: vi.fn(), markTrialOfferSeen: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/security/same-origin', () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock('@/lib/trial/activate', () => ({
  activateTrial: mocks.activateTrial, markTrialOfferSeen: mocks.markTrialOfferSeen,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { activateTrialAction, markTrialOfferSeenAction } from './actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'signed-in-user' });
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.activateTrial.mockResolvedValue({ status: 'activated', endsAt: new Date('2026-10-08T00:00:00Z') });
});

describe('trial actions', () => {
  it('activates only for the authenticated user and refreshes account pages', async () => {
    expect(await activateTrialAction()).toMatchObject({ status: 'activated' });
    expect(mocks.activateTrial).toHaveBeenCalledWith('signed-in-user');
    expect(mocks.assertSameOrigin).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/perfil');
  });

  it('rejects unauthenticated and cross-origin calls before writes', async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(activateTrialAction()).rejects.toThrow('Não autenticado');
    expect(mocks.activateTrial).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ userId: 'signed-in-user' });
    mocks.assertSameOrigin.mockRejectedValue(new Error('same-origin: origem divergente'));
    await expect(activateTrialAction()).rejects.toThrow('same-origin: origem divergente');
    expect(mocks.activateTrial).not.toHaveBeenCalled();
  });

  it('records dismissed/visible modal only for current session user', async () => {
    await markTrialOfferSeenAction();
    expect(mocks.markTrialOfferSeen).toHaveBeenCalledWith('signed-in-user');
    expect(mocks.assertSameOrigin).toHaveBeenCalledTimes(1);
  });
});
