import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ARTIGOS } from '@/lib/artigos';

export function BlogPreview() {
  return (
    <section aria-labelledby="blog-titulo" className="flex w-full justify-center bg-background py-14">
      <div className="flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#820AD1]">Blog</p>
            <h2 id="blog-titulo" className="font-display text-2xl font-bold sm:text-3xl">
              Aprenda antes de assinar o contrato
            </h2>
          </div>
          <Link
            href="/blog"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#820AD1] hover:underline"
          >
            Ver todos os artigos <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ARTIGOS.slice(0, 3).map((artigo) => (
            <Link
              key={artigo.slug}
              href={`/blog/${artigo.slug}`}
              className="group flex flex-col gap-2 rounded-2xl border border-border bg-muted/50 p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <h3 className="font-display text-lg font-semibold leading-snug">{artigo.title}</h3>
              <p className="flex-1 text-sm text-muted-foreground">{artigo.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#820AD1]">
                Ler artigo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
