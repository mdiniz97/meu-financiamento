import { auth } from '@/auth';
import { AppHeader } from '@/components/app-header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <>
      <AppHeader signedIn={Boolean(session?.userId)} />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
