import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CTA } from '@/components/landing/CTA';
import { AppSidebar } from '@/components/app-sidebar';
import { UpgradeBanner } from '@/components/upgrade-banner';
import { getMarketOverview } from '@/lib/market/bacen';
import { MarketContent } from '@/components/market/market-content';

export default async function JurosPage() {
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  const data = await getMarketOverview();

  if (signedIn) {
    const balance = await getCreditBalance(session!.userId);
    return (
      <div className="flex min-h-screen flex-col bg-background min-[1024px]:flex-row">
        <AppSidebar credits={balance.credits} isUnlimited={balance.isUnlimited} />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex w-full flex-col items-center gap-2 bg-muted p-4 pb-0 sm:p-6 sm:pb-0">
            <div className="w-full max-w-6xl">
              <UpgradeBanner isUnlimited={balance.isUnlimited} />
            </div>
          </div>
          <MarketContent data={data} contained />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header signedIn={false} />
      <main className="flex-1">
        <MarketContent data={data} />
        <CTA signedIn={false} />
      </main>
      <Footer />
    </div>
  );
}
