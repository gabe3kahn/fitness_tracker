import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../stores/user-store';
import { getPlayerStats, getClaimableBonuses, PlayerStatRow } from '../services/stat-engine';
import { PLAYER_STATS, PlayerStat } from '../constants/stats';

const EMPTY_STATS: Record<PlayerStat, PlayerStatRow> = {
  strength:     { stat: 'strength',     total_sp: 0, level: 1 },
  endurance:    { stat: 'endurance',    total_sp: 0, level: 1 },
  dexterity:    { stat: 'dexterity',    total_sp: 0, level: 1 },
  intelligence: { stat: 'intelligence', total_sp: 0, level: 1 },
  luck:         { stat: 'luck',         total_sp: 0, level: 1 },
};

const EMPTY_BONUSES: Partial<Record<PlayerStat, number>> = {};

export function usePlayerStats(heroId?: string) {
  const { user } = useUserStore();

  const { data: stats } = useQuery({
    queryKey: ['player-stats', user?.id, heroId],
    queryFn: () => (user && heroId ? getPlayerStats(user.id, heroId) : Promise.resolve(EMPTY_STATS)),
    enabled: !!user && !!heroId,
  });

  const { data: claimableBonuses } = useQuery({
    queryKey: ['stat-bonuses', user?.id, heroId],
    queryFn: () => (user && heroId ? getClaimableBonuses(user.id, heroId) : Promise.resolve(EMPTY_BONUSES)),
    enabled: !!user && !!heroId,
    staleTime: 30_000,
  });

  return {
    playerStats: stats ?? EMPTY_STATS,
    claimableBonuses: claimableBonuses ?? EMPTY_BONUSES,
  };
}

export function useRefreshPlayerStats() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['player-stats', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['stat-bonuses', user?.id] });
  };
}
