import { auth } from "@/auth";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { TrustRow } from "@/components/landing/TrustRow";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SystemsExplain } from "@/components/landing/SystemsExplain";
import { ObraExplain } from "@/components/landing/ObraExplain";
import { InvestExplain } from "@/components/landing/InvestExplain";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { StatsBar } from "@/components/landing/StatsBar";
import { CTA } from "@/components/landing/CTA";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  return (
    <div className="flex flex-1 flex-col">
      <Header signedIn={signedIn} />
      <main className="flex-1">
        <Hero signedIn={signedIn} />
        <TrustRow />
        <HowItWorks />
        <SystemsExplain />
        <ObraExplain signedIn={signedIn} />
        <InvestExplain signedIn={signedIn} />
        <DashboardPreview />
        <PricingPreview signedIn={signedIn} />
        <StatsBar />
        <FAQ />
        <CTA signedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
