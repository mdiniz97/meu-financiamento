'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 60_000;

export function SuccessPoller() {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
