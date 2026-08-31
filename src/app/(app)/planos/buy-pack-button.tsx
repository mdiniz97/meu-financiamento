'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, ZapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BuyPackButton({ packId, label }: { packId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json().catch(() => null)) as {
        checkoutUrl?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.checkoutUrl) {
        setError(data?.error ?? 'Erro ao iniciar compra');
        return;
      }
      if (data.checkoutUrl.startsWith('/')) {
        router.push(data.checkoutUrl);
      } else {
        window.location.assign(data.checkoutUrl);
      }
    } catch {
      setError('Erro de rede ao iniciar compra');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={buy} disabled={busy} className="w-full">
        {busy ? (
          'Aguarde...'
        ) : (
          <>
            {packId === 'unlimited' ? (
              <ZapIcon className="size-4" />
            ) : (
              <Coins className="size-4" />
            )}
            {label}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
