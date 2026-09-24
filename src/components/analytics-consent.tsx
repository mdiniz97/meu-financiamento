'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { captureBrowserEvent, captureNavigationClick, setAnalyticsConfig, setAnalyticsIdentity } from '@/lib/analytics/browser';
import { ANALYTICS_PREFERENCE, getVisitorIdentity, isTrackingAllowed } from '@/lib/analytics/identity';

type TrackingState = 'loading' | 'enabled' | 'disabled' | 'unavailable';

export function AnalyticsConsent() {
  const pathname = usePathname();
  const [state, setState] = useState<TrackingState>('loading');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setAnalyticsIdentity(null);

    async function load() {
      try {
        const response = await fetch('/api/analytics-consent', { cache: 'no-store' });
        if (!response.ok) throw new Error('analytics unavailable');
        const result = (await response.json()) as {
          userId: string | null;
          consent: boolean | null;
          analytics: { token: string; host: string };
        };
        if (cancelled) return;
        setAnalyticsConfig(result.analytics.token, result.analytics.host);
        setAccountId(result.userId);

        const local = localStorage.getItem(ANALYTICS_PREFERENCE);
        // Keep an explicit refusal after login, even if another session opted in.
        if (result.userId && local === 'declined' && result.consent !== false) {
          const saved = await fetch('/api/analytics-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consent: false }),
          });
          if (!saved.ok) throw new Error('analytics opt-out unavailable');
        }
        if (cancelled) return;

        if (!isTrackingAllowed(result.consent, local)) {
          localStorage.setItem(ANALYTICS_PREFERENCE, 'declined');
          setState('disabled');
          return;
        }

        setAnalyticsIdentity(result.userId ?? getVisitorIdentity(localStorage));
        setState('enabled');
        void captureBrowserEvent('$pageview', pathname);
      } catch {
        if (!cancelled) setState('unavailable');
      }
    }
    void load();
    return () => { cancelled = true; setAnalyticsIdentity(null); };
  }, [pathname, retry]);

  useEffect(() => {
    const show = () => setOpen(true);
    const trackLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = link?.getAttribute('href');
      // Next Link prevents default navigation before this delegated handler runs.
      if (href) void captureNavigationClick(href, window.location.origin);
    };
    window.addEventListener('analytics-preferences', show);
    document.addEventListener('click', trackLink);
    return () => {
      window.removeEventListener('analytics-preferences', show);
      document.removeEventListener('click', trackLink);
    };
  }, []);

  async function choose(enabled: boolean) {
    setState('loading');
    setAnalyticsIdentity(null);
    if (accountId) {
      try {
        const response = await fetch('/api/analytics-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent: enabled }),
        });
        if (!response.ok) throw new Error('analytics preference unavailable');
      } catch {
        setState('unavailable');
        return;
      }
    }
    localStorage.setItem(ANALYTICS_PREFERENCE, enabled ? 'accepted' : 'declined');
    if (enabled) {
      setAnalyticsIdentity(accountId ?? getVisitorIdentity(localStorage));
      setState('enabled');
      void captureBrowserEvent('$pageview', pathname);
    } else {
      setState('disabled');
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <aside aria-label="Preferências de análise" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-xl border border-border bg-background p-5 shadow-xl" role="dialog">
      <p className="font-semibold">Análise de uso</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Medimos navegação e etapas de uso. Não enviamos formulários, valores ou dados de financiamento.
        Estado: {state === 'enabled' ? 'ativada' : state === 'disabled' ? 'desativada' : 'indisponível'}.
      </p>
      {state === 'unavailable' && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível consultar ou salvar sua escolha.</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {state === 'unavailable' ? (
          <button type="button" onClick={() => { setState('loading'); setRetry((n) => n + 1); }} className="rounded-md border px-4 py-2 text-sm">Tentar novamente</button>
        ) : (
          <>
            <button type="button" disabled={state === 'loading'} onClick={() => void choose(false)} className="rounded-md border px-4 py-2 text-sm">Desativar analytics</button>
            <button type="button" disabled={state === 'loading'} onClick={() => void choose(true)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Ativar analytics</button>
          </>
        )}
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-sm">Fechar</button>
      </div>
    </aside>
  );
}

export function AnalyticsPreferencesButton() {
  return <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event('analytics-preferences'))}>Gerenciar analytics</button>;
}
