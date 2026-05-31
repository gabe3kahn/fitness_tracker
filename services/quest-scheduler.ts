import { supabase } from './supabase';
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, QuestDef, QuestType, StatReward } from '../constants/quests';
import { awardQuestXp } from './xp-engine';

// ─── Period key helpers (local timezone) ─────────────────────────────────────

export function getDailyKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function getWeeklyKey(): string {
  const today = new Date();
  const d = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
  return monday.toLocaleDateString('en-CA');
}

export function getMonthlyKey(): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
}

// ─── Selection helpers ────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function eligibleIds(quests: QuestDef[], heroId: string): string[] {
  const today = new Date().getDay();
  return quests
    .filter(q => (q.heroId === undefined || q.heroId === heroId) &&
                 (q.daysOfWeek === undefined || q.daysOfWeek.includes(today)))
    .map(q => q.id);
}

/**
 * Picks `count` quest IDs from `pool` with soft repetition constraints.
 * recentHistory: arrays of quest IDs, most recent period first.
 * hardExcludePeriods: quests from the last N periods are excluded outright.
 * maxInWindow: quests appearing >= this many times across history are soft-excluded.
 * Falls back gracefully if the pool is too small after constraints.
 */
function selectQuests(
  pool: string[],
  count: number,
  recentHistory: string[][],
  hardExcludePeriods: number,
  maxInWindow: number,
): string[] {
  const counts = new Map<string, number>();
  recentHistory.forEach(period =>
    period.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1))
  );

  const hardExcluded = new Set(recentHistory.slice(0, hardExcludePeriods).flat());
  const atLimit = new Set(
    [...counts.entries()].filter(([, n]) => n >= maxInWindow).map(([id]) => id)
  );

  // Try strictest constraints first, fall back if pool too small
  const preferred  = shuffle(pool.filter(id => !hardExcluded.has(id) && !atLimit.has(id)));
  const acceptable = shuffle(pool.filter(id => !hardExcluded.has(id)));
  const fallback   = shuffle([...pool]);

  const candidates = preferred.length >= count ? preferred
    : acceptable.length >= count ? acceptable
    : fallback;

  return candidates.slice(0, Math.min(count, candidates.length));
}

/**
 * Monthly variant: try to have at most 1 repeat from last month's selection.
 */
function selectMonthlyQuests(pool: string[], count: number, lastMonthIds: string[]): string[] {
  const lastMonth = new Set(lastMonthIds);
  const fresh = shuffle(pool.filter(id => !lastMonth.has(id)));
  const carry = shuffle(pool.filter(id => lastMonth.has(id)));

  if (fresh.length >= count) return fresh.slice(0, count);

  // Not enough fresh — allow at most 1 carry-over, then more if pool is tiny
  const result = [...fresh, ...carry.slice(0, 1)];
  if (result.length < count) result.push(...carry.slice(1, count - result.length + 1));
  return result.slice(0, Math.min(count, result.length));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface QuestAssignments {
  daily: string[];
  weekly: string[];
  monthly: string[];
}

export interface CompletedQuestInput {
  id: string;
  xpReward: number;
  type: QuestType;
  statReward?: StatReward;
}

// Checks which completed quests haven't been awarded yet and fires rewards for new ones.
// Returns the IDs that were awarded this call.
export async function awardNewCompletions(
  userId: string,
  heroId: string,
  completedQuests: CompletedQuestInput[],
): Promise<string[]> {
  if (completedQuests.length === 0) return [];

  const periodKeyMap: Record<QuestType, string> = {
    daily:   getDailyKey(),
    weekly:  getWeeklyKey(),
    monthly: getMonthlyKey(),
    boss:    'boss', // boss quests use a fixed key since NULL breaks unique constraints
  };

  // Check which are already recorded in quest_completions
  const periodKeys = [...new Set(completedQuests.map(q => periodKeyMap[q.type]))];
  const { data: existing } = await supabase
    .from('quest_completions')
    .select('quest_id')
    .eq('user_id', userId)
    .in('quest_id', completedQuests.map(q => q.id))
    .in('period_key', periodKeys);

  const alreadyAwarded = new Set((existing ?? []).map(r => r.quest_id as string));
  const toAward = completedQuests.filter(q => !alreadyAwarded.has(q.id));

  if (toAward.length === 0) return [];

  for (const quest of toAward) {
    const periodKey = periodKeyMap[quest.type];
    await awardQuestXp(userId, heroId, quest.id, quest.xpReward, periodKey, quest.statReward);
    await supabase.from('quest_completions').insert({
      user_id: userId,
      hero_id: heroId,
      quest_id: quest.id,
      period_key: periodKey,
      xp_awarded: quest.xpReward,
    });
  }

  return toAward.map(q => q.id);
}

export async function getOrCreateAssignments(userId: string, heroId: string): Promise<QuestAssignments> {
  const dailyKey   = getDailyKey();
  const weeklyKey  = getWeeklyKey();
  const monthlyKey = getMonthlyKey();

  // 1. Check for existing assignments for the current periods
  const { data: current } = await supabase
    .from('quest_assignments')
    .select('period_type, period_key, quest_ids')
    .eq('user_id', userId)
    .eq('hero_id', heroId)
    .in('period_key', [dailyKey, weeklyKey, monthlyKey]);

  const existingDaily   = (current ?? []).find(a => a.period_type === 'daily'   && a.period_key === dailyKey);
  const existingWeekly  = (current ?? []).find(a => a.period_type === 'weekly'  && a.period_key === weeklyKey);
  const existingMonthly = (current ?? []).find(a => a.period_type === 'monthly' && a.period_key === monthlyKey);

  const missing = (
    [existingDaily ? null : 'daily', existingWeekly ? null : 'weekly', existingMonthly ? null : 'monthly'] as const
  ).filter(Boolean) as ('daily' | 'weekly' | 'monthly')[];

  if (missing.length === 0) {
    return {
      daily:   existingDaily!.quest_ids,
      weekly:  existingWeekly!.quest_ids,
      monthly: existingMonthly!.quest_ids,
    };
  }

  // 2. Fetch recent history for each missing period type (past periods only)
  const historyResults = await Promise.all(
    missing.map(type => {
      const currentKey = type === 'daily' ? dailyKey : type === 'weekly' ? weeklyKey : monthlyKey;
      return supabase
        .from('quest_assignments')
        .select('quest_ids')
        .eq('user_id', userId)
        .eq('hero_id', heroId)
        .eq('period_type', type)
        .lt('period_key', currentKey)
        .order('period_key', { ascending: false })
        .limit(7);
    })
  );

  const historyMap = new Map<string, string[][]>();
  missing.forEach((type, i) => {
    historyMap.set(type, (historyResults[i].data ?? []).map(r => r.quest_ids as string[]));
  });

  // 3. Generate selections for missing periods
  const dailyPool   = eligibleIds(DAILY_QUESTS,   heroId);
  const weeklyPool  = eligibleIds(WEEKLY_QUESTS,  heroId);
  const monthlyPool = eligibleIds(MONTHLY_QUESTS, heroId);

  // Daily: 1 quest, exclude yesterday (last 1), max 3 in 7 days
  const newDaily = existingDaily?.quest_ids
    ?? selectQuests(dailyPool, 1, historyMap.get('daily') ?? [], 1, 3);

  // Weekly: 2 quests, exclude last week (last 1 period = 2 quest IDs), max 3 in 7 weeks
  const newWeekly = existingWeekly?.quest_ids
    ?? selectQuests(weeklyPool, 2, historyMap.get('weekly') ?? [], 1, 3);

  // Monthly: 3 quests, at most 1 repeat from last month
  const monthlyHistory = historyMap.get('monthly') ?? [];
  const newMonthly = existingMonthly?.quest_ids
    ?? selectMonthlyQuests(monthlyPool, 3, monthlyHistory[0] ?? []);

  // 4. Upsert new assignments
  const inserts = [
    ...(!existingDaily   ? [{ user_id: userId, hero_id: heroId, period_type: 'daily',   period_key: dailyKey,   quest_ids: newDaily   }] : []),
    ...(!existingWeekly  ? [{ user_id: userId, hero_id: heroId, period_type: 'weekly',  period_key: weeklyKey,  quest_ids: newWeekly  }] : []),
    ...(!existingMonthly ? [{ user_id: userId, hero_id: heroId, period_type: 'monthly', period_key: monthlyKey, quest_ids: newMonthly }] : []),
  ];

  if (inserts.length > 0) {
    await supabase
      .from('quest_assignments')
      .upsert(inserts, { onConflict: 'user_id,hero_id,period_type,period_key' });
  }

  console.log(`[Quests] Assigned — daily: ${newDaily}, weekly: ${newWeekly}, monthly: ${newMonthly}`);

  return { daily: newDaily, weekly: newWeekly, monthly: newMonthly };
}
