import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { ARTIGOS, getArtigo } from '@/lib/artigos';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CTA } from '@/components/landing/CTA';
import { ArticleBody, ArticleHeader } from '@/components/landing/Article';

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTIGOS.map((artigo) => ({ slug: artigo.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artigo = getArtigo(slug);
  if (!artigo) return {};
  return {
    title: artigo.title,
    description: artigo.description,
    openGraph: { title: artigo.title, description: artigo.description },
  };
}

export default async function ArtigoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artigo = getArtigo(slug);
  if (!artigo) notFound();
  const session = await auth();
  const signedIn = Boolean(session?.userId);
  const sugestoes = ARTIGOS.filter((a) => a.slug !== artigo.slug).slice(0, 3);

  return (
    <div className="flex flex-1 flex-col">
      <Header signedIn={signedIn} />
      <main className="flex flex-1 flex-col items-center gap-10 bg-muted p-6">
        <div className="flex w-full max-w-4xl flex-col gap-8">
          <ArticleHeader artigo={artigo} />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
            <ArticleBody artigo={artigo} />
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-center font-display text-xl font-semibold">Continue aprendendo</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {sugestoes.map((s) => (
                <Link
                  key={s.slug}
                  href={`/blog/${s.slug}`}
                  className="group flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
                >
                  <span className="font-display text-sm font-semibold leading-snug">{s.title}</span>
                  <span className="text-xs text-muted-foreground">{s.readMinutes} min de leitura</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#820AD1]">
                    Ler <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <CTA signedIn={signedIn} />
      <Footer />
    </div>
  );
}
