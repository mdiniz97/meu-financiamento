import type { MarketOverview } from '@/lib/market/bacen';
import { Card } from '@/components/ui/card';
import { Indicators } from '@/components/market/indicators';
import { HistoryChart } from '@/components/market/history-chart';
import { MortgageTable } from '@/components/market/mortgage-table';

const BACEN_SOURCE = 'Fonte: Banco Central do Brasil (BACEN).';

export function MarketContent({
  data,
  landing = false,
  contained = false,
}: {
  data: MarketOverview;
  landing?: boolean;
  contained?: boolean;
}) {
  const hasAnyData =
    data.indicators.selic !== null ||
    data.indicators.ipca !== null ||
    data.indicators.tr !== null ||
    data.history.length > 0 ||
    data.mortgage.length > 0;

  const inner = (
    <>
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Juros de mercado
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Selic, inflação e TR atualizados, além das taxas médias dos financiamentos
          imobiliários por instituição.
        </p>
        <p className="mx-auto max-w-2xl text-xs text-muted-foreground">{BACEN_SOURCE}</p>
      </div>

      {!hasAnyData ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Dados temporariamente indisponíveis. Volte em instantes.
        </p>
      ) : (
        <>
          <section aria-labelledby="juros-indicadores">
              <div className="mb-4">
                <h2 id="juros-indicadores" className="font-display text-xl font-semibold">
                  Indicadores do mês
                </h2>
                <p className="text-sm text-muted-foreground">
                  Variação mensal, acumulado no ano e acumulado em 12 meses, do BACEN
                  {data.updatedAt ? ` · referência ${data.updatedAt}` : ''}.
                </p>
              </div>
              <Indicators data={data} />
            </section>

            <section aria-labelledby="juros-historico">
              <div className="mb-4">
                <h2 id="juros-historico" className="font-display text-xl font-semibold">
                  Histórico de 12 meses
                </h2>
                <p className="text-sm text-muted-foreground">
                  Evolução mensal de Selic, IPCA e TR, do BACEN.
                </p>
              </div>
              {data.history.length > 0 ? (
                <HistoryChart data={data.history} />
              ) : (
                <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Dados temporariamente indisponíveis.
                </p>
              )}
            </section>

            <section aria-labelledby="juros-imobiliarios">
              <div className="mb-4">
                <h2 id="juros-imobiliarios" className="font-display text-xl font-semibold">
                  Taxas imobiliárias por instituição
                </h2>
                <p className="text-sm text-muted-foreground">
                  Última publicação do BACEN (média dos 5 dias úteis anteriores).
                </p>
              </div>
              {data.mortgage.length > 0 ? (
                <MortgageTable institutions={data.mortgage} />
              ) : (
                <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Dados temporariamente indisponíveis.
                </p>
              )}
              {data.mortgage.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  As taxas são médias das operações efetivamente contratadas por cada
                  instituição nos cinco dias úteis da publicação, divulgadas pelo BACEN, não
                  são a taxa que o banco vai oferecer a você, que depende do seu perfil e
                  negociação.
                </p>
              )}
            </section>
          </>
        )}
    </>
  );

  return (
    <div className={`flex w-full flex-col items-center p-4 sm:p-6 ${landing ? 'bg-background' : 'bg-muted'}`}>
      {contained ? (
        <Card className="w-full max-w-6xl rounded-2xl p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-8">{inner}</div>
        </Card>
      ) : (
        <div className="flex w-full max-w-6xl flex-col gap-8">{inner}</div>
      )}
    </div>
  );
}
