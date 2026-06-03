import { supabase } from './supabase';
import {
  XP_RATES,
  KM_PER_MI,
  HERO_CLASS_BONUS,
  STREAK_BONUS,
  streakMultiplier,
  levelForXp,
  type StreakOptions,
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
  // Activity-type-specific minute fields (replaces generic workoutMinutes)
  strengthMinutes?: number;
  hiitMinutes?: number;
  mobilityMinutes?: number;   // yoga, pilates
  cardioMinutes?: number;     // other non-distance cardio (elliptical, rowing, etc.)
  workoutMinutes?: number;    // fallback for unknown activity types
  elevationFt?: number;
  puzzle?: { xp: number; rawValue: number };
}

// All minute-based sources — used for Yoshitsune's workoutDuration primary (all *Minutes)
export const ALL_MINUTE_SOURCES = new Set([
  'strengthMinutes',
  'hiitMinutes',
  'mobilityMinutes',
  'cardioMinutes',
  'workoutMinutes',
]);

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
  const minuteXp = (minutes: number) =>
    Math.min(minutes * XP_RATES.workoutXpPerMin, XP_RATES.workoutMinuteCap);

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
  if (input.strengthMinutes) {
    const xp = minuteXp(input.strengthMinutes);
    breakdown.push({ source: 'strengthMinutes', rawValue: input.strengthMinutes, baseXp: xp, finalXp: xp });
  }
  if (input.hiitMinutes) {
    const xp = minuteXp(input.hiitMinutes);
    breakdown.push({ source: 'hiitMinutes', rawValue: input.hiitMinutes, baseXp: xp, finalXp: xp });
  }
  if (input.mobilityMinutes) {
    const xp = minuteXp(input.mobilityMinutes);
    breakdown.push({ source: 'mobilityMinutes', rawValue: input.mobilityMinutes, baseXp: xp, finalXp: xp });
  }
  if (input.cardioMinutes) {
    const xp = minuteXp(input.cardioMinutes);
    breakdown.push({ source: 'cardioMinutes', rawValue: input.cardioMinutes, baseXp: xp, finalXp: xp });
  }
  if (input.workoutMinutes) {
    const xp = minuteXp(input.workoutMinutes);
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

const STAT_TO_SOURCE: Partial<Record<StatKey, string | 'ALL_MINUTES'>> = {
  strengthWorkouts: 'strengthMinutes',
  runningDistance:  'distanceRun',
  hikingDistance:   'distanceHike',
  cyclingDistance:  'distanceCycle',
  steps:            'steps',
  elevation:        'elevation',
  hiitWorkouts:     'hiitMinutes',
  workoutDuration:  'ALL_MINUTES',  // matches every *Minutes source
  // variedActivity and streaks are handled outside applyClassBonus (day-level and streak-level)
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
    const isPrimary = primarySource === 'ALL_MINUTES'
      ? ALL_MINUTE_SOURCES.has(item.source)
      : item.source === primarySource;
    const isSecondary = !isPrimary && (secondarySource === 'ALL_MINUTES'
      ? ALL_MINUTE_SOURCES.has(item.source)
      : item.source === secondarySource);

    if (isPrimary) multiplier = HERO_CLASS_BONUS.primaryMultiplier;
    else if (isSecondary) multiplier = HERO_CLASS_BONUS.secondaryMultiplier;
    return { ...item, finalXp: Math.floor(item.baseXp * multiplier) };
  });
}

export function calculateXp(
  input: HealthInput,
  primaryStat: StatKey,
  secondaryStat: StatKey,
  streakDays: number,
  sleepMultiplier = 1,
  streakOpts: StreakOptions = {},
): { totalXp: number; breakdown: XpBreakdown[] } {
  let breakdown = baseXpFromInput(input);
  // variedActivity primary bonus is applied at the day level in useHealthSync, not here
  if (primaryStat !== 'variedActivity') {
    breakdown = applyClassBonus(breakdown, primaryStat, secondaryStat);
  }

  const streakMult = streakMultiplier(streakDays, streakOpts);
  const multiplier = streakMult * sleepMultiplier;
  breakdown = breakdown.map((item) => ({
    ...item,
    finalXp: Math.floor(item.finalXp * multiplier),
  }));

  const totalXp = breakdown.reduce((sum, item) => sum + item.finalXp, 0);
  return { totalXp, breakdown };
}

function getLocalDate(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

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
  eventDateOverride?: string,
  countsForStreak = true,
  externalSessionId?: string,
  sleepMultiplier = 1,
  puzzleAccuracy?: number,
  streakOpts: StreakOptions = {},
): Promise<XpResult> {
  const eventDate = eventDateOverride ?? getLocalDate(timezone);
  const yesterday = getYesterdayDate(eventDate);

  // 1. Resolve streak
  let newStreak = streakDays;
  let newLongestStreak = longestStreak;
  if (countsForStreak && lastActiveDate !== eventDate) {
    if (lastActiveDate === yesterday) {
      newStreak = streakDays + 1;
    } else {
      // Exile's Resolve (Yoshitsune Lv15): preserve half on break
      newStreak = streakOpts.preserveHalfOnBreak ? Math.floor(streakDays / 2) : 1;
    }
    newLongestStreak = Math.max(longestStreak, newStreak);
  }

  let streakForXp: number;
  if (countsForStreak) {
    streakForXp = newStreak;
  } else {
    const streakIsActive = lastActiveDate === eventDate || lastActiveDate === yesterday;
    streakForXp = streakIsActive ? streakDays : 0;
  }

  // 2. Calculate XP
  const { totalXp: earned, breakdown } = calculateXp(
    input, primaryStat, secondaryStat, streakForXp, sleepMultiplier, streakOpts,
  );
  const streakMult = streakMultiplier(streakForXp, streakOpts);
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

// Awards a flat XP bonus with a stable session_id (idempotent via DB unique constraint on session_id).
export async function awardSkillBonusXp(
  userId: string,
  heroId: string,
  skillSessionId: string,  // e.g. 'skill_twelve_labors_2026_06'
  xp: number,
  eventDate: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('xp_events')
    .select('id')
    .eq('user_id', userId)
    .eq('hero_id', heroId)
    .eq('session_id', skillSessionId)
    .maybeSingle();

  if (existing) {
    console.log(`[Skill] bonus already awarded session=${skillSessionId} — skipping`);
    return;
  }

  const { data: hero } = await supabase
    .from('user_heroes')
    .select('total_xp, level')
    .eq('user_id', userId)
    .eq('hero_id', heroId)
    .single();

  if (!hero) return;

  const newTotalXp = hero.total_xp + xp;
  const newLevel = levelForXp(newTotalXp);
  const newTier = getTierForLevel(newLevel);

  await supabase.from('xp_events').insert({
    user_id: userId,
    hero_id: heroId,
    source: 'skill',
    raw_value: xp,
    xp_earned: xp,
    bonus_multiplier: 1,
    event_date: eventDate,
    source_platform: 'skill',
    activity_type: 'skill',
    session_id: skillSessionId,
  });

  await supabase
    .from('user_heroes')
    .update({ total_xp: newTotalXp, level: newLevel, tier: newTier })
    .eq('user_id', userId)
    .eq('hero_id', heroId);

  console.log(`[Skill] bonus awarded session=${skillSessionId} xp=${xp} total=${newTotalXp}`);
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
