import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { loginHref } from '@/lib/login-redirect';
import { PATHNAME_HEADER } from '@/lib/request-path';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { AppSidebar } from '@/components/app-sidebar';
import { TrialOfferProvider } from '@/components/trial/trial-offer';
import { getTrialState } from '@/lib/trial/state';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function remainingTrialDays(endsAt: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86400000));
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) {
    // `loginHref` sanitiza: só caminho interno relativo passa.
    const pathname = (await headers()).get(PATHNAME_HEADER) ?? undefined;
    redirect(loginHref(pathname));
  }
  const [bal, trial] = await Promise.all([
    getCreditBalance(session.userId),
    getTrialState(session.userId),
  ]);
  return (
    <TrialOfferProvider canOffer={trial.offerAvailable} autoOpen={trial.showModal}>
      <div className="flex min-h-screen flex-col bg-background min-[1024px]:flex-row">
        <AppSidebar credits={bal.credits} isUnlimited={bal.isUnlimited} trialEndsAt={trial.isTrialActive && trial.trialEndsAt ? remainingTrialDays(trial.trialEndsAt) : undefined} />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </TrialOfferProvider>
  );
}
