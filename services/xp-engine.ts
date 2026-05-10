import { supabase } from './supabase';
import {
  XP_RATES,
  HERO_CLASS_BONUS,
  streakMultiplier,
  levelForXp,
} from '../constants/xp-config';
import { getTierForLevel, StatKey } from '../constants/heroes';

export interface HealthInput {
  steps?: number;
  activeMinutes?: number;
  workoutCount?: number;
  workoutDurationMinutes?: number;
  caloriesBurned?: number;
  distanceKm?: number;
  elevationFt?: number;
}

interface XpBreakdown {
  source: string;
  rawValue: number;
  baseXp: number;
  finalXp: number;
}

export interface XpResult {
  totalXp: number;
  breakdown: XpBreakdown[];
  newTotalXp: number;
  newLevel: number;
  newTier: string;
  leveledUp: boolean;
  previousLevel: number;
  newStreak: number;
  newLongestStreak: number;
}

function baseXpFromInput(input: HealthInput): XpBreakdown[] {
  const breakdown: XpBreakdown[] = [];

  if (input.steps) {
    const xp = Math.floor(input.steps / XP_RATES.stepsPerXp);
    breakdown.push({ source: 'steps', rawValue: input.steps, baseXp: xp, finalXp: xp });
  }
  if (input.activeMinutes) {
    const xp = Math.floor(input.activeMinutes * XP_RATES.activeMinutesPerXp);
    breakdown.push({ source: 'activeMinutes', rawValue: input.activeMinutes, baseXp: xp, finalXp: xp });
  }
  if (input.workoutCount) {
    const xp = input.workoutCount * XP_RATES.workoutBase;
    breakdown.push({ source: 'workout', rawValue: input.workoutCount, baseXp: xp, finalXp: xp });
  }
  if (input.caloriesBurned) {
    const xp = Math.floor(input.caloriesBurned / XP_RATES.caloriesPerXp);
    breakdown.push({ source: 'calories', rawValue: input.caloriesBurned, baseXp: xp, finalXp: xp });
  }
  if (input.distanceKm) {
    const xp = Math.floor(input.distanceKm * XP_RATES.distanceKmPerXp);
    breakdown.push({ source: 'distance', rawValue: input.distanceKm, baseXp: xp, finalXp: xp });
  }
  if (input.elevationFt) {
    const xp = Math.floor((input.elevationFt / XP_RATES.elevationFtPerXp) * XP_RATES.elevationXp);
    breakdown.push({ source: 'elevation', rawValue: input.elevationFt, baseXp: xp, finalXp: xp });
  }

  return breakdown;
}

const STAT_TO_SOURCE: Partial<Record<StatKey, string>> = {
  strengthWorkouts: 'workout',
  runningDistance:  'distance',
  streaks:          'streak',
  variedActivity:   'workout',
  hiitWorkouts:     'workout',
  cyclingDistance:  'distance',
  steps:            'steps',
  activeMinutes:    'activeMinutes',
  caloriesBurned:   'calories',
  heartRateZones:   'activeMinutes',
  workoutDuration:  'workout',
};

function applyClassBonus(
  breakdown: XpBreakdown[],
  primaryStat: StatKey,
  secondaryStat: StatKey,
): XpBreakdown[] {
  const primarySource = STAT_TO_SOURCE[primaryStat];
  const secondarySource = STAT_TO_SOURCE[secondaryStat];

  return breakdown.map((item) => {
    let multiplier = 1;
    if (item.source === primarySource) multiplier = HERO_CLASS_BONUS.primaryMultiplier;
    else if (item.source === secondarySource) multiplier = HERO_CLASS_BONUS.secondaryMultiplier;
    return { ...item, finalXp: Math.floor(item.baseXp * multiplier) };
  });
}

export function calculateXp(
  input: HealthInput,
  primaryStat: StatKey,
  secondaryStat: StatKey,
  streakDays: number,
): { totalXp: number; breakdown: XpBreakdown[] } {
  let breakdown = baseXpFromInput(input);
  breakdown = applyClassBonus(breakdown, primaryStat, secondaryStat);

  const multiplier = streakMultiplier(streakDays);
  breakdown = breakdown.map((item) => ({
    ...item,
    finalXp: Math.floor(item.finalXp * multiplier),
  }));

  const totalXp = breakdown.reduce((sum, item) => sum + item.finalXp, 0);
  return { totalXp, breakdown };
}

// Returns 'YYYY-MM-DD' in the given IANA timezone
function getLocalDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

// Returns the date string for the day before the given 'YYYY-MM-DD' string.
// Parses as noon local time to avoid DST edge cases.
function getYesterdayDate(localDateStr: string): string {
  const d = new Date(`${localDateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA');
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function awardXp(
  userId: string,
  heroId: string,
  primaryStat: StatKey,
  secondaryStat: StatKey,
  currentTotalXp: number,
  currentLevel: number,
  streakDays: number,
  longestStreak: number,
  lastActiveDate: string | null,
  input: HealthInput,
  timezone: string,
  activityType = 'manual',
  sourcePlatform = 'manual',
  // Pass a YYYY-MM-DD string to record an activity on a specific past date (e.g. HealthKit import).
  // When set, streak logic is skipped — historical backfills don't rewrite streak history.
  eventDateOverride?: string,
): Promise<XpResult> {
  const eventDate = eventDateOverride ?? getLocalDate(timezone);
  const { totalXp: earned, breakdown } = calculateXp(input, primaryStat, secondaryStat, streakDays);

  // Streak: only advance if this is the first log of the day.
  // Historical imports (eventDateOverride set) skip streak updates to avoid corrupting the streak counter.
  let newStreak = streakDays;
  let newLongestStreak = longestStreak;
  if (!eventDateOverride && lastActiveDate !== eventDate) {
    const yesterday = getYesterdayDate(eventDate);
    newStreak = lastActiveDate === yesterday ? streakDays + 1 : 1;
    newLongestStreak = Math.max(longestStreak, newStreak);
  }

  const newTotalXp = currentTotalXp + earned;
  const newLevel = levelForXp(newTotalXp);
  const newTier = getTierForLevel(newLevel);
  const leveledUp = newLevel > currentLevel;
  const sessionId = generateSessionId();

  const events = breakdown.map((item) => ({
    user_id: userId,
    hero_id: heroId,
    source: item.source,
    raw_value: item.rawValue,
    xp_earned: item.finalXp,
    bonus_multiplier: item.finalXp / (item.baseXp || 1),
    event_date: eventDate,
    source_platform: sourcePlatform,
    timezone,
    activity_type: activityType,
    session_id: sessionId,
  }));

  if (events.length > 0) {
    await supabase.from('xp_events').insert(events);
  }

  const heroUpdate: Record<string, unknown> = { total_xp: newTotalXp, level: newLevel, tier: newTier };
  if (!eventDateOverride) {
    heroUpdate.streak_days = newStreak;
    heroUpdate.longest_streak = newLongestStreak;
    heroUpdate.last_active_date = eventDate;
  }

  await supabase
    .from('user_heroes')
    .update(heroUpdate)
    .eq('user_id', userId)
    .eq('hero_id', heroId);

  return {
    totalXp: earned,
    breakdown,
    newTotalXp,
    newLevel,
    newTier,
    leveledUp,
    previousLevel: currentLevel,
    newStreak,
    newLongestStreak,
  };
}
