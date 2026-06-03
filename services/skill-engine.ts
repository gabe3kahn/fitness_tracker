/**
 * Skill Engine
 *
 * Handles all hero skill mechanics:
 *   - Passive XP multipliers applied per-workout
 *   - Active bonus checks (monthly bests, weekly counts, milestones)
 *   - Pace average updates
 *   - FE progress data queries
 *
 * Skills are gated on hero.level >= skill.unlocksAtLevel.
 * All active bonuses are idempotent via awardSkillBonusXp's session_id uniqueness check.
 */

import { supabase } from './supabase';
import { awardSkillBonusXp } from './xp-engine';
import { XP_RATES, KM_PER_MI } from '../constants/xp-config';
import type { HeroDef } from '../constants/heroes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillContext {
  userId: string;
  heroId: string;
  heroDef: HeroDef;
  heroLevel: number;
}

export interface WorkoutSkillContext extends SkillContext {
  activityType: string;
  durationMinutes: number;
  distanceKm?: number;
  paceMinPerKm?: number;
  weeklyHiitCount: number;   // HIIT sessions in the same calendar week (pre-fetched)
  weekHasHiit: boolean;      // true if any HIIT session exists this week (for Riastrad)
  avgPaceMinPerKm?: number;  // 30-day stored average pace for this activity type
}

export interface DaySkillContext extends SkillContext {
  date: string;                    // 'YYYY-MM-DD'
  activityTypes: Set<string>;      // distinct types logged today (including 'puzzle')
  dayXp: number;                   // total XP earned this day before skill bonuses
  dayHasRun: boolean;
}

export interface SkillProgressData {
  // Hercules
  strengthSessionsThisMonth: number;
  // Yoshitsune
  streakMilestones: { days7: boolean; days30: boolean; days100: boolean };
  // Mulan
  distinctTypesThisWeek: number;
  // Cú Chulainn
  hiitSessionsThisWeek: number;
  weekHasHiit: boolean;
  // Atalanta
  longestRunThisMonthMi: number;
  // Boudicca
  longestRideThisMonthMi: number;
  consecutiveCyclingDays: number;
  // Pace (all heroes)
  avgPaceByType: Record<string, number>;  // activity_type → avg_pace_min_per_km
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasSkill(heroLevel: number, unlocksAt: number): boolean {
  return heroLevel >= unlocksAt;
}

function weekKey(date: string): string {
  // Returns ISO week identifier 'YYYY_WXX'
  const d = new Date(`${date}T12:00:00`);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}_W${String(week).padStart(2, '0')}`;
}

function monthKey(date: string): string {
  return date.substring(0, 7).replace('-', '_');  // 'YYYY_MM'
}

// ---------------------------------------------------------------------------
// Per-workout passive skill multipliers
// Applied on top of the base XP calculated by xp-engine.ts.
// Returns a multiplier to apply to the workout's XP (1.0 = no change).
// ---------------------------------------------------------------------------

export function getWorkoutSkillMultiplier(xp: number, ctx: WorkoutSkillContext): number {
  const { heroDef, heroLevel, activityType, durationMinutes } = ctx;
  let mult = 1.0;

  switch (heroDef.id) {
    case 'hercules': {
      const isStrength = isStrengthActivity(activityType);
      // Lv20 Olympian Might supersedes Lv5 Lion Skin
      if (isStrength && hasSkill(heroLevel, 20)) mult *= 1.25;
      else if (isStrength && hasSkill(heroLevel, 5)) mult *= 1.10;
      // Lv15 Nemean Roar: strength sessions > 60 min earn double duration XP
      if (isStrength && hasSkill(heroLevel, 15) && durationMinutes >= 60) mult *= 2.0;
      // Lv25 Divine Lineage: +5% from all sources
      if (hasSkill(heroLevel, 25)) mult *= 1.05;
      break;
    }
    case 'atalanta': {
      const isRun = activityType === 'run';
      const distMi = (ctx.distanceKm ?? 0) / KM_PER_MI;
      // Lv25 Artemis Blessed supersedes Lv5 Huntress Stride
      if (isRun && hasSkill(heroLevel, 25)) mult *= 1.25;
      else if (isRun && hasSkill(heroLevel, 5)) mult *= 1.10;
      // Lv15 Boar Slayer: runs > 6 miles earn +25%
      if (isRun && hasSkill(heroLevel, 15) && distMi >= 6) mult *= 1.25;
      break;
    }
    case 'yoshitsune': {
      // Lv10 Ushiwakamaru: +10% from all workout minutes
      if (hasSkill(heroLevel, 10) && isMinuteActivity(activityType)) mult *= 1.10;
      break;
    }
    case 'cuchulainn': {
      const isHiit = activityType === 'hiit';
      const isStrength = isStrengthActivity(activityType);
      // Lv25 Battle Frenzy supersedes Lv5 Warp Spasm, also adds strength bonus
      if (hasSkill(heroLevel, 25)) {
        if (isHiit) mult *= 1.35;
        if (isStrength) mult *= 1.20;
      } else if (isHiit && hasSkill(heroLevel, 5)) {
        mult *= 1.15;
      }
      // Lv10 Gáe Bulg: faster than 30-day avg pace → +20%
      if (hasSkill(heroLevel, 10) && ctx.paceMinPerKm && ctx.avgPaceMinPerKm) {
        if (isPaceActivity(activityType) && ctx.paceMinPerKm < ctx.avgPaceMinPerKm) {
          mult *= 1.20;
          console.log(`[Skill] Gáe Bulg triggered pace=${ctx.paceMinPerKm.toFixed(2)} avg=${ctx.avgPaceMinPerKm.toFixed(2)}`);
        }
      }
      // Lv20 Riastrad: strength sessions same week as HIIT → double duration XP
      if (isStrength && hasSkill(heroLevel, 20) && ctx.weekHasHiit) {
        mult *= 2.0;
        console.log(`[Skill] Riastrad triggered — strength session in HIIT week`);
      }
      break;
    }
    case 'boudicca': {
      const isCycle = activityType === 'cycle';
      // Lv15 Battle Chariot supersedes Lv5 Warrior Queen
      if (isCycle && hasSkill(heroLevel, 15)) mult *= 1.25;
      else if (isCycle && hasSkill(heroLevel, 5)) mult *= 1.10;
      // Lv10 Iceni Rising: sessions > 60 min earn flat +30 XP (handled separately, mult stays 1)
      break;
    }
  }

  return mult;
}

// Flat XP additions that aren't multiplicative (e.g. Iceni Rising flat bonus).
export function getWorkoutFlatBonus(ctx: WorkoutSkillContext): number {
  const { heroDef, heroLevel, activityType, durationMinutes } = ctx;

  if (heroDef.id === 'boudicca' && hasSkill(heroLevel, 10) && durationMinutes >= 60) {
    console.log(`[Skill] Iceni Rising flat +30 XP for session > 60 min`);
    return 30;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Day-level skill multipliers (applied after all workouts in a day are summed)
// Mulan's variety bonus, Argonaut Sprint steps bonus, Eternal Flame cycling streak.
// Returns: { dayMultiplier, includeStepsInVariety }
// ---------------------------------------------------------------------------

export interface DaySkillResult {
  dayMultiplier: number;
  stepsMultiplier: number;    // separate so we can apply it only to steps XP
}

export function getDaySkillResult(ctx: DaySkillContext, consecutiveCyclingDays: number): DaySkillResult {
  const { heroDef, heroLevel, activityTypes, dayHasRun } = ctx;
  let dayMult = 1.0;
  let stepsMult = 1.0;

  switch (heroDef.id) {
    case 'mulan': {
      const typeCount = activityTypes.size;
      const hasStrength = [...activityTypes].some(isStrengthActivity);
      const hasCardio = [...activityTypes].some((t) => isCardioActivity(t) && !isStrengthActivity(t));

      // Primary stat variety bonus: 2+ types → +50% on all workout XP (class bonus applied in useHealthSync)
      // Lv5 Soldier's Resolve: additional +10% on 2+ type days
      if (typeCount >= 2 && hasSkill(heroLevel, 5)) dayMult *= 1.10;
      // Lv15 Honor the Family: +10% more on 3+ type days (stacks)
      if (typeCount >= 3 && hasSkill(heroLevel, 15)) dayMult *= 1.10;
      // Lv20 Imperial Champion: strength + cardio → +15%
      if (hasStrength && hasCardio && hasSkill(heroLevel, 20)) dayMult *= 1.15;
      // Lv25 Legend of Hua: variety bonus applies to steps
      if (typeCount >= 2 && hasSkill(heroLevel, 25)) stepsMult *= 1.50;
      break;
    }
    case 'atalanta': {
      // Lv20 Argonaut Sprint: steps doubled on days you also run
      if (dayHasRun && hasSkill(heroLevel, 20)) stepsMult *= 2.0;
      break;
    }
    case 'boudicca': {
      // Lv25 Eternal Flame: consecutive cycling days → stacking +5%/day, max +50%
      if (hasSkill(heroLevel, 25) && consecutiveCyclingDays > 0) {
        const bonus = Math.min(consecutiveCyclingDays * 0.05, 0.50);
        dayMult *= (1 + bonus);
        console.log(`[Skill] Eternal Flame consecutiveDays=${consecutiveCyclingDays} bonus=${(bonus * 100).toFixed(0)}%`);
      }
      break;
    }
  }

  return { dayMultiplier: dayMult, stepsMultiplier: stepsMult };
}

// ---------------------------------------------------------------------------
// Active skill checks — fire idempotent XP bursts
// Called at the end of each sync, after day processing is complete.
// ---------------------------------------------------------------------------

export async function checkActiveSkills(
  ctx: SkillContext,
  today: string,
  currentStreak: number,
): Promise<void> {
  const { userId, heroId, heroDef, heroLevel } = ctx;

  switch (heroDef.id) {
    case 'hercules':
      await checkTwelveLabors(userId, heroId, heroLevel, today);
      break;
    case 'atalanta':
      await checkGoldenApple(userId, heroId, heroLevel, today);
      break;
    case 'yoshitsune':
      await checkNeverDefeated(userId, heroId, heroLevel, today, currentStreak);
      break;
    case 'mulan':
      await checkNorthernCampaign(userId, heroId, heroLevel, today);
      break;
    case 'cuchulainn':
      await checkRedBranchKnight(userId, heroId, heroLevel, today);
      break;
    case 'boudicca':
      await checkRomanDefiance(userId, heroId, heroLevel, today);
      break;
  }
}

async function checkTwelveLabors(userId: string, heroId: string, heroLevel: number, today: string) {
  if (!hasSkill(heroLevel, 10)) return;
  const month = today.substring(0, 7);
  const sessionId = `skill_twelve_labors_${month.replace('-', '_')}`;

  const { count } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('activity_type', ['strength', 'traditionalstrengthtraining', 'functionalstrengthtraining'])
    .gte('workout_date', `${month}-01`)
    .lte('workout_date', today);

  console.log(`[Skill] Twelve Labors strength sessions this month: ${count ?? 0}/12`);
  if ((count ?? 0) >= 12) {
    await awardSkillBonusXp(userId, heroId, sessionId, XP_RATES.skillBurstXp, today);
  }
}

async function checkGoldenApple(userId: string, heroId: string, heroLevel: number, today: string) {
  if (!hasSkill(heroLevel, 10)) return;
  const month = today.substring(0, 7);
  const sessionId = `skill_golden_apple_${month.replace('-', '_')}`;

  // Only fire at end of month (last 3 days) to avoid rewarding a non-final best
  const lastDay = new Date(new Date(`${month}-01T12:00:00`).getFullYear(),
    new Date(`${month}-01T12:00:00`).getMonth() + 1, 0).getDate();
  const dayOfMonth = parseInt(today.substring(8, 10), 10);
  if (dayOfMonth < lastDay - 2) return;

  const { data } = await supabase
    .from('workout_sessions')
    .select('distance_km')
    .eq('user_id', userId)
    .eq('activity_type', 'run')
    .gte('workout_date', `${month}-01`)
    .lte('workout_date', today)
    .order('distance_km', { ascending: false })
    .limit(1);

  const bestKm = data?.[0]?.distance_km ?? 0;
  console.log(`[Skill] Golden Apple longest run this month: ${(bestKm / KM_PER_MI).toFixed(2)} mi`);
  if (bestKm > 0) {
    await awardSkillBonusXp(userId, heroId, sessionId, XP_RATES.skillBurstXp, today);
  }
}

async function checkNeverDefeated(
  userId: string, heroId: string, heroLevel: number, today: string, currentStreak: number,
) {
  if (!hasSkill(heroLevel, 25)) return;
  for (const milestone of [7, 30, 100]) {
    if (currentStreak >= milestone) {
      const sessionId = `skill_never_defeated_${milestone}`;
      await awardSkillBonusXp(userId, heroId, sessionId, XP_RATES.skillBurstXp * milestone / 7, today);
    }
  }
}

async function checkNorthernCampaign(userId: string, heroId: string, heroLevel: number, today: string) {
  if (!hasSkill(heroLevel, 10)) return;
  const wk = weekKey(today);
  const sessionId = `skill_northern_campaign_${wk}`;

  // Week boundaries: Monday to today
  const d = new Date(`${today}T12:00:00`);
  const dow = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dow + 6) % 7));
  const weekStart = monday.toLocaleDateString('en-CA');

  const { data: workoutTypes } = await supabase
    .from('workout_sessions')
    .select('activity_type')
    .eq('user_id', userId)
    .gte('workout_date', weekStart)
    .lte('workout_date', today);

  const { data: puzzleEvents } = await supabase
    .from('xp_events')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'puzzle')
    .gte('event_date', weekStart)
    .lte('event_date', today)
    .limit(1);

  const types = new Set((workoutTypes ?? []).map((r) => r.activity_type));
  if ((puzzleEvents ?? []).length > 0) types.add('puzzle');

  console.log(`[Skill] Northern Campaign distinct types this week: ${types.size}/5 [${[...types].join(', ')}]`);
  if (types.size >= 5) {
    await awardSkillBonusXp(userId, heroId, sessionId, XP_RATES.skillBurstXp, today);
  }
}

async function checkRedBranchKnight(userId: string, heroId: string, heroLevel: number, today: string) {
  if (!hasSkill(heroLevel, 15)) return;
  const wk = weekKey(today);
  const sessionId = `skill_red_branch_${wk}`;

  const d = new Date(`${today}T12:00:00`);
  const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dow + 6) % 7));
  const weekStart = monday.toLocaleDateString('en-CA');

  const { count } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('activity_type', 'hiit')
    .gte('workout_date', weekStart)
    .lte('workout_date', today);

  console.log(`[Skill] Red Branch Knight HIIT sessions this week: ${count ?? 0}/3`);
  if ((count ?? 0) >= 3) {
    await awardSkillBonusXp(userId, heroId, sessionId, XP_RATES.skillBurstXp, today);
  }
}

async function checkRomanDefiance(userId: string, heroId: string, heroLevel: number, today: string) {
  if (!hasSkill(heroLevel, 20)) return;
  const month = today.substring(0, 7);
  const sessionId = `skill_roman_defiance_${month.replace('-', '_')}`;

  const lastDay = new Date(new Date(`${month}-01T12:00:00`).getFullYear(),
    new Date(`${month}-01T12:00:00`).getMonth() + 1, 0).getDate();
  const dayOfMonth = parseInt(today.substring(8, 10), 10);
  if (dayOfMonth < lastDay - 2) return;

  const { data } = await supabase
    .from('workout_sessions')
    .select('distance_km')
    .eq('user_id', userId)
    .eq('activity_type', 'cycle')
    .gte('workout_date', `${month}-01`)
    .lte('workout_date', today)
    .order('distance_km', { ascending: false })
    .limit(1);

  const bestKm = data?.[0]?.distance_km ?? 0;
  console.log(`[Skill] Roman Defiance longest ride this month: ${(bestKm / KM_PER_MI).toFixed(2)} mi`);
  if (bestKm > 0) {
    await awardSkillBonusXp(userId, heroId, sessionId, XP_RATES.skillBurstXp, today);
  }
}

// ---------------------------------------------------------------------------
// Pace average — updated for all heroes on every sync
// ---------------------------------------------------------------------------

const PACE_ACTIVITY_TYPES = ['run', 'cycle', 'swim'] as const;

export async function updatePaceAverages(userId: string, today: string): Promise<void> {
  const thirtyDaysAgo = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 30);
    return d.toLocaleDateString('en-CA');
  })();

  for (const type of PACE_ACTIVITY_TYPES) {
    const { data } = await supabase
      .from('workout_sessions')
      .select('pace_min_per_km')
      .eq('user_id', userId)
      .eq('activity_type', type)
      .gte('workout_date', thirtyDaysAgo)
      .lte('workout_date', today)
      .not('pace_min_per_km', 'is', null);

    if (!data || data.length === 0) continue;

    const avg = data.reduce((s, r) => s + (r.pace_min_per_km as number), 0) / data.length;
    await supabase
      .from('user_pace_averages')
      .upsert(
        { user_id: userId, activity_type: type, avg_pace_min_per_km: avg, sample_count: data.length, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,activity_type' },
      );
    console.log(`[Skill] pace avg updated type=${type} avg=${avg.toFixed(2)} n=${data.length}`);
  }
}

export async function getPaceAverages(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('user_pace_averages')
    .select('activity_type, avg_pace_min_per_km')
    .eq('user_id', userId);

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    result[row.activity_type] = row.avg_pace_min_per_km;
  }
  return result;
}

// ---------------------------------------------------------------------------
// FE progress query — single call to get all tracked skill progress for a hero
// ---------------------------------------------------------------------------

export async function getSkillProgress(userId: string, today: string): Promise<SkillProgressData> {
  const month = today.substring(0, 7);

  const d = new Date(`${today}T12:00:00`);
  const dow = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dow + 6) % 7));
  const weekStart = monday.toLocaleDateString('en-CA');

  const [
    strengthCount,
    hiitCount,
    distictTypesRes,
    puzzleRes,
    longestRunRes,
    longestRideRes,
    cyclingDatesRes,
    milestoneRes,
    paceRes,
  ] = await Promise.all([
    // Strength sessions this month (Twelve Labors)
    supabase.from('workout_sessions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('activity_type', ['strength', 'traditionalstrengthtraining', 'functionalstrengthtraining'])
      .gte('workout_date', `${month}-01`).lte('workout_date', today),

    // HIIT sessions this week (Red Branch Knight, Riastrad)
    supabase.from('workout_sessions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('activity_type', 'hiit')
      .gte('workout_date', weekStart).lte('workout_date', today),

    // Distinct activity types this week (Northern Campaign)
    supabase.from('workout_sessions').select('activity_type')
      .eq('user_id', userId).gte('workout_date', weekStart).lte('workout_date', today),

    // Any puzzle this week (Northern Campaign)
    supabase.from('xp_events').select('id').eq('user_id', userId).eq('source', 'puzzle')
      .gte('event_date', weekStart).lte('event_date', today).limit(1),

    // Longest run this month (Golden Apple)
    supabase.from('workout_sessions').select('distance_km')
      .eq('user_id', userId).eq('activity_type', 'run')
      .gte('workout_date', `${month}-01`).lte('workout_date', today)
      .order('distance_km', { ascending: false }).limit(1),

    // Longest ride this month (Roman Defiance)
    supabase.from('workout_sessions').select('distance_km')
      .eq('user_id', userId).eq('activity_type', 'cycle')
      .gte('workout_date', `${month}-01`).lte('workout_date', today)
      .order('distance_km', { ascending: false }).limit(1),

    // Cycling dates for consecutive day streak (Eternal Flame)
    supabase.from('workout_sessions').select('workout_date')
      .eq('user_id', userId).eq('activity_type', 'cycle')
      .order('workout_date', { ascending: false }).limit(60),

    // Never Defeated milestone xp_events already awarded
    supabase.from('xp_events').select('session_id')
      .eq('user_id', userId)
      .in('session_id', ['skill_never_defeated_7', 'skill_never_defeated_30', 'skill_never_defeated_100']),

    // Pace averages
    supabase.from('user_pace_averages').select('activity_type, avg_pace_min_per_km').eq('user_id', userId),
  ]);

  // Distinct types this week
  const weekTypes = new Set((distictTypesRes.data ?? []).map((r) => r.activity_type));
  if ((puzzleRes.data ?? []).length > 0) weekTypes.add('puzzle');

  // Consecutive cycling days
  const cyclingDates = new Set((cyclingDatesRes.data ?? []).map((r) => r.workout_date as string));
  let consecutiveCyclingDays = 0;
  const cur = new Date(`${today}T12:00:00`);
  while (true) {
    const ds = cur.toLocaleDateString('en-CA');
    if (!cyclingDates.has(ds)) break;
    consecutiveCyclingDays++;
    cur.setDate(cur.getDate() - 1);
  }

  // Milestone set
  const awarded = new Set((milestoneRes.data ?? []).map((r) => r.session_id));

  // Pace averages
  const avgPaceByType: Record<string, number> = {};
  for (const row of paceRes.data ?? []) {
    avgPaceByType[row.activity_type] = row.avg_pace_min_per_km;
  }

  return {
    strengthSessionsThisMonth: strengthCount.count ?? 0,
    streakMilestones: {
      days7: awarded.has('skill_never_defeated_7'),
      days30: awarded.has('skill_never_defeated_30'),
      days100: awarded.has('skill_never_defeated_100'),
    },
    distinctTypesThisWeek: weekTypes.size,
    hiitSessionsThisWeek: hiitCount.count ?? 0,
    weekHasHiit: (hiitCount.count ?? 0) > 0,
    longestRunThisMonthMi: ((longestRunRes.data?.[0]?.distance_km ?? 0) as number) / KM_PER_MI,
    longestRideThisMonthMi: ((longestRideRes.data?.[0]?.distance_km ?? 0) as number) / KM_PER_MI,
    consecutiveCyclingDays,
    avgPaceByType,
  };
}

// ---------------------------------------------------------------------------
// Consecutive cycling days helper (used during sync)
// ---------------------------------------------------------------------------

export async function getConsecutiveCyclingDays(userId: string, today: string): Promise<number> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('workout_date')
    .eq('user_id', userId)
    .eq('activity_type', 'cycle')
    .order('workout_date', { ascending: false })
    .limit(60);

  const dates = new Set((data ?? []).map((r) => r.workout_date as string));
  let count = 0;
  const cur = new Date(`${today}T12:00:00`);
  while (true) {
    const ds = cur.toLocaleDateString('en-CA');
    if (!dates.has(ds)) break;
    count++;
    cur.setDate(cur.getDate() - 1);
  }
  return count;
}

// ---------------------------------------------------------------------------
// Activity type classifiers
// ---------------------------------------------------------------------------

export function isStrengthActivity(type: string): boolean {
  return ['traditionalstrengthtraining', 'functionalstrengthtraining', 'strength'].includes(type);
}

export function isCardioActivity(type: string): boolean {
  return ['run', 'cycle', 'hike', 'walk', 'swim', 'hiit', 'cardio'].includes(type);
}

export function isPaceActivity(type: string): boolean {
  return ['run', 'cycle', 'swim'].includes(type);
}

export function isMinuteActivity(type: string): boolean {
  return !['run', 'cycle', 'hike', 'walk', 'swim'].includes(type);
}

// Maps HealthKit activity type → HealthInput field name for minute-based sources
export function activityTypeToMinuteField(
  type: string,
): 'strengthMinutes' | 'hiitMinutes' | 'mobilityMinutes' | 'cardioMinutes' | 'workoutMinutes' {
  if (isStrengthActivity(type)) return 'strengthMinutes';
  if (type === 'hiit') return 'hiitMinutes';
  if (['yoga', 'pilates'].includes(type)) return 'mobilityMinutes';
  if (['run', 'cycle', 'hike', 'walk', 'swim'].includes(type)) return 'workoutMinutes'; // distance-primary; minutes are secondary
  return 'cardioMinutes';
}
