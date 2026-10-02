const WINDOW_MS = 48 * 60 * 60 * 1000;

/** A grant after the original window expires opens a new 48h offer, not a new trial. */
export function trialOfferDeadline(user: { createdAt: Date; trialOfferEligibleAt: Date | null }): Date | null {
  if (!user.trialOfferEligibleAt) return null;
  const originalDeadline = user.createdAt.getTime() + WINDOW_MS;
  return new Date(user.trialOfferEligibleAt.getTime() >= originalDeadline
    ? user.trialOfferEligibleAt.getTime() + WINDOW_MS : originalDeadline);
}
