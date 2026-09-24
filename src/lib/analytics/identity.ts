export const ANALYTICS_PREFERENCE = 'amortiza-analytics-consent-v1';
const VISITOR_KEY = 'amortiza-analytics-visitor-v1';
const THIRTY_DAYS = 30 * 86_400_000;

export function isTrackingAllowed(accountConsent: boolean | null, browserPreference: string | null): boolean {
  return accountConsent !== false && browserPreference !== 'declined';
}

export function getVisitorIdentity(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  now = Date.now(),
  randomId = () => crypto.randomUUID()
): string {
  try {
    const saved = JSON.parse(storage.getItem(VISITOR_KEY) ?? 'null') as { id?: unknown; expiresAt?: unknown } | null;
    if (typeof saved?.id === 'string' && saved.id.startsWith('anon:') && typeof saved.expiresAt === 'number' && saved.expiresAt > now) {
      return saved.id;
    }
  } catch {
    // Invalid local data is discarded below.
  }
  const id = `anon:${randomId()}`;
  storage.setItem(VISITOR_KEY, JSON.stringify({ id, expiresAt: now + THIRTY_DAYS }));
  return id;
}
