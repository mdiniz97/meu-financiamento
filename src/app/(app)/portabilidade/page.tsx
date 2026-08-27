import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { PortabilityCalculator } from '@/components/simulation/PortabilityCalculator';

export default async function PortabilidadePage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    isUnlimited = bal.isUnlimited;
  }
  return (
    <div className="flex flex-1 items-start justify-center bg-[#F5F5F5] p-6">
      <div className="w-full max-w-3xl">
        <PortabilityCalculator isUnlimited={isUnlimited} />
      </div>
    </div>
  );
}
