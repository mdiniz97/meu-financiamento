/** Explicit, bounded event sender. Never sends user-entered form or financing values. */
let identity: string | null = null;

export function setAnalyticsIdentity(value: string | null): void {
  identity = value;
}

export function safeCampaignProperties(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(key);
    if (value && /^[a-zA-Z0-9 _.-]{1,80}$/.test(value)) result[key] = value;
  }
  return result;
}

async function sendEvent(event: '$pageview' | 'cta_clicked', properties: Record<string, string>): Promise<void> {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!identity || !token || !/^https:\/\/(us|eu)\.i\.posthog\.com$/.test(host)) return;
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: identity,
        properties: {
          ...(identity.startsWith('anon:') ? { $process_person_profile: false } : {}),
          ...properties,
        },
      }),
    });
  } catch {
    // Network blockers or analytics downtime must never affect navigation.
  }
}

export function captureBrowserEvent(event: '$pageview', path: string): Promise<void> {
  const pathname = path.split(/[?#]/, 1)[0];
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return Promise.resolve();
  return sendEvent(event, {
    $current_url: pathname,
    ...safeCampaignProperties(new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)),
  });
}

export function captureCtaClick(cta: 'buy_credits' | 'subscribe'): Promise<void> {
  return sendEvent('cta_clicked', { cta });
}
