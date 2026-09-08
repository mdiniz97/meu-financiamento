import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ARTIGOS, getArticleReadMinutes } from '@/lib/artigos';

export function BlogSuggestions({
  slugs,
  title = 'Continue aprendendo',
}: {
  slugs: string[];
  title?: string;
}) {
  const artigos = slugs
    .map((slug) => ARTIGOS.find((a) => a.slug === slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  if (artigos.length === 0) return null;

  return (
    <section aria-label={title} className="flex w-full max-w-4xl flex-col gap-4">
      <h2 className="text-center font-display text-xl font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {artigos.map((artigo) => (
          <Link
            key={artigo.slug}
            href={`/blog/${artigo.slug}`}
            className="group flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
          >
            <span className="font-display text-sm font-semibold leading-snug">{artigo.title}</span>
            <span className="text-xs text-muted-foreground">{getArticleReadMinutes(artigo)} min de leitura</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#820AD1]">
              Ler <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
