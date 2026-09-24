import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureBrowserEvent, captureCtaClick, setAnalyticsIdentity, safeCampaignProperties } from './browser';

const originalToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
beforeEach(() => { process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'phc_test'; });
afterEach(() => {
  if (originalToken === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  else process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
  setAnalyticsIdentity(null);
  vi.unstubAllGlobals();
});

describe('consent-gated browser capture', () => {
  it('sends nothing without consent, including when token is configured', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    await captureBrowserEvent('$pageview', '/simulacao');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends path without query or fragment and no referrer header', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', send);
    setAnalyticsIdentity('u1');
    await captureBrowserEvent('$pageview', '/simulacao?cpf=123#section');

    expect(send).toHaveBeenCalledTimes(1);
    const [, options] = send.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.properties.$current_url).toBe('/simulacao');
    expect(options.referrerPolicy).toBe('no-referrer');
    expect(options.body).not.toContain('cpf');
  });

  it('allows only bounded campaign tags', () => {
    const params = new URLSearchParams('utm_source=google&utm_campaign=promo%40email.com&utm_medium=cpc&token=secret');
    expect(safeCampaignProperties(params)).toEqual({ utm_source: 'google', utm_medium: 'cpc' });
  });

  it('records only a named CTA after consent without button text or pack details', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', send);
    await captureCtaClick('buy_credits');
    expect(send).not.toHaveBeenCalled();
    setAnalyticsIdentity('u1');
    await captureCtaClick('buy_credits');
    expect(send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(send.mock.calls[0][1].body);
    expect(payload.event).toBe('cta_clicked');
    expect(payload.properties.cta).toBe('buy_credits');
    expect(payload.properties).not.toHaveProperty('packId');
  });
});
