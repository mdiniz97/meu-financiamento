'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { dispatchSignupConversion, type SignupClaim } from '@/lib/ads/dispatch-signup-conversion';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

async function claimFromApi(): Promise<SignupClaim | null> {
  const response = await fetch('/api/ads/signup-conversion/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });
  if (!response.ok || response.status === 204) return null;
  const claim: unknown = await response.json();
  if (!claim || typeof claim !== 'object') return null;
  const { transactionId, claimToken } = claim as Record<string, unknown>;
  return typeof transactionId === 'string' && /^TID_\d+$/.test(transactionId) && typeof claimToken === 'string'
    ? { transactionId, claimToken }
    : null;
}

async function acknowledgeToApi(claimToken: string): Promise<void> {
  const response = await fetch('/api/ads/signup-conversion/ack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimToken }),
  });
  if (!response.ok) throw new Error('Conversion acknowledgement unavailable');
}

export function GoogleAdsSignupConversion() {
  const pathname = usePathname();

  useEffect(() => {
    let stopped = false;
    async function deliver() {
      // afterInteractive initializes the base tag after hydration; no claim
      // should be reserved if its browser API never becomes available.
      for (let attempt = 0; attempt < 20 && !stopped; attempt++) {
        if (typeof window.gtag === 'function') break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (stopped || typeof window.gtag !== 'function') return;
      await dispatchSignupConversion(window.gtag, claimFromApi, acknowledgeToApi);
    }
    void deliver().catch(() => {
      // Ads reporting must not affect page navigation or account access.
    });
    return () => { stopped = true; };
  }, [pathname]);

  return null;
}
