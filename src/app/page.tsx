import type { Metadata } from "next";
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
import { BlogPreview } from "@/components/landing/BlogPreview";
import { StatsBar } from "@/components/landing/StatsBar";
import { CTA } from "@/components/landing/CTA";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { publicMetadata, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { login, signup } = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const isAuthState = first(login) === '1' || first(signup) === '1';
  const meta = publicMetadata({
    title: 'Simulador de financiamento imobiliário SAC e PRICE',
    description: SITE_DESCRIPTION,
    path: '/',
  });
  // `?login=1` / `?signup=1` são estado de UI (modal aberto), não páginas: não
  // devem ser indexados nem disputar canônica com a home limpa.
  if (!isAuthState) return meta;
  return { ...meta, alternates: undefined, robots: { index: false, follow: false } };
}

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: 'pt-BR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
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
        <BlogPreview />
        <StatsBar />
        <FAQ />
        <CTA signedIn={signedIn} />
      </main>
      <Footer />
    </div>
  );
}
