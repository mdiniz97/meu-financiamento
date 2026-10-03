import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loginHref } from '@/lib/login-redirect';
import { auth } from '@/auth';
import { hasActivePaidAccess } from '@/lib/subscriptions/access';
import { requireBillingCycle } from '@/lib/subscriptions/plans';
import { AutoStartCheckout } from './auto-start-checkout';

export const metadata: Metadata = {
  title: 'Assinar Ilimitado',
  robots: { index: false, follow: false },
};

/**
 * /assinar não é mais uma tela de decisão: o CTA já leva o ciclo escolhido.
 * Aqui só resolvemos sessão/acesso e disparamos o checkout automaticamente.
 * Usada (a) pelo CTA da landing para quem ainda não tinha sessão, após o
 * login/cadastro, e (b) como fallback quando outro checkout já está pendente.
 */
export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ cycle?: string; pending?: string }> }) {
  const query = await searchParams;
  const cycle = requireBillingCycle(query.cycle ?? 'YEARLY');
  const session = await auth();
  if (!session?.userId) redirect(loginHref(`/assinar?cycle=${cycle}`));

  // Só assinatura paga ativa manda para o perfil; o trial pode contratar.
  if (await hasActivePaidAccess(session.userId)) redirect('/perfil');

  if (query.pending) {
    return (
      <div className="flex w-full flex-1 items-center justify-center bg-muted p-6">
        <p role="status" className="max-w-md text-center text-sm text-muted-foreground">
          Checkout em processamento ou aberto para outro período. Aguarde a confirmação antes de
          iniciar uma nova contratação. Se persistir, contate o suporte.
        </p>
      </div>
    );
  }

  return <AutoStartCheckout cycle={cycle} />;
}
