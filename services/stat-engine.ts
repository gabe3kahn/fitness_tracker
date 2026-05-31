import { supabase } from './supabase';
import { PlayerStat, PLAYER_STATS, levelFromSpForStat } from '../constants/stats';

// ─── Puzzle intelligence SP (accuracy-based) ─────────────────────────────────

const WORDLE_SP: Record<number, number> = { 1: 30, 2: 24, 3: 18, 4: 12, 5: 7, 6: 4, 7: 2 };
const CONNECTIONS_SP = [30, 21, 12, 6, 3]; // index = mistake count; beyond = 2

export function puzzleIntelligenceSp(activityType: string, accuracy: number | null | undefined): number {
  if (activityType === 'wordle') return WORDLE_SP[accuracy ?? 7] ?? 2;
  if (activityType === 'connections') {
    if (accuracy == null) return 2; // failed
    return accuracy < CONNECTIONS_SP.length ? CONNECTIONS_SP[accuracy] : 2;
  }
  return 20; // mini, strands — flat (no accuracy data)
}

// Sentinel hero_id for player-wide events (lucky day luck).
export const GLOBAL_HERO = '_global';

export interface PlayerStatRow {
  stat: PlayerStat;
  total_sp: number;
  level: number;
}

// Insert a stat SP event. Use GLOBAL_HERO for player-wide events.
// Silently skips if the session_id already exists for this (user, hero, stat).
export async function awardStatSp(
  userId: string,
  heroId: string,
  stat: PlayerStat,
  sp: number,
  source: string,
  sessionId: string,
  eventDate?: string,
): Promise<void> {
  if (sp <= 0) return;
  console.log(`[StatEngine] awardStatSp hero=${heroId} stat=${stat} sp=${sp} source=${source} session=${sessionId}`);
  const date = eventDate ?? new Date().toLocaleDateString('en-CA');
  await supabase
    .from('hero_stat_events')
    .upsert(
      { user_id: userId, hero_id: heroId, stat, sp, source, session_id: sessionId, event_date: date },
      { onConflict: 'user_id,hero_id,stat,session_id', ignoreDuplicates: true },
    );
}

// Sources that directly advance stat levels. workout/puzzle only accumulate toward claim thresholds.
const STAT_LEVEL_SOURCES = ['level_up', 'stat_bonus', 'lucky_day', 'quest'];

// Sum level-advancing SP for a specific (user, hero, stat) — includes _global events for luck.
export async function getHeroStatSp(userId: string, heroId: string, stat: PlayerStat): Promise<number> {
  const { data } = await supabase
    .from('hero_stat_events')
    .select('sp')
    .eq('user_id', userId)
    .eq('stat', stat)
    .in('source', STAT_LEVEL_SOURCES)
    .or(`hero_id.eq.${heroId},hero_id.eq.${GLOBAL_HERO}`);
  return (data ?? []).reduce((sum, row) => sum + row.sp, 0);
}

// Return all five stats for a hero, including _global luck contributions.
export async function getPlayerStats(userId: string, heroId: string): Promise<Record<PlayerStat, PlayerStatRow>> {
  const { data } = await supabase
    .from('hero_stat_events')
    .select('stat, sp')
    .eq('user_id', userId)
    .in('source', STAT_LEVEL_SOURCES)
    .or(`hero_id.eq.${heroId},hero_id.eq.${GLOBAL_HERO}`);

  const spByStat: Record<string, number> = {};
  for (const row of data ?? []) {
    spByStat[row.stat] = (spByStat[row.stat] ?? 0) + row.sp;
  }

  const result = {} as Record<PlayerStat, PlayerStatRow>;
  for (const s of PLAYER_STATS) {
    const totalSp = spByStat[s] ?? 0;
    result[s] = { stat: s, total_sp: totalSp, level: levelFromSpForStat(s, totalSp) };
  }
  return result;
}

// ─── Claimable stat bonuses ───────────────────────────────────────────────────
// Escalating thresholds: claim n costs 60n SP (cumulative total = 30·n·(n+1)).
// claims_made is persisted in stat_bonus_trackers; total_sp_generated is derived live.

// How many total claims have been earned for a given SP total.
function totalClaimsEarned(totalSp: number): number {
  return Math.floor((-1 + Math.sqrt(1 + 4 * totalSp / 30)) / 2);
}

export async function getClaimableBonuses(
  userId: string,
  heroId: string,
): Promise<Partial<Record<PlayerStat, number>>> {
  const [{ data: spRows }, { data: trackers }] = await Promise.all([
    supabase
      .from('hero_stat_events')
      .select('stat, sp')
      .eq('user_id', userId)
      .eq('hero_id', heroId)
      .in('source', ['workout', 'puzzle']),
    supabase
      .from('stat_bonus_trackers')
      .select('stat, claims_made')
      .eq('user_id', userId)
      .eq('hero_id', heroId),
  ]);

  const totalSpByStat: Record<string, number> = {};
  for (const row of spRows ?? []) {
    totalSpByStat[row.stat] = (totalSpByStat[row.stat] ?? 0) + row.sp;
  }
  const claimedMap: Record<string, number> = {};
  for (const t of trackers ?? []) {
    claimedMap[t.stat] = t.claims_made;
  }

  const result: Partial<Record<PlayerStat, number>> = {};
  for (const stat of PLAYER_STATS) {
    const claimable = Math.max(0, totalClaimsEarned(totalSpByStat[stat] ?? 0) - (claimedMap[stat] ?? 0));
    if (claimable > 0) result[stat] = claimable;
  }
  return result;
}

export async function claimStatBonuses(
  userId: string,
  heroId: string,
  stat: PlayerStat,
): Promise<number> {
  const bonuses = await getClaimableBonuses(userId, heroId);
  const claimable = bonuses[stat] ?? 0;
  if (claimable === 0) return 0;

  // 1 SP = 1 stat level, so claimable claims = claimable SP.
  const today = new Date().toLocaleDateString('en-CA');
  const sessionId = `stat_bonus_${heroId}_${stat}_${Date.now()}`;
  await awardStatSp(userId, heroId, stat, claimable, 'stat_bonus', sessionId, today);

  const { data: existing } = await supabase
    .from('stat_bonus_trackers')
    .select('claims_made')
    .eq('user_id', userId).eq('hero_id', heroId).eq('stat', stat)
    .maybeSingle();

  await supabase
    .from('stat_bonus_trackers')
    .upsert(
      { user_id: userId, hero_id: heroId, stat, claims_made: (existing?.claims_made ?? 0) + claimable, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,hero_id,stat' },
    );

  console.log(`[StatEngine] claimStatBonuses hero=${heroId} stat=${stat} claimed=${claimable}`);
  return claimable;
}
