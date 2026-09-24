'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { captureBrowserEvent, setAnalyticsIdentity } from '@/lib/analytics/browser';

const PREFERENCE = 'amortiza-analytics-consent-v1';
const ANONYMOUS_ID = 'amortiza-analytics-session-v1';
const configured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
type Status = 'loading' | 'choice' | 'accepted' | 'declined' | 'error';

function anonymousId(): string {
  let id = sessionStorage.getItem(ANONYMOUS_ID);
  if (!id) {
    id = `anon:${crypto.randomUUID()}`;
    sessionStorage.setItem(ANONYMOUS_ID, id);
  }
  return id;
}

export function AnalyticsConsent() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('loading');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    setAnalyticsIdentity(null);
    // Consent is account-scoped when signed in. Re-check on navigation to catch login/logout.
    async function load() {
      try {
        const response = await fetch('/api/analytics-consent', { cache: 'no-store' });
        if (!response.ok) throw new Error('consent unavailable');
        const result = (await response.json()) as { userId: string | null; consent: boolean | null };
        if (cancelled) return;

        let consent = result.consent;
        const local = localStorage.getItem(PREFERENCE);
        if (result.userId && consent === null && (local === 'accepted' || local === 'declined')) {
          const saved = await fetch('/api/analytics-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consent: local === 'accepted' }),
          });
          if (!saved.ok) throw new Error('consent sync failed');
          consent = local === 'accepted';
        }
        if (cancelled) return;
        setAccountId(result.userId);
        const accepted = result.userId ? consent === true : local === 'accepted';
        const declined = result.userId ? consent === false : local === 'declined';
        if (accepted) {
          setAnalyticsIdentity(result.userId ?? anonymousId());
          setStatus('accepted');
          void captureBrowserEvent('$pageview', pathname);
        } else {
          setStatus(declined ? 'declined' : 'choice');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    void load();
    return () => { cancelled = true; setAnalyticsIdentity(null); };
  }, [pathname, retry]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('analytics-preferences', show);
    return () => window.removeEventListener('analytics-preferences', show);
  }, []);

  async function choose(consent: boolean) {
    setStatus('loading');
    setAnalyticsIdentity(null);
    if (accountId) {
      try {
        const response = await fetch('/api/analytics-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent }),
        });
        if (!response.ok) throw new Error('consent save failed');
      } catch {
        setStatus('error');
        return;
      }
    }
    localStorage.setItem(PREFERENCE, consent ? 'accepted' : 'declined');
    if (consent) {
      setAnalyticsIdentity(accountId ?? anonymousId());
      setStatus('accepted');
      void captureBrowserEvent('$pageview', pathname);
    } else {
      sessionStorage.removeItem(ANONYMOUS_ID);
      setStatus('declined');
    }
    setOpen(false);
  }

  if (!configured || (!open && status !== 'choice' && status !== 'error')) return null;
  return (
    <aside aria-label="Preferências de análise" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-xl border border-border bg-background p-5 shadow-xl" role="dialog">
      <p className="font-semibold">Análise de uso</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Podemos medir páginas visitadas e etapas de uso para melhorar o site? Sua escolha não altera o acesso. Não enviamos dados de simulação ou formulário.{' '}
        <Link className="underline" href="/cookies">Saiba mais</Link>.
      </p>
      {status === 'error' && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível consultar ou salvar sua escolha. Tente novamente.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {status === 'error' ? (
          <button type="button" onClick={() => { setStatus('loading'); setRetry((n) => n + 1); }} className="rounded-md border px-4 py-2 text-sm">Tentar novamente</button>
        ) : (
          <>
            <button type="button" disabled={status === 'loading'} onClick={() => void choose(false)} className="rounded-md border px-4 py-2 text-sm">Recusar</button>
            <button type="button" disabled={status === 'loading'} onClick={() => void choose(true)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Aceitar analytics</button>
          </>
        )}
      </div>
    </aside>
  );
}

export function AnalyticsPreferencesButton() {
  return <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event('analytics-preferences'))}>Alterar escolha de analytics</button>;
}
