import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(), getPageData: vi.fn(), recomputeState: vi.fn(), getCreditBalance: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/meu-financiamento/repo', () => ({ getPageData: m.getPageData, recomputeState: m.recomputeState }));
vi.mock('@/lib/credits', () => ({ getCreditBalance: m.getCreditBalance }));
vi.mock('@/lib/market/bacen', () => ({ getSelicAnnual: vi.fn().mockResolvedValue(0.105) }));
vi.mock('@/components/meu-financiamento/dashboard', () => ({
  Dashboard: ({ readOnly }: { readOnly: boolean }) => createElement('div', null, readOnly ? 'frozen-dashboard' : 'editable-dashboard'),
}));
vi.mock('@/components/meu-financiamento/onboarding-wizard', () => ({
  OnboardingWizard: () => createElement('div', null, 'onboarding-wizard'),
}));
vi.mock('@/components/exclusive-card', () => ({
  ExclusiveCard: () => createElement('div', null, 'exclusive-card'),
}));

import Page from './page';

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ userId: 'user-1' });
  m.getPageData.mockResolvedValue({ contract: null, draft: null });
  m.getCreditBalance.mockResolvedValue({ credits: 0, isUnlimited: false });
});

describe('Meu financiamento page states', () => {
  it('shows the paywall without a contract or unlimited access', async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('exclusive-card');
    expect(html).toContain('Exclusivo do Plano Ilimitado');
    expect(html).toContain('max-w-5xl');
    expect(html).toContain('data-slot="card-header"');
    expect(html).toContain('data-slot="card-content"');
    expect(html).not.toContain('onboarding-wizard');
  });

  it('shows onboarding for an unlimited user without a contract', async () => {
    m.getCreditBalance.mockResolvedValue({ credits: 0, isUnlimited: true });
    expect(renderToStaticMarkup(await Page())).toContain('onboarding-wizard');
  });

  it('preserves the frozen dashboard after access expires', async () => {
    m.getPageData.mockResolvedValue({ contract: { id: 'contract-1' }, draft: null });
    m.recomputeState.mockResolvedValue({ isUnlimited: false });
    expect(renderToStaticMarkup(await Page())).toContain('frozen-dashboard');
  });

  it.each(['data', 'recompute', 'balance'])('shows a safe error after %s lookup fails', async (failure) => {
    m.getCreditBalance.mockResolvedValue({ credits: 0, isUnlimited: true });
    if (failure === 'data') m.getPageData.mockRejectedValue(new Error('DB unavailable'));
    if (failure === 'recompute') {
      m.getPageData.mockResolvedValue({ contract: { id: 'contract-1' }, draft: null });
      m.recomputeState.mockRejectedValue(new Error('Invalid state'));
    }
    if (failure === 'balance') m.getCreditBalance.mockRejectedValue(new Error('DB unavailable'));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('Não foi possível carregar seu financiamento');
    expect(html).not.toContain('onboarding-wizard');
    expect(html).not.toContain('exclusive-card');
  });
});
