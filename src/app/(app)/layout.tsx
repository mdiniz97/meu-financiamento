import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { AppHeader } from '@/components/app-header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let credits = 0;
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    credits = bal.credits;
    isUnlimited = bal.isUnlimited;
  }
  return (
    <>
      <AppHeader
        signedIn={Boolean(session?.userId)}
        credits={credits}
        isUnlimited={isUnlimited}
      />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
