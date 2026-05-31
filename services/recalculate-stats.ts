import { supabase } from './supabase';
import { awardStatSp, GLOBAL_HERO, puzzleIntelligenceSp } from './stat-engine';
import { HEROES, HeroDef } from '../constants/heroes';
import { ACTIVITY_TO_STAT, PLAYER_STATS, PlayerStat } from '../constants/stats';
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, BOSS_BATTLES } from '../constants/quests';

const ALL_QUESTS_MAP = new Map(
  [...DAILY_QUESTS, ...WEEKLY_QUESTS, ...MONTHLY_QUESTS, ...BOSS_BATTLES].map(q => [q.id, q]),
);

// The PlayerStat with the highest statDistribution value is the hero's primary for level-up bonuses.
function primaryPlayerStat(heroDef: HeroDef): PlayerStat {
  const dist = heroDef.statDistribution;
  return (Object.keys(dist) as PlayerStat[]).reduce((best, stat) => dist[stat] > dist[best] ? stat : best);
}

// Wipe and recompute all hero_stat_events (and stat_bonus_trackers) for a user.
// Sources replayed:
//   workout      — duration minutes SP from workout_sessions, credited to each hero
//   puzzle       — accuracy-based intelligence SP from xp_events, credited to the logging hero
//   level_up     — 1 SP per stat + 2 for primary (from statDistribution max), per hero level-up
//   level_up     — 1 SP for the player's chosen bonus stat per level (from level_up_choices)
//   lucky_day    — 1 luck SP per won luck_check, player-wide (_global)
// Note: stat_bonus_trackers is wiped so the player must re-claim workout/puzzle bonuses.
//       Claim thresholds escalate: claim n costs 60n SP, total = 30·n·(n+1).
export async function recalculateStats(userId: string): Promise<void> {
  console.log(`[Recalc] START userId=${userId}`);

  // 1. Wipe existing events and claim history so threshold changes take effect cleanly
  const { error: deleteError, count: deleteCount } = await supabase
    .from('hero_stat_events')
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  console.log(`[Recalc] DELETE hero_stat_events → count=${deleteCount} error=${deleteError?.message ?? 'none'}`);

  const { error: claimsError, count: claimsCount } = await supabase
    .from('stat_bonus_trackers')
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  console.log(`[Recalc] DELETE stat_bonus_trackers → count=${claimsCount} error=${claimsError?.message ?? 'none'}`);

  // 2. Fetch all heroes for this user
  const { data: userHeroes } = await supabase
    .from('user_heroes')
    .select('hero_id, level')
    .eq('user_id', userId);

  console.log(`[Recalc] heroes=${JSON.stringify(userHeroes?.map(h => ({ id: h.hero_id, level: h.level })))}`);
  if (!userHeroes || userHeroes.length === 0) return;

  // 3. Workout SP — read from workout_sessions (hero-agnostic, has duration for all types including runs).
  //    xp_events only stores workoutMinutes for non-distance activities; runs/hikes/cycles are missing there.
  const { data: workoutSessions, error: wsError } = await supabase
    .from('workout_sessions')
    .select('session_id, activity_type, duration_minutes, workout_date')
    .eq('user_id', userId)
    .gt('duration_minutes', 0);

  console.log(`[Recalc] workout_sessions query error=${wsError?.message ?? 'none'} rows=${workoutSessions?.length ?? 'null'}`);

  const sessionMap = new Map<string, { activityType: string; durationMin: number; eventDate: string }>();
  for (const s of workoutSessions ?? []) {
    if (!sessionMap.has(s.session_id)) {
      sessionMap.set(s.session_id, {
        activityType: s.activity_type,
        durationMin: s.duration_minutes,
        eventDate: s.workout_date,
      });
    }
  }
  console.log(`[Recalc] workout sessions=${sessionMap.size}`);

  for (const hero of userHeroes) {
    for (const [sessionId, session] of sessionMap) {
      const workoutStat = ACTIVITY_TO_STAT[session.activityType];
      if (!workoutStat) continue;
      await awardStatSp(
        userId, hero.hero_id, workoutStat, session.durationMin,
        'workout', sessionId, session.eventDate,
      );
    }
  }

  // 4. Puzzle SP — accuracy-based intelligence per puzzle session
  const { data: puzzleEvents } = await supabase
    .from('xp_events')
    .select('hero_id, session_id, activity_type, puzzle_accuracy, event_date')
    .eq('user_id', userId)
    .eq('source', 'puzzle');

  const puzzleSessions = new Map<string, { heroId: string; activityType: string; accuracy: number | null; eventDate: string }>();
  for (const e of puzzleEvents ?? []) {
    if (!puzzleSessions.has(e.session_id)) {
      puzzleSessions.set(e.session_id, {
        heroId: e.hero_id,
        activityType: e.activity_type,
        accuracy: e.puzzle_accuracy ?? null,
        eventDate: e.event_date,
      });
    }
  }
  console.log(`[Recalc] puzzle sessions (deduped)=${puzzleSessions.size}`);

  for (const [sessionId, session] of puzzleSessions) {
    const sp = puzzleIntelligenceSp(session.activityType, session.accuracy);
    await awardStatSp(
      userId, session.heroId, 'intelligence', sp,
      'puzzle', sessionId, session.eventDate,
    );
  }

  // 5. Level-up SP — 1 SP per stat + 1 extra for primary stat, per level gained.
  for (const hero of userHeroes) {
    const heroDef = HEROES.find(h => h.id === hero.hero_id);
    if (!heroDef || hero.level < 2) continue;

    const primary = primaryPlayerStat(heroDef);
    console.log(`[Recalc] level-up SP for hero=${hero.hero_id} level=${hero.level} primaryPlayerStat=${primary}`);

    for (let level = 2; level <= hero.level; level++) {
      const sessionId = `level_up_${hero.hero_id}_${level}`;
      for (const stat of PLAYER_STATS) {
        const sp = stat === primary ? 2 : 1;
        await awardStatSp(userId, hero.hero_id, stat, sp, 'level_up', sessionId);
      }
    }

    const spTotals: Record<string, number> = {};
    for (const stat of PLAYER_STATS) spTotals[stat] = (hero.level - 1) * (stat === primary ? 2 : 1);
    console.log(`[Recalc] level-up SP totals for ${hero.hero_id}:`, JSON.stringify(spTotals));
  }

  // 6. Lucky day SP — player-wide luck from won luck_checks
  const { data: wonLuckChecks } = await supabase
    .from('luck_checks')
    .select('checked_on')
    .eq('user_id', userId)
    .eq('won', true);

  console.log(`[Recalc] lucky days won=${wonLuckChecks?.length ?? 0}`);
  for (const check of wonLuckChecks ?? []) {
    await awardStatSp(
      userId, GLOBAL_HERO, 'luck', 1,
      'lucky_day', `lucky_day_${check.checked_on}`, check.checked_on,
    );
  }

  // 7. Level-up choices — replay the player's bonus stat pick per hero level.
  const { data: choices } = await supabase
    .from('level_up_choices')
    .select('hero_id, level, chosen_stat')
    .eq('user_id', userId);

  console.log(`[Recalc] level-up choices to replay=${choices?.length ?? 0}`);
  for (const choice of choices ?? []) {
    await awardStatSp(
      userId, choice.hero_id, choice.chosen_stat as PlayerStat,
      1, 'level_up', `level_up_choice_${choice.hero_id}_${choice.level}`,
    );
  }

  // 8. Quest stat rewards — replay from quest_completions using current quest definitions.
  const { data: questCompletions } = await supabase
    .from('quest_completions')
    .select('hero_id, quest_id, period_key')
    .eq('user_id', userId);

  console.log(`[Recalc] quest completions to replay=${questCompletions?.length ?? 0}`);
  for (const completion of questCompletions ?? []) {
    const questDef = ALL_QUESTS_MAP.get(completion.quest_id);
    if (!questDef?.statReward) continue;
    await awardStatSp(
      userId, completion.hero_id, questDef.statReward.stat,
      questDef.statReward.sp, 'quest',
      `quest_${completion.quest_id}_${completion.period_key}`,
    );
  }

  console.log(`[Recalc] DONE`);
}
