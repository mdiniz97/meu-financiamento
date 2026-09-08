import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/auth';
import { ARTIGOS } from '@/lib/artigos';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CTA } from '@/components/landing/CTA';
import { publicMetadata } from '@/lib/site';

export const metadata = publicMetadata({
  title: 'Blog sobre financiamento imobiliário e amortização',
  description:
    'Guias sobre SAC e PRICE, juros, amortização, portabilidade e custos da compra de imóveis. Entenda conceitos e compare cenários com as calculadoras.',
  path: '/blog',
});

export default async function BlogPage() {
  const session = await auth();
  const signedIn = Boolean(session?.userId);

  return (
    <div className="flex flex-1 flex-col">
      <Header signedIn={signedIn} />
      <main className="flex flex-1 flex-col items-center gap-10 bg-muted p-6">
        <div className="flex w-full max-w-6xl flex-col items-center gap-10">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Blog</h1>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
              Aprenda como funciona o financiamento imobiliário e use as ferramentas com os seus
              números.
            </p>
          </div>
          <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ARTIGOS.map((artigo) => (
              <Link
                key={artigo.slug}
                href={`/blog/${artigo.slug}`}
                className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
              >
                <h2 className="font-display text-lg font-semibold leading-snug">
                  {artigo.title}
                </h2>
                <p className="flex-1 text-sm text-muted-foreground">{artigo.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#820AD1]">
                  Ler artigo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <CTA signedIn={signedIn} />
      <Footer />
    </div>
  );
}
