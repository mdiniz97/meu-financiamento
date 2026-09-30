'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { activateTrialAction } from '@/app/(app)/trial/actions';
import { useTrialOffer } from '@/components/trial/trial-offer';

export function TrialOfferActions() {
  const router = useRouter();
  const offer = useTrialOffer();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function activate() {
    setError('');
    startTransition(async () => {
      try {
        const result = await activateTrialAction();
        if (result.status === 'activated' || result.status === 'already_used') {
          router.refresh();
          return;
        }
        setError(result.status === 'offer_expired'
          ? 'Prazo de 48 horas encerrado.'
          : 'Oferta indisponível para esta conta.');
        router.refresh();
      } catch {
        setError('Não foi possível ativar. Tente novamente.');
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-10" disabled={pending} onClick={activate}>Ativar 7 dias grátis</Button>
        {offer && (
          <Button type="button" variant="outline" className="h-10" onClick={offer.open}>Ver oferta do trial</Button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
