'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function ActivationRedeemButton() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'busy' | 'invalid' | 'error'>('idle');

  async function redeem() {
    setStatus('busy');
    try {
      const response = await fetch('/api/activation-bonus/redeem', { method: 'POST' });
      const data = await response.json() as { status: string };
      if (data.status === 'redeemed' || data.status === 'already_redeemed') {
        router.refresh();
        return;
      }
      setStatus('invalid');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" disabled={status === 'busy'} onClick={redeem}>
        {status === 'busy' ? 'Resgatando...' : 'Resgatar 2 créditos'}
      </Button>
      {status === 'invalid' && <p role="alert">Link indisponível para esta conta. Confira sua conta ou abra novamente o link recebido.</p>}
      {status === 'error' && <p role="alert">Não foi possível concluir. Tente novamente.</p>}
    </div>
  );
}
