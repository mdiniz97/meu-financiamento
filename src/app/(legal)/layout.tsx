import { auth } from '@/auth';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { getCreditBalance } from '@/lib/credits';

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  const unlimited =
    signedIn && session?.userId ? (await getCreditBalance(session.userId)).isUnlimited : false;

  return (
    <div className="flex flex-1 flex-col">
      <Header signedIn={signedIn} unlimited={unlimited} />
      <main className="flex-1 bg-muted px-4 py-12 sm:px-6">
        <article className="mx-auto max-w-3xl space-y-8 border border-border bg-card p-6 text-sm leading-7 text-foreground sm:p-10 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
