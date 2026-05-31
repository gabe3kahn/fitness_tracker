import { supabase } from './supabase';
import {
  XP_RATES,
  KM_PER_MI,
  HERO_CLASS_BONUS,
  streakMultiplier,
  levelForXp,
} from '../constants/xp-config';
import { getTierForLevel, StatKey } from '../constants/heroes';
import { awardStatSp } from './stat-engine';
import type { PlayerStat } from '../constants/stats';

export interface HealthInput {
  steps?: number;
  distanceRunKm?: number;
  distanceHikeKm?: number;
  distanceCycleKm?: number;
  distanceSwimKm?: number;
  workoutMinutes?: number;
  elevationFt?: number;
  puzzle?: { xp: number; rawValue: number };
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
  if (input.distanceRunKm) {
    const mi = input.distanceRunKm / KM_PER_MI;
    const xp = Math.floor(mi * XP_RATES.distanceRunXpPerMi);
    breakdown.push({ source: 'distanceRun', rawValue: mi, baseXp: xp, finalXp: xp });
  }
  if (input.distanceHikeKm) {
    const mi = input.distanceHikeKm / KM_PER_MI;
    const xp = Math.floor(mi * XP_RATES.distanceHikeXpPerMi);
    breakdown.push({ source: 'distanceHike', rawValue: mi, baseXp: xp, finalXp: xp });
  }
  if (input.distanceCycleKm) {
    const mi = input.distanceCycleKm / KM_PER_MI;
    const xp = Math.floor(mi * XP_RATES.distanceCycleXpPerMi);
    breakdown.push({ source: 'distanceCycle', rawValue: mi, baseXp: xp, finalXp: xp });
  }
  if (input.distanceSwimKm) {
    const mi = input.distanceSwimKm / KM_PER_MI;
    const xp = Math.floor(mi * XP_RATES.distanceSwimXpPerMi);
    breakdown.push({ source: 'distanceSwim', rawValue: mi, baseXp: xp, finalXp: xp });
  }
  if (input.workoutMinutes) {
    const xp = Math.min(input.workoutMinutes * XP_RATES.workoutXpPerMin, XP_RATES.workoutMinuteCap);
    breakdown.push({ source: 'workoutMinutes', rawValue: input.workoutMinutes, baseXp: xp, finalXp: xp });
  }
  if (input.elevationFt) {
    const xp = Math.floor((input.elevationFt / XP_RATES.elevationFtPerXp) * XP_RATES.elevationXp);
    breakdown.push({ source: 'elevation', rawValue: input.elevationFt, baseXp: xp, finalXp: xp });
  }
  if (input.puzzle) {
    breakdown.push({ source: 'puzzle', rawValue: input.puzzle.rawValue, baseXp: input.puzzle.xp, finalXp: input.puzzle.xp });
  }

  return breakdown;
}

const STAT_TO_SOURCE: Partial<Record<StatKey, string>> = {
  strengthWorkouts: 'workoutMinutes',
  runningDistance:  'distanceRun',
  streaks:          'streak',
  variedActivity:   'workoutMinutes',
  hiitWorkouts:     'workoutMinutes',
  cyclingDistance:  'distanceCycle',
  steps:            'steps',
  workoutDuration:  'workoutMinutes',
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
  sleepMultiplier = 1,
): { totalXp: number; breakdown: XpBreakdown[] } {
  let breakdown = baseXpFromInput(input);
  breakdown = applyClassBonus(breakdown, primaryStat, secondaryStat);

  const streakMult = streakMultiplier(streakDays);
  const multiplier = streakMult * sleepMultiplier;
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
  eventDateOverride?: string,
  // Only workouts >= 20 min count toward the streak. Steps, short sessions, etc. pass false.
  countsForStreak = true,
  // Stable external ID (e.g. Apple Health workout UUID) — prevents duplicate inserts on re-sync.
  externalSessionId?: string,
  sleepMultiplier = 1,
  // Wordle guess count (1–6) or Connections mistake count (0+). Only set for puzzle events.
  puzzleAccuracy?: number,
): Promise<XpResult> {
  const eventDate = eventDateOverride ?? getLocalDate(timezone);
  const yesterday = getYesterdayDate(eventDate);

  // 1. Resolve streak BEFORE computing XP so all modifiers are known upfront.
  let newStreak = streakDays;
  let newLongestStreak = longestStreak;
  if (countsForStreak && lastActiveDate !== eventDate) {
    newStreak = lastActiveDate === yesterday ? streakDays + 1 : 1;
    newLongestStreak = Math.max(longestStreak, newStreak);
  }

  // Streak multiplier to apply: qualifying activities use the streak they produce;
  // non-qualifying (steps, short workouts) use the current streak only if still active.
  let streakForXp: number;
  if (countsForStreak) {
    streakForXp = newStreak;
  } else {
    const streakIsActive = lastActiveDate === eventDate || lastActiveDate === yesterday;
    streakForXp = streakIsActive ? streakDays : 0;
  }

  // 2. Calculate XP with resolved streak + sleep multiplier.
  const { totalXp: earned, breakdown } = calculateXp(input, primaryStat, secondaryStat, streakForXp, sleepMultiplier);
  const streakMult = streakMultiplier(streakForXp);
  console.log(`[XP] awardXp hero=${heroId} activity=${activityType} platform=${sourcePlatform} streakForXp=${streakForXp} streakMult=${streakMult.toFixed(2)} sleepMult=${sleepMultiplier.toFixed(2)} earned=${earned}`);
  breakdown.forEach((b) => console.log(`[XP]   ${b.source} raw=${b.rawValue} base=${b.baseXp} final=${b.finalXp}`));

  const newTotalXp = currentTotalXp + earned;
  const newLevel = levelForXp(newTotalXp);
  const newTier = getTierForLevel(newLevel);
  const leveledUp = newLevel > currentLevel;
  const sessionId = externalSessionId ?? generateSessionId();

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
    ...(puzzleAccuracy != null ? { puzzle_accuracy: puzzleAccuracy } : {}),
  }));

  if (events.length > 0) {
    await supabase.from('xp_events').insert(events);
  }

  const heroUpdate: Record<string, unknown> = { total_xp: newTotalXp, level: newLevel, tier: newTier };
  if (countsForStreak) {
    heroUpdate.streak_days = newStreak;
    heroUpdate.longest_streak = newLongestStreak;
    heroUpdate.last_active_date = eventDate;
  }

  await supabase
    .from('user_heroes')
    .update(heroUpdate)
    .eq('user_id', userId)
    .eq('hero_id', heroId);

  console.log(`[XP] result totalXp=${currentTotalXp}->${newTotalXp} level=${currentLevel}->${newLevel}${leveledUp ? ' LEVELED UP' : ''} streak=${streakDays}->${newStreak}`);
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

// Awards a flat XP bonus for completing a quest — no multipliers, no streak updates.
export async function awardQuestXp(
  userId: string,
  heroId: string,
  questId: string,
  xpReward: number,
  periodKey: string,
  statReward?: { stat: PlayerStat; sp: number },
): Promise<{ newTotalXp: number; newLevel: number; leveledUp: boolean }> {
  const today = new Date().toLocaleDateString('en-CA');

  const { data: hero } = await supabase
    .from('user_heroes')
    .select('total_xp, level')
    .eq('user_id', userId)
    .eq('hero_id', heroId)
    .single();

  if (!hero) throw new Error(`[Quest] Hero not found: ${heroId}`);

  const newTotalXp = hero.total_xp + xpReward;
  const newLevel = levelForXp(newTotalXp);
  const newTier = getTierForLevel(newLevel);
  const leveledUp = newLevel > hero.level;

  await supabase.from('xp_events').insert({
    user_id: userId,
    hero_id: heroId,
    source: 'quest_reward',
    raw_value: xpReward,
    xp_earned: xpReward,
    bonus_multiplier: 1,
    event_date: today,
    source_platform: 'quest',
    activity_type: 'quest',
    session_id: `quest_${questId}_${today}`,
  });

  await supabase
    .from('user_heroes')
    .update({ total_xp: newTotalXp, level: newLevel, tier: newTier })
    .eq('user_id', userId)
    .eq('hero_id', heroId);

  if (statReward) {
    await awardStatSp(userId, heroId, statReward.stat, statReward.sp, 'quest', `quest_${questId}_${periodKey}`, today);
  }

  console.log(`[Quest] Awarded quest=${questId} xp=${xpReward} total=${newTotalXp}${leveledUp ? ' LEVELED UP' : ''}`);
  return { newTotalXp, newLevel, leveledUp };
}
