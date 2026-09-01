import type { MarketOverview } from '@/lib/market/bacen';

function formatRate(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function IndicatorCard({
  name,
  description,
  indicator,
}: {
  name: string;
  description: string;
  indicator: MarketOverview['indicators']['selic'];
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          Fonte: BACEN
        </span>
      </div>
      {indicator ? (
        <>
          <span className="font-mono tabular-nums mt-2 text-3xl font-bold tracking-tight">
            {formatRate(indicator.value)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">{indicator.unit}</span>
          </span>
          <span className="text-xs text-muted-foreground">Referência: {indicator.month}</span>
          <dl className="mt-3 flex flex-col gap-1 border-t border-border/60 pt-3 text-sm">
            {indicator.annualRate !== null && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Taxa anual (a.a.)</dt>
                <dd className="font-semibold font-mono tabular-nums">{formatRate(indicator.annualRate)}%</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Acumulado no ano</dt>
              <dd className="font-semibold font-mono tabular-nums">
                {indicator.accumulatedYear === null
                  ? '-'
                  : `${formatRate(indicator.accumulatedYear)}%`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Acumulado 12 meses</dt>
              <dd className="font-semibold font-mono tabular-nums">
                {indicator.accumulated12Months === null
                  ? '-'
                  : `${formatRate(indicator.accumulated12Months)}%`}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Dados temporariamente indisponíveis.</p>
      )}
    </div>
  );
}

export function Indicators({ data }: { data: MarketOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <IndicatorCard name="Selic" description="Taxa básica de juros" indicator={data.indicators.selic} />
      <IndicatorCard name="IPCA" description="Inflação oficial" indicator={data.indicators.ipca} />
      <IndicatorCard name="TR" description="Taxa referencial" indicator={data.indicators.tr} />
    </div>
  );
}
