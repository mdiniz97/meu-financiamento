import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getCreditBalance } from '@/lib/credits';
import { ComparatorClient } from './comparator-client';
import { listComparisons, loadComparison } from './actions';

export default async function CompararPropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await searchParams;
  const session = await auth();
  if (!session?.userId) redirect('/login');
  const { isUnlimited } = await getCreditBalance(session.userId);
  if (!isUnlimited) {
    return <ComparatorClient locked initialComparisons={[]} saved={null} />;
  }
  const saved = typeof id === 'string' && id ? await loadComparison(id) : null;
  return (
    <ComparatorClient
      locked={false}
      initialComparisons={await listComparisons()}
      saved={saved}
    />
  );
}
