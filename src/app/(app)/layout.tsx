import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { loginHref } from '@/lib/login-redirect';
import { PATHNAME_HEADER } from '@/lib/request-path';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { AppSidebar } from '@/components/app-sidebar';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) {
    // `loginHref` sanitiza: só caminho interno relativo passa.
    const pathname = (await headers()).get(PATHNAME_HEADER) ?? undefined;
    redirect(loginHref(pathname));
  }
  let credits = 0;
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    credits = bal.credits;
    isUnlimited = bal.isUnlimited;
  }
  return (
    <div className="flex min-h-screen flex-col bg-background min-[1024px]:flex-row">
      <AppSidebar credits={credits} isUnlimited={isUnlimited} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
