import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';
import { getArticleReadMinutes, type Article } from '@/lib/artigos';
import { buttonVariants } from '@/components/ui/button';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ArticleBody({ artigo }: { artigo: Article }) {
  const sections = artigo.blocks.flatMap((block, index) =>
    block.type === 'h2' ? [{ id: `secao-${index + 1}`, title: block.text }] : []
  );
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Neste artigo" className="mb-2 rounded-2xl border border-border bg-muted/50 p-4 sm:p-5">
        <p className="mb-3 font-display text-base font-semibold">Neste artigo</p>
        <ol className="grid list-decimal gap-x-8 gap-y-2 pl-5 text-sm sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id} className="min-w-0 pl-1">
              <a href={`#${section.id}`} className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-purple-300">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {artigo.blocks.map((block, index) => {
        if (block.type === 'h2') {
          return (
            <h2 id={`secao-${index + 1}`} key={index} className="mt-4 scroll-mt-24 font-display text-xl font-semibold">
              {block.text}
            </h2>
          );
        }
        if (block.type === 'h3') {
          return (
            <h3 key={index} className="mt-2 font-display text-base font-semibold sm:text-lg">{block.text}</h3>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type;
          return (
            <List key={index} className={`${block.type === 'ul' ? 'list-disc' : 'list-decimal'} space-y-2 pl-5 text-sm leading-relaxed sm:text-base`}>
              {block.items.map((item, i) => <li key={i}>{item}</li>)}
            </List>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={index} tabIndex={0} role="region" aria-label={block.caption} className="max-w-full overflow-x-auto rounded-xl border border-border outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <table className="w-full text-left text-sm">
                <caption className="border-b border-border bg-muted/50 px-4 py-3 text-left font-medium text-foreground">{block.caption}</caption>
                <thead>
                  <tr>
                    {block.headers.map((header, i) => <th key={i} scope="col" className="border-b border-border px-4 py-3 font-semibold">{header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {row.map((cell, j) => j === 0
                        ? <th key={j} scope="row" className="px-4 py-3 font-medium">{cell}</th>
                        : <td key={j} className="px-4 py-3 tabular-nums">{cell}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'links') {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5 text-sm sm:text-base">
              {block.items.map((item) => (
                <li key={item.href}><Link href={item.href} className="text-primary underline underline-offset-4 dark:text-purple-300">{item.label}</Link></li>
              ))}
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

      <section aria-labelledby="fontes-artigo" className="mt-4 flex flex-col gap-3 border-t border-border pt-6">
        <h2 id="fontes-artigo" className="font-display text-lg font-semibold">Fontes e referências</h2>
        <p className="text-xs text-muted-foreground">
          Referências consultadas na revisão de {formatDate(artigo.updatedAt)}. Normas, tarifas e condições comerciais podem mudar.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {artigo.sources.map((source) => (
            <li key={source.href}><a href={source.href} className="break-words text-primary underline underline-offset-4 dark:text-purple-300">{source.label}</a></li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Conteúdo educativo. Exemplos não são ofertas de crédito nem recomendação individual de investimento; confira os dados do seu contrato e as regras aplicáveis.
        </p>
      </section>

      <div className="mt-4 flex justify-center">
        <Link href={artigo.cta.href} className={`${buttonVariants({ size: 'lg' })} h-auto min-h-9 max-w-full whitespace-normal py-2 text-center`}>
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
      <p className="mx-auto flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <Calendar className="size-3.5" />
        <span>Atualizado em <time dateTime={artigo.updatedAt}>{formatDate(artigo.updatedAt)}</time></span>
        <span>· {getArticleReadMinutes(artigo)} min de leitura</span>
      </p>
      <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
        {artigo.description}
      </p>
    </div>
  );
}
