import Link from 'next/link';
import { redirect } from 'next/navigation';
import { History } from 'lucide-react';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { deleteSimulation, listSimulations } from '../simulacao/actions';
import { deleteComparison, listComparisons } from '../comparar-propostas/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpgradeCard } from '@/components/upgrade-card';
import { Countdown } from '@/components/countdown';
import { PageHeader, PageShell } from '@/components/page-shell';
import { parseSimulationJson } from '@/lib/simulation-context';
import { formatBRL } from '@/lib/utils';

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const FREE_RETENTION_MS = 6 * 60 * 60 * 1000;

type Sim = {
  id: string;
  name: string;
  system: string;
  payload: unknown;
  result: unknown;
  createdAt: Date;
};

function SimulationCard({ sim, isUnlimited }: { sim: Sim; isUnlimited: boolean }) {
  const payload = parseSimulationJson<{ input?: { system?: string; principal?: number } }>(
    sim.payload
  );
  const result = parseSimulationJson<{
    price?: { metrics?: { totalPago?: number } };
    sac?: { metrics?: { totalPago?: number } };
  }>(sim.result);
  const toolRoute =
    sim.system === 'Portabilidade'
      ? '/portabilidade'
      : sim.system === 'Comprar na planta'
        ? '/comprar-na-planta'
        : sim.system === 'Meta de quitação'
          ? '/meta-de-quitacao'
          : sim.system === 'Alugar ou comprar'
            ? '/alugar-ou-comprar'
            : sim.system === 'Consórcio vs financiamento' || sim.system === 'Consórcio vs investir'
              ? '/consorcio-vale-a-pena'
              : null;

  const toolDescription =
    sim.system === 'Portabilidade'
      ? 'Comparação de portabilidade.'
      : sim.system === 'Comprar na planta'
        ? 'Simulação de juros de obra.'
        : sim.system === 'Meta de quitação'
          ? 'Aporte mensal para quitar na meta.'
          : sim.system === 'Alugar ou comprar'
            ? 'Comparação de patrimônio alugando vs comprando.'
            : sim.system === 'Consórcio vs financiamento'
              ? 'Comparação de custo das duas modalidades.'
              : sim.system === 'Consórcio vs investir'
                ? 'Comparação do consórcio com investir a parcela.'
                : '';

  return (
    <Card className="flex flex-col gap-3 rounded-2xl shadow-sm">
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-xs">
            {sim.system}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDate(sim.createdAt)}</span>
        </div>
        <CardTitle className="text-sm">{sim.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {toolRoute === null && payload?.input?.principal != null && (
          <p className="text-xs text-muted-foreground">
            Valor financiado {formatBRL(payload.input.principal)}
          </p>
        )}
        {toolRoute === null && (
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pago PRICE</span>
              <span className="font-mono tabular-nums font-medium">
                {formatBRL(result?.price?.metrics?.totalPago ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pago SAC</span>
              <span className="font-mono tabular-nums font-medium">
                {formatBRL(result?.sac?.metrics?.totalPago ?? 0)}
              </span>
            </div>
          </div>
        )}
        {toolRoute !== null && (
          <p className="text-xs text-muted-foreground">{toolDescription}</p>
        )}
        {!isUnlimited && (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
            <span className="text-xs text-muted-foreground">Salva por 6 horas</span>
            <Countdown expiresAt={sim.createdAt.getTime() + FREE_RETENTION_MS} />
          </div>
        )}
      </CardContent>
      <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-4">
        <Button size="sm" nativeButton={false} render={<Link href={toolRoute ?? `/simulacao?id=${sim.id}`} />}>
          Abrir
        </Button>
        <form action={deleteSimulation.bind(null, sim.id)}>
          <Button type="submit" size="sm" variant="destructive">
            Remover
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default async function MinhasSimulacoesPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  const { isUnlimited } = await getCreditBalance(session.userId);
  const sims = await listSimulations();
  const comparisons = await listComparisons();

  const normais = sims.filter(
    (s) =>
      s.system !== 'Portabilidade' &&
      s.system !== 'Comprar na planta' &&
      s.system !== 'Meta de quitação' &&
      s.system !== 'Alugar ou comprar' &&
      s.system !== 'Consórcio vs financiamento' &&
      s.system !== 'Consórcio vs investir'
  );
  const portabilidades = sims.filter((s) => s.system === 'Portabilidade');
  const obras = sims.filter((s) => s.system === 'Comprar na planta');
  const ferramentas = sims.filter(
    (s) =>
      s.system === 'Meta de quitação' ||
      s.system === 'Alugar ou comprar' ||
      s.system === 'Consórcio vs financiamento' ||
      s.system === 'Consórcio vs investir'
  );

  return (
    <PageShell>
      <PageHeader
        icon={<History className="size-5 text-[#820AD1]" />}
        title="Minhas simulações"
        description={
          sims.length === 0
            ? 'Nenhuma simulação salva ainda.'
            : `${sims.length} item${sims.length === 1 ? '' : 's'} salvo${sims.length === 1 ? '' : 's'}`
        }
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/nova-simulacao" />}>
            Nova simulação
          </Button>
        }
      />
      <UpgradeCard isUnlimited={isUnlimited} />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">Simulações</h2>
        {normais.length === 0 ? (
          <Card className="rounded-2xl p-10 text-center shadow-sm">
            <p className="text-muted-foreground">
              Simule um financiamento e salve para comparar depois.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {normais.map((sim) => (
              <SimulationCard key={sim.id} sim={sim} isUnlimited={isUnlimited} />
            ))}
          </div>
        )}
      </section>

      {portabilidades.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Portabilidade</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portabilidades.map((sim) => (
              <SimulationCard key={sim.id} sim={sim} isUnlimited={isUnlimited} />
            ))}
          </div>
        </section>
      )}

      {obras.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Comprar na planta</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {obras.map((sim) => (
              <SimulationCard key={sim.id} sim={sim} isUnlimited={isUnlimited} />
            ))}
          </div>
        </section>
      )}

      {ferramentas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Ferramentas de decisão</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ferramentas.map((sim) => (
              <SimulationCard key={sim.id} sim={sim} isUnlimited={isUnlimited} />
            ))}
          </div>
        </section>
      )}

      {comparisons.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">Comparações de propostas</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((c) => (
              <Card key={c.id} className="flex flex-col gap-3 rounded-2xl shadow-sm">
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs">Comparação</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                  </div>
                  <CardTitle className="text-sm">{c.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    Melhor proposta: {c.bestBank ?? 'não calculada'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Salva automaticamente, disponível enquanto você for assinante.
                  </p>
                </CardContent>
                <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-4">
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/comparar-propostas?id=${c.id}`} />}
                  >
                    Abrir
                  </Button>
                  <form action={deleteComparison.bind(null, c.id)}>
                    <Button type="submit" size="sm" variant="destructive">
                      Remover
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
