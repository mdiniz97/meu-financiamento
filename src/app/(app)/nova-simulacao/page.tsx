import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { WizardForm } from '@/components/simulation/WizardForm';
import { SmartCalculator } from '@/components/simulation/SmartCalculator';

export default async function NovaSimulacaoPage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    isUnlimited = bal.isUnlimited;
  }
  return (
    <div className="flex flex-1 items-start justify-center bg-[#F5F5F5] p-6">
      <div className="grid w-full max-w-5xl items-start gap-6 lg:grid-cols-2">
        <WizardForm />
        <SmartCalculator isUnlimited={isUnlimited} />
      </div>
    </div>
  );
}
