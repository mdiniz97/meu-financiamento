import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CTA } from '@/components/landing/CTA';
import { AppSidebar } from '@/components/app-sidebar';
import { NegotiationCalculator } from '@/components/simulation/NegotiationCalculator';
import { BreadcrumbJsonLd } from '@/components/seo/breadcrumb-json-ld';
import { BlogSuggestions } from '@/components/landing/BlogSuggestions';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata({
  title: 'Mesa de negociação: taxa máxima, entrada e prazo',
  description:
    'Informe a proposta do banco e o seu teto de parcela: veja se fecha e onde apertar (taxa máxima, entrada mínima e prazo mínimo). Ferramenta gratuita.',
  path: '/negociacao',
});

export default async function NegociacaoPage() {
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  const balance = signedIn && session?.userId ? await getCreditBalance(session.userId) : null;

  const content = (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Início', path: '/' },
          { name: 'Mesa de negociação', path: '/negociacao' },
        ]}
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Mesa de negociação
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Informe a proposta e o teto de parcela: veja se fecha e onde apertar (taxa máxima,
          entrada mínima e prazo mínimo) antes de assinar.
        </p>
        <span className="mt-1 h-1 w-12 rounded-full bg-primary" aria-hidden />
      </div>
      <div className="w-full max-w-4xl">
        <NegotiationCalculator signedIn={signedIn} />
      </div>
      <BlogSuggestions
        title="Leia antes de negociar"
        slugs={['juros-do-financiamento', 'qual-banco-financia-melhor', 'sac-ou-price']}
      />
    </>
  );

  if (signedIn && balance) {
    return (
      <div className="flex min-h-screen flex-col bg-background min-[1024px]:flex-row">
        <AppSidebar credits={balance.credits} isUnlimited={balance.isUnlimited} />
        <main className="flex min-w-0 flex-1 flex-col items-center gap-8 bg-muted p-4 sm:p-6">
          <div className="flex w-full max-w-6xl flex-col items-center gap-8">{content}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header signedIn={false} />
      <main className="flex flex-1 flex-col items-center gap-10 bg-muted p-6">
        <div className="flex w-full max-w-6xl flex-col items-center gap-8">{content}</div>
      </main>
      <CTA signedIn={false} />
      <Footer />
    </div>
  );
}
