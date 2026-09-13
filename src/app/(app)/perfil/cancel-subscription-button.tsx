'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cancelSubscription } from './actions';

export function CancelSubscriptionButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              'Cancelar a renovação? Você mantém o acesso até o fim do período já pago.'
            )
          ) {
            return;
          }
          setError(false);
          startTransition(async () => {
            try {
              await cancelSubscription();
            } catch {
              setError(true);
            }
          });
        }}
      >
        {pending ? 'Cancelando…' : 'Cancelar assinatura'}
      </Button>
      {error && (
        <span className="text-xs text-destructive">
          Não foi possível cancelar agora. Tente novamente.
        </span>
      )}
    </div>
  );
}
