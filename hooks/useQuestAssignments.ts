import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../stores/user-store';
import { getOrCreateAssignments, getDailyKey, QuestAssignments } from '../services/quest-scheduler';

const EMPTY: QuestAssignments = { daily: [], weekly: [], monthly: [] };

export function useQuestAssignments(heroId?: string): QuestAssignments & { isLoading: boolean } {
  const { user } = useUserStore();
  // Include today's date so the query reruns automatically when the day rolls over
  const today = getDailyKey();

  const { data = EMPTY, isLoading } = useQuery({
    queryKey: ['quest-assignments', user?.id, heroId, today],
    queryFn: () => getOrCreateAssignments(user!.id, heroId!),
    enabled: !!user && !!heroId,
    // Immutable once created — period key change (via today) handles daily refresh
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });

  return { ...data, isLoading };
}
