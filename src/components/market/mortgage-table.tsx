import type { MortgageInstitution, MortgageProduct } from '@/lib/market/bacen';

function formatRate(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function productLabel(product: MortgageProduct): string {
  const type = product.type === 'mercado' ? 'Mercado' : 'Regulada';
  const indexer = product.indexer === 'prefixado' ? 'Prefixado' : product.indexer.toUpperCase();
  return `${type} - ${indexer}`;
}

export function MortgageTable({ institutions }: { institutions: MortgageInstitution[] }) {
  if (institutions.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Dados temporariamente indisponíveis.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Taxas médias contratadas, ordenadas da menor para a maior.
        </p>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          Fonte: BACEN
        </span>
      </div>
      {institutions.map((institution) => (
        <div key={institution.institution} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <h3 className="font-display border-b border-border px-4 py-3 text-sm font-semibold">
            {institution.institution}
          </h3>
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[55%]" />
              <col className="w-[22.5%]" />
              <col className="w-[22.5%]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Modalidade</th>
                <th className="px-4 py-2 text-right font-medium">Taxa a.m.</th>
                <th className="px-4 py-2 text-right font-medium">Taxa a.a.</th>
              </tr>
            </thead>
            <tbody>
              {institution.products.map((product) => (
                <tr key={product.code} className="border-t border-border/60">
                  <td className="px-4 py-2.5">{productLabel(product)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatRate(product.rateMonth)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {formatRate(product.rateYear)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
