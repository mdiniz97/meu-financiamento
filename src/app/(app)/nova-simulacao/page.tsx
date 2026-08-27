import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { NovaSimulacaoClient } from '@/components/simulation/NovaSimulacaoClient';

export default async function NovaSimulacaoPage() {
  const session = await auth();
  let isUnlimited = false;
  if (session?.userId) {
    const bal = await getCreditBalance(session.userId);
    isUnlimited = bal.isUnlimited;
  }
  return <NovaSimulacaoClient isUnlimited={isUnlimited} />;
}
