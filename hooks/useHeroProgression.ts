import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';
import { HEROES } from '../constants/heroes';

export interface ActiveHeroRow {
  id: string;
  user_id: string;
  hero_id: string;
  is_active: boolean;
  total_xp: number;
  level: number;
  tier: string;
  streak_days: number;
  longest_streak: number;
  last_active_date: string | null;
}

export function useActiveHero() {
  const { user } = useUserStore();

  return useQuery({
    queryKey: ['active-hero', user?.id],
    queryFn: async (): Promise<ActiveHeroRow | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_heroes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data ?? null;
    },
    enabled: !!user,
  });
}

export function useActiveHeroDef(heroId: string | undefined) {
  return HEROES.find((h) => h.id === heroId) ?? null;
}

export function useRefreshHero() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  return () => queryClient.invalidateQueries({ queryKey: ['active-hero', user?.id] });
}
