export type SignupClaim = { transactionId: string; claimToken: string };

/** Claim on the server; only the Google tag callback confirms delivery. */
export async function dispatchSignupConversion(
  gtag: ((...args: unknown[]) => void) | undefined,
  claim: () => Promise<SignupClaim | null>,
  ack: (token: string) => Promise<void>
): Promise<void> {
  if (!gtag) return;
  const pending = await claim();
  if (!pending) return;

  let acknowledged = false;
  gtag('event', 'conversion', {
    send_to: 'AW-18473946056/SFe0CKyn7YQdEMiXiOlE',
    value: 1.0,
    currency: 'BRL',
    transaction_id: pending.transactionId,
    event_callback: () => {
      if (acknowledged) return;
      acknowledged = true;
      void ack(pending.claimToken).catch(() => {
        // The lease expires so a later visit can retry with the same transaction ID.
      });
    },
  });
}
