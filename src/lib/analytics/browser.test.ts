import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureBrowserEvent, captureCtaClick, captureNavigationClick, setAnalyticsIdentity, setAnalyticsConfig, safeCampaignProperties } from './browser';

beforeEach(() => { setAnalyticsConfig('phc_test', 'https://us.i.posthog.com'); });
afterEach(() => {
  setAnalyticsIdentity(null);
  setAnalyticsConfig('', '');
  vi.unstubAllGlobals();
});

describe('controlled browser capture', () => {
  it('captures with public token supplied by runtime endpoint even when build lacked env', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '');
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', send);
    setAnalyticsIdentity('u1');
    setAnalyticsConfig('phc_runtime', 'https://us.i.posthog.com');

    await captureBrowserEvent('$pageview', '/juros');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('https://us.i.posthog.com/i/v0/e/');
    expect(JSON.parse(send.mock.calls[0][1].body).api_key).toBe('phc_runtime');
  });
  it('sends nothing without an active visitor identity', async () => {
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

  it('keeps only referring site origin, never referring URL or search terms', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', send);
    vi.stubGlobal('document', { referrer: 'https://busca.example/busca?term=cpf' });
    setAnalyticsIdentity('u1');
    await captureBrowserEvent('$pageview', '/juros');
    const payload = JSON.parse(send.mock.calls[0][1].body);
    expect(payload.properties.$referrer).toBe('https://busca.example');
    expect(send.mock.calls[0][1].body).not.toContain('cpf');
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

  it('records internal link destinations without queries and ignores external destinations', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', send);
    setAnalyticsIdentity('u1');
    setAnalyticsConfig('phc_runtime', 'https://us.i.posthog.com');

    await captureNavigationClick('/juros?email=pessoa@example.com', 'https://amortiza.me');
    await captureNavigationClick('https://outro.example/cadastro', 'https://amortiza.me');

    expect(send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(send.mock.calls[0][1].body);
    expect(payload).toMatchObject({ event: 'navigation_clicked', properties: { destination_path: '/juros' } });
    expect(send.mock.calls[0][1].body).not.toContain('pessoa');
    expect(send.mock.calls[0][1].keepalive).toBe(true);
  });
});
