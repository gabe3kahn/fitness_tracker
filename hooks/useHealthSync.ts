import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';
import { useActiveHero, useRefreshHero } from './useHeroProgression';
import { useRefreshQuestProgress } from './useQuests';
import { awardXp, HealthInput } from '../services/xp-engine';
import { levelForXp } from '../constants/xp-config';
import { getTierForLevel, HEROES } from '../constants/heroes';
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  queryWorkoutsSince,
  queryTodayStats,
  TodayStats,
  HealthWorkout,
} from '../services/health/healthkit';

// Maps HealthKit activityType strings to our internal activity_type values
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  running: 'run',
  cycling: 'cycle',
  hiking: 'hike',
  walking: 'walk',
  swimming: 'swim',
};

// Don't re-sync more often than this within the same app session
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// On first sync, look back this many days
const FIRST_SYNC_LOOKBACK_DAYS = 30;

export function useHealthSync() {
  const { user } = useUserStore();
  const { data: activeHero } = useActiveHero();
  const refreshHero = useRefreshHero();
  const refreshQuests = useRefreshQuestProgress();
  const [todayStats, setTodayStats] = useState<TodayStats>({ steps: 0, activeCalories: 0, distanceKm: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncTimestamp = useRef<number>(0);

  useEffect(() => {
    if (!user || !activeHero || !isHealthKitAvailable()) return;

    const now = Date.now();
    if (now - lastSyncTimestamp.current < SYNC_COOLDOWN_MS) return;
    lastSyncTimestamp.current = now;

    runSync();
  }, [user?.id, activeHero?.hero_id]);

  async function runSync() {
    if (!user || !activeHero) return;
    setIsSyncing(true);
    try {
      const granted = await requestHealthKitPermissions();
      if (!granted) return;

      // Today's stats update first so the UI has numbers immediately
      const stats = await queryTodayStats();
      setTodayStats(stats);

      // Determine how far back to look
      const { data: connection } = await supabase
        .from('health_connections')
        .select('last_sync_at')
        .eq('user_id', user.id)
        .eq('platform', 'apple_health')
        .maybeSingle();

      const sinceDate = connection?.last_sync_at
        ? new Date(connection.last_sync_at)
        : new Date(Date.now() - FIRST_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

      const workouts = await queryWorkoutsSince(sinceDate);
      if (workouts.length === 0) return;

      const heroDef = HEROES.find((h) => h.id === activeHero.hero_id);
      if (!heroDef) return;

      const today = new Date().toLocaleDateString('en-CA');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let heroState = { ...activeHero };

      for (const workout of workouts) {
        const workoutDate = workout.startDate.toLocaleDateString('en-CA');
        const isToday = workoutDate === today;
        const activityType = ACTIVITY_TYPE_MAP[workout.activityType] ?? workout.activityType;
        const durationMinutes = Math.round(workout.durationSeconds / 60);

        const input: HealthInput = {
          distanceKm: workout.distanceKm,
          activeMinutes: durationMinutes || undefined,
          caloriesBurned: workout.activeCalories,
          workoutCount: 1,
        };

        const result = await awardXp(
          user.id,
          activeHero.hero_id,
          heroDef.primaryStat,
          heroDef.secondaryStat,
          heroState.total_xp,
          heroState.level,
          heroState.streak_days,
          heroState.longest_streak,
          heroState.last_active_date,
          input,
          timezone,
          activityType,
          'apple_health',
          // Historical workouts get their real date; today's workouts omit override so streak fires normally
          isToday ? undefined : workoutDate,
        );

        // Keep heroState in sync for subsequent iterations in this batch
        heroState = {
          ...heroState,
          total_xp: result.newTotalXp,
          level: result.newLevel,
          tier: result.newTier,
          streak_days: result.newStreak,
          longest_streak: result.newLongestStreak,
          last_active_date: isToday ? today : heroState.last_active_date,
        };
      }

      // Record successful sync so next open only fetches new workouts
      await supabase
        .from('health_connections')
        .upsert(
          { user_id: user.id, platform: 'apple_health', last_sync_at: new Date().toISOString(), is_active: true },
          { onConflict: 'user_id,platform' },
        );

      refreshHero();
      refreshQuests();
    } catch (e) {
      console.warn('[HealthSync] Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }

  return { todayStats, isSyncing };
}
