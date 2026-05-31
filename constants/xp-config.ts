export const KM_PER_MI = 1.60934;

export const XP_RATES = {
  stepsPerXp: 500,              // 1 XP per 500 steps
  distanceRunXpPerMi: 10,        // 5 mi → 50 XP  (run only)
  distanceHikeXpPerMi: 5,        // 5 mi → 25 XP  (hike, walk — stacks with elevation)
  distanceCycleXpPerMi: 50 / 12, // 12 mi → 50 XP
  distanceSwimXpPerMi: 50,      // 1 mi → 50 XP
  workoutXpPerMin: 1,           // 1 XP/min for non-distance activities
  workoutMinuteCap: 120,        // caps at 120 XP per session
  elevationFtPerXp: 100,        // 5 XP per 100 ft elevation gain
  elevationXp: 5,
} as const;

export const STREAK_BONUS = {
  perDayPercent: 10,   // +10% per consecutive day
  maxPercent: 100,     // caps at +100%
} as const;

export const HERO_CLASS_BONUS = {
  primaryMultiplier: 1.5,
  secondaryMultiplier: 1.25,
} as const;

export function xpForLevel(level: number): number {
  return Math.floor(15 * level * level + 100);
}

export function levelForXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export function streakMultiplier(streakDays: number): number {
  const bonusPercent = Math.min(streakDays * STREAK_BONUS.perDayPercent, STREAK_BONUS.maxPercent);
  return 1 + bonusPercent / 100;
}

// Returns 0 if the streak is broken (last active > 1 day ago), otherwise the stored value.
// Use this for display — streak_days in DB isn't decremented between workouts.
// Streak is still live if lastActive is today OR yesterday (you have until end of today to extend it).
export function effectiveStreak(streakDays: number, lastActiveDate: string | null | undefined): number {
  if (!lastActiveDate) return 0;
  const today = new Date().toLocaleDateString('en-CA');
  const d = new Date(`${lastActiveDate}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const dayAfterLastActive = d.toLocaleDateString('en-CA');
  return today <= dayAfterLastActive ? streakDays : 0;
}

export function xpProgressInLevel(totalXp: number, level: number) {
  const levelStart = level <= 1 ? 0 : xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const progress = totalXp - levelStart;
  const needed = levelEnd - levelStart;
  return { progress, needed, percent: Math.min(progress / needed, 1) };
}
