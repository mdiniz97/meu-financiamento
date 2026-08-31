import { auth } from '@/auth';
import { SmartCalculatorExperience } from '@/components/simulation/SmartCalculatorExperience';
import { getCreditBalance } from '@/lib/credits';

export default async function AmortizadorInteligentePage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const balance = await getCreditBalance(session.userId);
    isUnlimited = balance.isUnlimited;
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center bg-muted p-4 sm:p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <SmartCalculatorExperience isUnlimited={isUnlimited} />
      </div>
    </div>
  );
}
