import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { deleteSimulation, listSimulations } from '../simulacao/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBRL } from '@/lib/utils';

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
  } catch {
    return null;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function MinhasSimulacoesPage() {
  const session = await auth();
  if (!session?.userId) redirect('/login');

  const sims = await listSimulations();

  return (
    <div className="flex flex-1 flex-col gap-6 bg-[#F5F5F5] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Minhas simulações</h1>
          <p className="text-sm text-muted-foreground">
            {sims.length === 0
              ? 'Nenhuma simulação salva ainda.'
              : `${sims.length} simulação${sims.length === 1 ? '' : 'ões'} salva${sims.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/nova-simulacao" />}>
          Nova simulação
        </Button>
      </div>

      {sims.length === 0 ? (
        <Card className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-muted-foreground">
            Simule um financiamento e salve para comparar depois.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sims.map((sim) => {
            const payload = parseJson<{ input?: { system?: string; principal?: number } }>(
              sim.payload
            );
            const result = parseJson<{
              price?: { metrics?: { totalPago?: number } };
              sac?: { metrics?: { totalPago?: number } };
            }>(sim.result);
            return (
              <Card key={sim.id} className="flex flex-col gap-3 rounded-2xl bg-white shadow-sm">
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {sim.system}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(sim.createdAt)}
                    </span>
                  </div>
                  <CardTitle className="text-sm">{sim.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {payload?.input?.principal != null && (
                    <p className="text-xs text-muted-foreground">
                      Valor financiado {formatBRL(payload.input.principal)}
                    </p>
                  )}
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total pago PRICE</span>
                      <span className="font-medium">
                        {formatBRL(result?.price?.metrics?.totalPago ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total pago SAC</span>
                      <span className="font-medium">
                        {formatBRL(result?.sac?.metrics?.totalPago ?? 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
                <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-4">
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/simulacao?id=${sim.id}`} />}
                  >
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
          })}
        </div>
      )}
    </div>
  );
}
