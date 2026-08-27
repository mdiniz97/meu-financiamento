import { loadSimulation } from './actions';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { SimulationSandbox } from '@/components/simulation/SimulationSandbox';

export default async function SimulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  const saved = typeof id === 'string' && id ? await loadSimulation(id) : null;
  const session = await auth();
  const { isUnlimited } = session?.userId
    ? await getCreditBalance(session.userId)
    : { isUnlimited: false };

  return (
    <div className="flex w-full bg-[#F5F5F5] p-6">
      <SimulationSandbox saved={saved} isUnlimited={isUnlimited} />
    </div>
  );
}
