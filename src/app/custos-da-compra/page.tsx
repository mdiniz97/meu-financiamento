import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CTA } from '@/components/landing/CTA';
import { AppSidebar } from '@/components/app-sidebar';
import { getContract } from '@/lib/meu-financiamento/repo';
import { CompraCustosCalculator } from '@/components/simulation/CompraCustosCalculator';
import { BlogSuggestions } from '@/components/landing/BlogSuggestions';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata({
  title: 'Custos da compra de imóvel: entrada, ITBI e cartório',
  description:
    'Calcule uma estimativa de entrada, ITBI, escritura, registro e despesas extras para comprar seu imóvel. Calculadora gratuita, sem cadastro obrigatório.',
  path: '/custos-da-compra',
});

export default async function CustosDaCompraPage() {
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  const balance = signedIn && session?.userId ? await getCreditBalance(session.userId) : null;

  const content = (
    <>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Quanto preciso para comprar?
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Além do financiamento, a compra exige entrada, ITBI, escritura e registro. Descubra o
          total que precisa ter em mãos.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <CompraCustosCalculator />
      </div>
      <BlogSuggestions
        title="Leia sobre a compra do imóvel"
        slugs={['quanto-preciso-para-comprar', 'juros-do-financiamento', 'sac-ou-price']}
      />
    </>
  );

  if (signedIn && balance) {
    const showMeuFinanciamento = (await getContract(session!.userId)) !== null;
    return (
      <div className="flex min-h-screen flex-col bg-background min-[1024px]:flex-row">
        <AppSidebar credits={balance.credits} isUnlimited={balance.isUnlimited} showMeuFinanciamento={showMeuFinanciamento} />
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
