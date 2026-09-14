'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cancelSubscription, reactivateSubscriptionAction } from './actions';

type ManageButtonsProps = {
  cancelAtPeriodEnd: boolean;
  status: string;
};

export function ManageButtons({ cancelAtPeriodEnd, status }: ManageButtonsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  if (cancelAtPeriodEnd) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={pending}
          onClick={() => {
            setError(false);
            startTransition(async () => {
              try {
                await reactivateSubscriptionAction();
              } catch {
                setError(true);
              }
            });
          }}
        >
          {pending ? 'Reativando…' : 'Reativar assinatura'}
        </Button>
        {error && (
          <span className="text-xs text-destructive">
            Não foi possível reativar agora. Tente novamente.
          </span>
        )}
      </div>
    );
  }

  if (status !== 'active' && status !== 'past_due') return null;

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
