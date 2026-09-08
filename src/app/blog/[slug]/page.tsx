import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { ARTIGOS, getArtigo, getArticleReadMinutes } from '@/lib/artigos';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { CTA } from '@/components/landing/CTA';
import { ArticleBody, ArticleHeader } from '@/components/landing/Article';
import { publicMetadata, SITE_NAME, SITE_URL } from '@/lib/site';

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
  if (!artigo) notFound();
  return publicMetadata({
    title: artigo.title,
    description: artigo.description,
    path: `/blog/${artigo.slug}`,
    modifiedTime: artigo.updatedAt,
  });
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
  const url = `${SITE_URL}/blog/${artigo.slug}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: artigo.title,
        description: artigo.description,
        url,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        dateModified: artigo.updatedAt,
        inLanguage: 'pt-BR',
        image: `${SITE_URL}/opengraph-image`,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
          { '@type': 'ListItem', position: 3, name: artigo.title, item: url },
        ],
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
      <main className="flex flex-1 flex-col items-center gap-10 bg-muted p-6">
        <div className="flex w-full max-w-4xl flex-col gap-8">
          <ArticleHeader artigo={artigo} />
          <article className="min-w-0 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
            <ArticleBody artigo={artigo} />
          </article>
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
                  <span className="text-xs text-muted-foreground">{getArticleReadMinutes(s)} min de leitura</span>
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
