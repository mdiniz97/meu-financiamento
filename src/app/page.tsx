import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { TrustRow } from "@/components/landing/TrustRow";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SystemsExplain } from "@/components/landing/SystemsExplain";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { StatsBar } from "@/components/landing/StatsBar";
import { CTA } from "@/components/landing/CTA";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustRow />
        <HowItWorks />
        <SystemsExplain />
        <DashboardPreview />
        <PricingPreview />
        <StatsBar />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
