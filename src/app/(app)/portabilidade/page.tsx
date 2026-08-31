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
    <div className="flex w-full flex-1 items-start justify-center bg-muted p-4 sm:p-6">
      <div className="w-full max-w-5xl">
        <PortabilityCalculator isUnlimited={isUnlimited} />
      </div>
    </div>
  );
}
