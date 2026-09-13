'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, ZapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startSubscription } from '@/app/assinar/actions';

export function BuyPackButton({
  packId,
  label,
  isSubscription = false,
}: {
  packId: string;
  label: string;
  isSubscription?: boolean;
}) {
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

  // Assinatura: usa a server action como <form action> — o Next trata o
  // redirect ao checkout hospedado sem passar por try/catch (que exibiria um
  // falso "erro de rede" mesmo com a navegação funcionando).
  if (isSubscription) {
    return (
      <form action={startSubscription} className="w-full">
        <Button type="submit" className="w-full">
          <ZapIcon className="size-4" />
          {label}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={buy} disabled={busy} className="w-full">
        {busy ? (
          'Aguarde...'
        ) : (
          <>
            <Coins className="size-4" />
            {label}
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
