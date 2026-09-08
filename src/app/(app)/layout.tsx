import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { getContract } from '@/lib/meu-financiamento/repo';
import { AppSidebar } from '@/components/app-sidebar';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) redirect('/login');
  let credits = 0;
  let isUnlimited = false;
  let showMeuFinanciamento = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    credits = bal.credits;
    isUnlimited = bal.isUnlimited;
    try {
      const contract = await getContract(session.userId);
      showMeuFinanciamento = contract !== null;
    } catch {
      // Contrato inconsistente não pode derrubar a navegação do app.
    }
  }
  return (
    <div className="flex min-h-screen flex-col bg-background min-[1024px]:flex-row">
      <AppSidebar credits={credits} isUnlimited={isUnlimited} showMeuFinanciamento={showMeuFinanciamento} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
