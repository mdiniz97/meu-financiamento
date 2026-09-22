export function shouldLockMeuFinanciamento({
  isUnlimited,
  hasContract,
}: {
  isUnlimited: boolean;
  hasContract: boolean;
}): boolean {
  return !isUnlimited && !hasContract;
}

export function shouldShowOnboarding({
  isUnlimited,
  hasContract,
  hasState,
}: {
  isUnlimited: boolean;
  hasContract: boolean;
  hasState: boolean;
}): boolean {
  return isUnlimited && !hasContract && !hasState;
}
