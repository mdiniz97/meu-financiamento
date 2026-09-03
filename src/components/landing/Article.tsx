import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';
import type { Article } from '@/lib/artigos';
import { buttonVariants } from '@/components/ui/button';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ArticleBody({ artigo }: { artigo: Article }) {
  return (
    <div className="flex flex-col gap-4">
      {artigo.blocks.map((block, index) => {
        if (block.type === 'h2') {
          return (
            <h2 key={index} className="mt-2 font-display text-xl font-semibold">
              {block.text}
            </h2>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={index} className="list-disc space-y-1.5 pl-5 text-sm sm:text-base">
              {block.items?.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          );
        }
        if (block.type === 'note') {
          return (
            <div key={index} className="rounded-2xl border border-[#820AD1]/30 bg-primary/[0.04] p-4 text-sm">
              {block.text}
            </div>
          );
        }
        return (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {block.text}
          </p>
        );
      })}

      <div className="mt-4 flex justify-center">
        <Link href={artigo.cta.href} className={buttonVariants({ size: 'lg' })}>
          {artigo.cta.label} <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function ArticleHeader({ artigo }: { artigo: Article }) {
  return (
    <div className="flex flex-col gap-3 text-center">
      <h1 className="mx-auto max-w-3xl font-display text-2xl font-bold tracking-tight sm:text-4xl">
        {artigo.title}
      </h1>
      <p className="mx-auto flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Calendar className="size-3.5" /> {formatDate(artigo.updatedAt)} · {artigo.readMinutes} min de leitura
      </p>
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
        {artigo.description}
      </p>
    </div>
  );
}
