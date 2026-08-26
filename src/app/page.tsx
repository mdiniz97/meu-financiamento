import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SystemsExplain } from "@/components/landing/SystemsExplain";
import { PricingPreview } from "@/components/landing/PricingPreview";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <SystemsExplain />
        <PricingPreview />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
