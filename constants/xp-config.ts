export const XP_RATES = {
  stepsPerXp: 100,           // 1 XP per 100 steps
  activeMinutesPerXp: 2,     // 2 XP per active minute (inverse: XP per unit)
  workoutBase: 50,
  caloriesPerXp: 10,         // 1 XP per 10 calories
  distanceKmPerXp: 5,        // 5 XP per km
  elevationFtPerXp: 100,     // 5 XP per 100 ft elevation gain (inverse)
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
  return Math.floor(100 * Math.pow(level, 1.5));
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

export function xpProgressInLevel(totalXp: number, level: number) {
  const levelStart = level <= 1 ? 0 : xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const progress = totalXp - levelStart;
  const needed = levelEnd - levelStart;
  return { progress, needed, percent: Math.min(progress / needed, 1) };
}
