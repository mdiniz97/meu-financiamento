export const FOLLOWUP_STAGES = [[1, 'day_1'], [7, 'day_7'], [30, 'day_30']] as const;
export type FollowupStage = typeof FOLLOWUP_STAGES[number][1];

export function dueStage(endsAt: Date, now: Date): FollowupStage | null {
  const age = now.getTime() - endsAt.getTime();
  for (const [day, stage] of FOLLOWUP_STAGES) {
    if (age >= day * 86400000 && age < (day + 1) * 86400000) return stage;
  }
  return null;
}
