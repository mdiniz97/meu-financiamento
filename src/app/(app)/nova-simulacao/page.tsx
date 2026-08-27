import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { WizardForm } from '@/components/simulation/WizardForm';

export default async function NovaSimulacaoPage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    isUnlimited = bal.isUnlimited;
  }
  return (
    <div className="flex flex-1 items-start justify-center bg-[#F5F5F5] p-6">
      <WizardForm isUnlimited={isUnlimited} />
    </div>
  );
}
