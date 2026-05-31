import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../stores/user-store';
import { awardNewCompletions, CompletedQuestInput } from '../services/quest-scheduler';
import type { QuestWithProgress } from './useQuests';

// Detects newly completed quests and fires XP + stat rewards.
// Uses quest_completions as source of truth — safe to call on every render.
export function useQuestRewards(
  heroId: string | undefined,
  dailyQuests: QuestWithProgress[],
  weeklyQuests: QuestWithProgress[],
  monthlyQuests: QuestWithProgress[],
  bossQuests: QuestWithProgress[],
) {
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  // Session-level cache to avoid redundant DB checks for quests already processed
  const awardedThisSession = useRef(new Set<string>());

  const allCompleted: CompletedQuestInput[] = [
    ...dailyQuests, ...weeklyQuests, ...monthlyQuests, ...bossQuests,
  ]
    .filter(q => q.isCompleted)
    .map(q => ({ id: q.id, xpReward: q.xpReward, type: q.type, statReward: q.statReward }));

  // Stable key: only re-run when the set of completed quest IDs changes
  const completionKey = allCompleted.map(q => q.id).sort().join(',');

  useEffect(() => {
    if (!user || !heroId || allCompleted.length === 0) return;

    const unprocessed = allCompleted.filter(q => !awardedThisSession.current.has(q.id));
    if (unprocessed.length === 0) return;

    awardNewCompletions(user.id, heroId, unprocessed).then(awarded => {
      awarded.forEach(id => awardedThisSession.current.add(id));
      if (awarded.length > 0) {
        // Refresh hero XP + progression after rewards land
        queryClient.invalidateQueries({ queryKey: ['active-hero', user.id] });
        queryClient.invalidateQueries({ queryKey: ['hero-progression', user.id] });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionKey, heroId, user?.id]);
}
