'use client';

import { useEffect, useRef } from 'react';
import { startSubscription } from './actions';
import { Button } from '@/components/ui/button';
import type { BillingCycle } from '@/lib/subscriptions/plans';

/**
 * Entrada direta ao checkout: a página /assinar não é uma tela de decisão.
 * O usuário já escolheu o ciclo no CTA; aqui só disparamos a reserva e o
 * redirect ao checkout hospedado do Asaas, sem confirmação intermediária.
 * O submit do form usa o mesmo caminho da action (o Next trata o redirect).
 */
export function AutoStartCheckout({ cycle }: { cycle: BillingCycle }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <div className="flex w-full flex-1 items-center justify-center p-6">
      <form ref={formRef} action={startSubscription.bind(null, cycle)} className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
        <p>Redirecionando para o pagamento seguro…</p>
        <Button type="submit" variant="outline" size="sm">
          Continuar para o pagamento
        </Button>
      </form>
    </div>
  );
}
