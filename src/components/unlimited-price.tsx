import { formatBRL } from '@/lib/utils';

export function UnlimitedPrice({ priceCents = 11990 }: { priceCents?: number }) {
  const savings = 19990 - priceCents;
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {savings > 0 && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
            Economize {formatBRL(savings / 100)}
          </span>
        )}
        <span className="text-xs font-semibold text-primary">Oferta por tempo limitado</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="whitespace-nowrap text-sm font-semibold text-muted-foreground">
          De <del className="font-mono text-xl decoration-2">{formatBRL(199.9)}</del>
        </span>
        <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-primary">Por</span>
          <span className="font-mono text-3xl font-extrabold tracking-tight text-primary">{formatBRL(priceCents / 100)}</span>
          <span className="text-sm font-medium text-muted-foreground">/ano</span>
        </span>
      </div>
    </div>
  );
}
