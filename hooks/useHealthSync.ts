import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';
import { useRefreshHero } from './useHeroProgression';
import { useRefreshQuestProgress } from './useQuests';
import { useRefreshPlayerStats } from './usePlayerStats';
import { awardXp, HealthInput } from '../services/xp-engine';
import { awardStatSp } from '../services/stat-engine';
import { HEROES } from '../constants/heroes';
import { ACTIVITY_TO_STAT, PlayerStat } from '../constants/stats';
import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  queryWorkoutsSince,
  queryTodayStats,
  querySleepByNight,
  queryStepsForDate,
  TodayStats,
  SleepSummary,
} from '../services/health/healthkit';

const SLEEP_ENABLED_KEY = 'health_sleep_enabled';

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  running: 'run',
  cycling: 'cycle',
  hiking: 'hike',
  walking: 'walk',
  swimming: 'swim',
};

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
// Module-level so neither hot reloads nor hero switching resets these
let lastSyncTimestamp = 0;
let syncInProgress = false;
let cachedTodayStats: TodayStats = { steps: 0, activeCalories: 0, distanceKm: 0 };
let cachedSleepSummary: SleepSummary | null = null;

export function useHealthSync(activeHeroId?: string) {
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const refreshHero = useRefreshHero();
  const refreshQuests = useRefreshQuestProgress();
  const refreshStats = useRefreshPlayerStats();
  const [todayStats, setTodayStats] = useState<TodayStats>(cachedTodayStats);
  const [sleepSummary, setSleepSummary] = useState<SleepSummary | null>(cachedSleepSummary);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsHealthSetup, setNeedsHealthSetup] = useState(false);
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const activeHeroIdRef = useRef(activeHeroId);
  useEffect(() => { activeHeroIdRef.current = activeHeroId; }, [activeHeroId]);

  useEffect(() => {
    if (!user || !isHealthKitAvailable()) return;
    AsyncStorage.getItem(SLEEP_ENABLED_KEY).then((val) => {
      if (val === 'true') setSleepEnabled(true);
    });
    initializeHealth();
  }, [user?.id]);

  async function initializeHealth() {
    if (!user) return;

    // Always check connection status — not rate-limited, no side effects
    const { data: connection } = await supabase
      .from('health_connections')
      .select('last_sync_at, sleep_enabled')
      .eq('user_id', user.id)
      .eq('platform', 'apple_health')
      .maybeSingle();

    if (!connection) {
      setNeedsHealthSetup(true);
      return;
    }

    // Sync sleep preference from DB → local state (survives AsyncStorage clears)
    if (connection.sleep_enabled) {
      await AsyncStorage.setItem(SLEEP_ENABLED_KEY, 'true');
      setSleepEnabled(true);
    }

    // Fetch display stats once — passed into runSync to avoid a second HealthKit read.
    // No permission request here; queryTodayStats returns zeros if not yet authorized.
    const stats = await queryTodayStats().catch(() => cachedTodayStats);
    cachedTodayStats = stats;
    setTodayStats(stats);

    // Full XP sync (writes to DB) is rate-limited
    const now = Date.now();
    if (now - lastSyncTimestamp < SYNC_COOLDOWN_MS) return;
    lastSyncTimestamp = Date.now();
    runSync(stats);
  }

  async function connectHealth() {
    if (!user) return;
    await requestHealthKitPermissions(false);
    lastSyncTimestamp = Date.now();
    setNeedsHealthSetup(false);
    await runSync();
  }

  async function forceSync() {
    lastSyncTimestamp = 0;
    await initializeHealth();
  }

  async function enableSleepTracking() {
    await AsyncStorage.setItem(SLEEP_ENABLED_KEY, 'true');
    setSleepEnabled(true);
    // Persist to DB so the preference survives AsyncStorage clears / device migration
    if (user) {
      await supabase
        .from('health_connections')
        .update({ sleep_enabled: true })
        .eq('user_id', user.id)
        .eq('platform', 'apple_health');
    }
    // Request sleep permission explicitly now that user opted in, then sync.
    // This is the ONLY place SleepAnalysis is requested — never auto-triggered.
    await requestHealthKitPermissions(true);
    lastSyncTimestamp = Date.now();  // prevent immediate re-sync on next mount
    syncInProgress = false;          // reset in case initial sync was still in progress
    await runSync();
  }

  async function disableSleepTracking() {
    await AsyncStorage.setItem(SLEEP_ENABLED_KEY, 'false');
    setSleepEnabled(false);
    cachedSleepSummary = null;
    setSleepSummary(null);
    if (user) {
      await supabase
        .from('health_connections')
        .update({ sleep_enabled: false })
        .eq('user_id', user.id)
        .eq('platform', 'apple_health');
    }
  }

  async function runSync(prefetchedStats?: TodayStats) {
    if (!user || syncInProgress) return;
    console.log(`[HealthSync] runSync start — activeHeroId=${activeHeroId} activeHeroIdRef=${activeHeroIdRef.current}`);
    syncInProgress = true;
    setIsSyncing(true);
    try {
      const isSleepOn = (await AsyncStorage.getItem(SLEEP_ENABLED_KEY)) === 'true';
      console.log(`[HealthSync] isSleepOn=${isSleepOn}`);

      const today = new Date().toLocaleDateString('en-CA');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const stats = prefetchedStats ?? await queryTodayStats();
      cachedTodayStats = stats;
      setTodayStats(stats);

      const { data: connection } = await supabase
        .from('health_connections')
        .select('created_at, last_sync_at')
        .eq('user_id', user.id)
        .eq('platform', 'apple_health')
        .maybeSingle();

      const sinceDate = connection?.created_at ? new Date(connection.created_at) : new Date();
      const workouts = await queryWorkoutsSince(sinceDate);

      // Determine ordered set of dates to process: all workout dates + today
      const dateSet = new Set<string>(workouts.map(w => w.startDate.toLocaleDateString('en-CA')));
      dateSet.add(today);
      const dates = [...dateSet].sort();
      console.log(`[HealthSync] dates to process: ${dates.join(', ')}`);

      // Group workouts by local date, sorted oldest-first within each day
      const workoutsByDate = new Map<string, typeof workouts>();
      for (const w of workouts) {
        const d = w.startDate.toLocaleDateString('en-CA');
        if (!workoutsByDate.has(d)) workoutsByDate.set(d, []);
        workoutsByDate.get(d)!.push(w);
      }
      for (const day of workoutsByDate.values()) {
        day.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      }

      // Query sleep for the full date range in one HealthKit call, bucketed by night
      let sleepByNight = new Map<string, SleepSummary | null>();
      if (isSleepOn && dates.length > 0) {
        const sleepRangeStart = new Date(`${dates[0]}T18:00:00`);
        sleepRangeStart.setDate(sleepRangeStart.getDate() - 1); // night before earliest date
        sleepByNight = await querySleepByNight(sleepRangeStart, new Date());
      }
      const todaySleep = sleepByNight.get(today) ?? null;
      cachedSleepSummary = todaySleep;
      setSleepSummary(todaySleep);

      const { data: allHeroes } = await supabase
        .from('user_heroes')
        .select('*')
        .eq('user_id', user.id);

      if (!allHeroes || allHeroes.length === 0) return;

      // Prefetch all read-only data before the hero loop to avoid N×M sequential DB/HealthKit calls.
      const stableIds = workouts.map(w => `ah_${Math.round(w.startDate.getTime() / 1000)}_${w.activityType}`);
      const prefetchStart = Date.now();
      const [stepsEntries, processedRes, stepsLoggedRes] = await Promise.all([
        // HealthKit steps for every date — parallel across dates, run once (not once per hero)
        Promise.all(dates.map(async (d): Promise<[string, number]> => [
          d, d === today ? stats.steps : await queryStepsForDate(d),
        ])),
        // Which (hero, workout) pairs already have xp_events rows
        stableIds.length > 0
          ? supabase.from('xp_events').select('hero_id, session_id').eq('user_id', user.id).in('session_id', stableIds)
          : Promise.resolve({ data: [] as Array<{ hero_id: string; session_id: string }> }),
        // Previously logged step totals per hero per date
        supabase.from('xp_events').select('hero_id, event_date, raw_value').eq('user_id', user.id).eq('source', 'steps').eq('source_platform', 'apple_health').in('event_date', dates),
      ]);
      const stepsByDate = new Map(stepsEntries);
      const processedSet = new Set((processedRes.data ?? []).map(e => `${e.hero_id}:${e.session_id}`));
      const previousStepsMap = new Map<string, number>();
      for (const row of stepsLoggedRes.data ?? []) {
        const key = `${row.hero_id}:${row.event_date}`;
        previousStepsMap.set(key, (previousStepsMap.get(key) ?? 0) + (row.raw_value ?? 0));
      }
      console.log(`[HealthSync] prefetch done in ${Date.now() - prefetchStart}ms — steps=${stepsByDate.size} dates, processed=${processedSet.size} workout-hero pairs, stepsLogged=${stepsLoggedRes.data?.length ?? 0} rows`);

      // workout_sessions rows are hero-agnostic — insert once across all heroes
      const insertedWorkoutSessions = new Set<string>();

      console.log(`[HealthSync] processing ${allHeroes.length} heroes across ${dates.length} dates, ${workouts.length} workouts`);

      for (const hero of allHeroes) {
        // In production builds only sync the active hero; dev syncs all heroes in parallel
        if (!__DEV__ && hero.hero_id !== activeHeroIdRef.current) continue;

        const heroDef = HEROES.find((h) => h.id === hero.hero_id);
        if (!heroDef) continue;

        const isActiveHero = hero.hero_id === activeHeroIdRef.current;
        const startLevel = hero.level;
        let heroState = { ...hero };
        console.log(`[HealthSync] hero=${hero.hero_id} currentXp=${hero.total_xp} level=${hero.level}`);

        // Process day by day: sleep → workouts → steps, oldest first
        for (const date of dates) {
          const isToday = date === today;
          const sleepEntry = sleepByNight.get(date);
          const sleepMult = sleepEntry?.multiplier ?? 1;
          console.log(`[HealthSync] --- date=${date} sleep=${sleepEntry ? `${sleepEntry.totalHours.toFixed(1)}h (${sleepEntry.label} ×${sleepMult})` : 'none'} workouts=${workoutsByDate.get(date)?.length ?? 0} isToday=${isToday} ---`);

          // --- Workouts for this date ---
          for (const workout of workoutsByDate.get(date) ?? []) {
            const stableId = `ah_${Math.round(workout.startDate.getTime() / 1000)}_${workout.activityType}`;
            const activityType = ACTIVITY_TYPE_MAP[workout.activityType] ?? workout.activityType;
            const durationMinutes = Math.round(workout.durationSeconds / 60);
            const elevationFt = workout.elevationM != null ? workout.elevationM * 3.28084 : undefined;
            const paceMinPerKm = workout.avgSpeedMps != null && workout.avgSpeedMps > 0
              ? 1000 / (workout.avgSpeedMps * 60)
              : workout.distanceKm && workout.distanceKm > 0
                ? durationMinutes / workout.distanceKm
                : undefined;

            // Write workout_sessions once per workout (hero-agnostic)
            if (!insertedWorkoutSessions.has(stableId)) {
              insertedWorkoutSessions.add(stableId);
              await supabase.from('workout_sessions').upsert({
                user_id: user.id,
                session_id: stableId,
                activity_type: activityType,
                activity_name: workout.name ?? null,
                distance_km: workout.distanceKm ?? null,
                duration_minutes: durationMinutes,
                elevation_ft: elevationFt ?? null,
                pace_min_per_km: paceMinPerKm ?? null,
                calories: workout.activeCalories ?? null,
                is_indoor: workout.isIndoor ?? false,
                workout_date: date,
                source_platform: 'apple_health',
              }, { onConflict: 'user_id,session_id', ignoreDuplicates: true });
              console.log(`[HealthSync] workout_session upserted stableId=${stableId} elevFt=${elevationFt?.toFixed(0) ?? 'n/a'} paceMinKm=${paceMinPerKm?.toFixed(2) ?? 'n/a'}`);
            }

            if (processedSet.has(`${hero.hero_id}:${stableId}`)) {
              console.log(`[HealthSync] skipping already-processed workout hero=${hero.hero_id} stableId=${stableId}`);
              continue;
            }

            console.log(`[HealthSync] processing workout hero=${hero.hero_id} type=${activityType} date=${date} durationMin=${durationMinutes} distKm=${workout.distanceKm?.toFixed(2) ?? 'n/a'} elevFt=${elevationFt?.toFixed(0) ?? 'n/a'} pace=${paceMinPerKm?.toFixed(2) ?? 'n/a'} name=${workout.name ?? 'n/a'} sleepMult=${sleepMult} stableId=${stableId}`);

            const hasDist = (workout.distanceKm ?? 0) > 0;
            const input: HealthInput = {
              ...(activityType === 'swim'  && hasDist ? { distanceSwimKm:  workout.distanceKm } :
                  activityType === 'cycle' && hasDist ? { distanceCycleKm: workout.distanceKm } :
                  (activityType === 'hike' || activityType === 'walk') && hasDist ? { distanceHikeKm: workout.distanceKm } :
                  hasDist ? { distanceRunKm: workout.distanceKm } :
                  { workoutMinutes: Math.min(durationMinutes, 120) || undefined }),
              elevationFt,
            };

            const result = await awardXp(
              user.id, hero.hero_id, heroDef.primaryStat, heroDef.secondaryStat,
              heroState.total_xp, heroState.level, heroState.streak_days,
              heroState.longest_streak, heroState.last_active_date,
              input, timezone, activityType, 'apple_health',
              isToday ? undefined : date,
              durationMinutes >= 20,
              stableId,
              sleepMult,
            );

            heroState = {
              ...heroState,
              total_xp: result.newTotalXp,
              level: result.newLevel,
              tier: result.newTier,
              streak_days: result.newStreak,
              longest_streak: result.newLongestStreak,
              last_active_date: durationMinutes >= 20 ? date : heroState.last_active_date,
            };

            const workoutStat = ACTIVITY_TO_STAT[activityType];
            if (workoutStat && durationMinutes > 0) {
              await awardStatSp(user.id, hero.hero_id, workoutStat, durationMinutes, 'workout', stableId, date);
            }
          }

          // --- Steps for this date ---
          const totalSteps = stepsByDate.get(date) ?? 0;
          if (totalSteps > 0) {
            const previousSteps = previousStepsMap.get(`${hero.hero_id}:${date}`) ?? 0;
            const deltaSteps = totalSteps - previousSteps;
            console.log(`[HealthSync] steps date=${date} total=${totalSteps} previousLogged=${previousSteps} delta=${deltaSteps} sleepMult=${sleepMult}`);

            if (deltaSteps > 0) {
              const result = await awardXp(
                user.id, hero.hero_id, heroDef.primaryStat, heroDef.secondaryStat,
                heroState.total_xp, heroState.level, heroState.streak_days,
                heroState.longest_streak, heroState.last_active_date,
                { steps: deltaSteps }, timezone, 'steps', 'apple_health',
                isToday ? undefined : date, false, undefined, sleepMult,
              );
              heroState = { ...heroState, total_xp: result.newTotalXp, level: result.newLevel, tier: result.newTier };
            }
          }
        }

      }

      await supabase
        .from('health_connections')
        .upsert(
          { user_id: user.id, platform: 'apple_health', last_sync_at: new Date().toISOString(), is_active: true },
          { onConflict: 'user_id,platform' },
        );

      refreshHero();
      refreshQuests();
      refreshStats();
      queryClient.invalidateQueries({ queryKey: ['workout-history'] });
    } catch (e) {
      console.warn('[HealthSync] Sync failed:', e);
    } finally {
      syncInProgress = false;
      setIsSyncing(false);
    }
  }

  return { todayStats, sleepSummary, isSyncing, needsHealthSetup, sleepEnabled, connectHealth, forceSync, enableSleepTracking, disableSleepTracking };
}
