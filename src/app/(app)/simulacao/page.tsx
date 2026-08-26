import { loadSimulation } from './actions';
import { SimulationSandbox } from '@/components/simulation/SimulationSandbox';

export default async function SimulacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  const saved = typeof id === 'string' && id ? await loadSimulation(id) : null;

  return (
    <div className="flex flex-1 bg-[#F5F5F5] p-6">
      <SimulationSandbox saved={saved} />
    </div>
  );
}
