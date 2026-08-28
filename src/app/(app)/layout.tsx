import { auth } from '@/auth';
import { AppHeader } from '@/components/app-header';
import { ForceLightTheme } from '@/components/force-light-theme';

// See ForceLightTheme for why this isn't a nested next-themes <ThemeProvider
// forcedTheme="light"> — that pattern is a documented no-op when nested.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <>
      <ForceLightTheme />
      <AppHeader signedIn={Boolean(session?.userId)} />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
