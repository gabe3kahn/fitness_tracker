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
import { STREAK_BONUS } from '../constants/xp-config';
import {
  isHealthKitAvailable,
  isHealthKitAuthorized,
  requestHealthKitPermissions,
  queryWorkoutsSince,
  queryTodayStats,
  querySleepByNight,
  queryStepsForDate,
  TodayStats,
  SleepSummary,
} from '../services/health/healthkit';
import {
  activityTypeToMinuteField,
  isStrengthActivity,
  isPaceActivity,
  getWorkoutSkillMultiplier,
  getWorkoutFlatBonus,
  getDaySkillResult,
  checkActiveSkills,
  updatePaceAverages,
  getPaceAverages,
  getConsecutiveCyclingDays,
} from '../services/skill-engine';

const SLEEP_ENABLED_KEY = 'health_sleep_enabled';

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  running: 'run',
  cycling: 'cycle',
  hiking: 'hike',
  walking: 'walk',
  swimming: 'swim',
  highintensityintervaltraining: 'hiit',
  traditionalstrengthtraining: 'traditionalstrengthtraining',
  functionalstrengthtraining: 'functionalstrengthtraining',
  yoga: 'yoga',
  pilates: 'pilates',
};

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
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
  const [isConnecting, setIsConnecting] = useState(false);
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

    if (connection.sleep_enabled) {
      await AsyncStorage.setItem(SLEEP_ENABLED_KEY, 'true');
      setSleepEnabled(true);
    }

    const authorized = await isHealthKitAuthorized(connection.sleep_enabled ?? false);
    if (!authorized) {
      setNeedsHealthSetup(true);
      return;
    }

    const stats = await queryTodayStats().catch(() => cachedTodayStats);
    cachedTodayStats = stats;
    setTodayStats(stats);

    const now = Date.now();
    if (now - lastSyncTimestamp < SYNC_COOLDOWN_MS) return;
    lastSyncTimestamp = Date.now();
    runSync(stats);
  }

  async function connectHealth() {
    if (!user) return;
    setIsConnecting(true);
    try {
      const granted = await requestHealthKitPermissions(false);
      if (!granted) {
        console.warn('[HealthSync] connectHealth: requestHealthKitPermissions returned false');
        return;
      }
      lastSyncTimestamp = Date.now();
      setNeedsHealthSetup(false);
      await runSync();
    } finally {
      setIsConnecting(false);
    }
  }

  async function forceSync() {
    lastSyncTimestamp = 0;
    await initializeHealth();
  }

  async function enableSleepTracking() {
    await AsyncStorage.setItem(SLEEP_ENABLED_KEY, 'true');
    setSleepEnabled(true);
    if (user) {
      await supabase
        .from('health_connections')
        .update({ sleep_enabled: true })
        .eq('user_id', user.id)
        .eq('platform', 'apple_health');
    }
    await requestHealthKitPermissions(true);
    lastSyncTimestamp = Date.now();
    syncInProgress = false;
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

      const dateSet = new Set<string>(workouts.map(w => w.startDate.toLocaleDateString('en-CA')));
      dateSet.add(today);
      const dates = [...dateSet].sort();
      console.log(`[HealthSync] dates to process: ${dates.join(', ')}`);

      const workoutsByDate = new Map<string, typeof workouts>();
      for (const w of workouts) {
        const d = w.startDate.toLocaleDateString('en-CA');
        if (!workoutsByDate.has(d)) workoutsByDate.set(d, []);
        workoutsByDate.get(d)!.push(w);
      }
      for (const day of workoutsByDate.values()) {
        day.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      }

      let sleepByNight = new Map<string, SleepSummary | null>();
      if (isSleepOn && dates.length > 0) {
        const sleepRangeStart = new Date(`${dates[0]}T18:00:00`);
        sleepRangeStart.setDate(sleepRangeStart.getDate() - 1);
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

      // Prefetch read-only data shared across heroes
      const stableIds = workouts.map(w => `ah_${Math.round(w.startDate.getTime() / 1000)}_${w.activityType}`);
      const prefetchStart = Date.now();
      const [stepsEntries, processedRes, stepsLoggedRes] = await Promise.all([
        Promise.all(dates.map(async (d): Promise<[string, number]> => [
          d, d === today ? stats.steps : await queryStepsForDate(d),
        ])),
        stableIds.length > 0
          ? supabase.from('xp_events').select('hero_id, session_id').eq('user_id', user.id).in('session_id', stableIds)
          : Promise.resolve({ data: [] as Array<{ hero_id: string; session_id: string }> }),
        supabase.from('xp_events').select('hero_id, event_date, raw_value').eq('user_id', user.id).eq('source', 'steps').eq('source_platform', 'apple_health').in('event_date', dates),
      ]);
      const stepsByDate = new Map(stepsEntries);
      const processedSet = new Set((processedRes.data ?? []).map(e => `${e.hero_id}:${e.session_id}`));
      const previousStepsMap = new Map<string, number>();
      for (const row of stepsLoggedRes.data ?? []) {
        const key = `${row.hero_id}:${row.event_date}`;
        previousStepsMap.set(key, (previousStepsMap.get(key) ?? 0) + (row.raw_value ?? 0));
      }
      console.log(`[HealthSync] prefetch done in ${Date.now() - prefetchStart}ms`);

      // Update pace averages for all heroes (used by Gáe Bulg + FE display)
      await updatePaceAverages(user.id, today);
      const paceAverages = await getPaceAverages(user.id);

      // Pre-fetch HIIT count this week (needed for Riastrad and Red Branch Knight)
      const d = new Date(`${today}T12:00:00`);
      const dow = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((dow + 6) % 7));
      const weekStart = monday.toLocaleDateString('en-CA');
      const { count: weeklyHiitCount } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('activity_type', 'hiit')
        .gte('workout_date', weekStart)
        .lte('workout_date', today);
      const weekHasHiit = (weeklyHiitCount ?? 0) > 0;

      const insertedWorkoutSessions = new Set<string>();

      console.log(`[HealthSync] processing ${allHeroes.length} heroes across ${dates.length} dates, ${workouts.length} workouts`);

      for (const hero of allHeroes) {
        if (!__DEV__ && hero.hero_id !== activeHeroIdRef.current) continue;

        const heroDef = HEROES.find((h) => h.id === hero.hero_id);
        if (!heroDef) continue;

        const isActiveHero = hero.hero_id === activeHeroIdRef.current;
        const startLevel = hero.level;
        let heroState = { ...hero };
        console.log(`[HealthSync] hero=${hero.hero_id} currentXp=${hero.total_xp} level=${hero.level}`);

        // Yoshitsune streak options
        const streakOpts = heroDef.secondaryStat === 'streaks' && hero.level >= 5
          ? {
              perDayPercent: STREAK_BONUS.perDayPercentYoshitsune,
              maxPercent: hero.level >= 20 ? STREAK_BONUS.maxPercentGenpei : STREAK_BONUS.maxPercent,
              preserveHalfOnBreak: hero.level >= 15,
            }
          : {};

        // Consecutive cycling days (Boudicca Lv25 Eternal Flame)
        const consecutiveCyclingDays = heroDef.id === 'boudicca' && hero.level >= 25
          ? await getConsecutiveCyclingDays(user.id, today)
          : 0;

        for (const date of dates) {
          const isToday = date === today;
          const sleepEntry = sleepByNight.get(date);
          const sleepMult = sleepEntry?.multiplier ?? 1;
          const dayWorkouts = workoutsByDate.get(date) ?? [];
          console.log(`[HealthSync] --- date=${date} sleep=${sleepEntry ? `${sleepEntry.totalHours.toFixed(1)}h (${sleepEntry.label} ×${sleepMult})` : 'none'} workouts=${dayWorkouts.length} isToday=${isToday} ---`);

          // Build activityTypes Set for this day (for Mulan skills + Argonaut Sprint)
          const activityTypes = new Set<string>();
          for (const w of dayWorkouts) {
            const mapped = ACTIVITY_TYPE_MAP[w.activityType] ?? w.activityType;
            activityTypes.add(mapped);
          }

          // Accumulate day-level XP for Mulan variety bonus
          let dayWorkoutXp = 0;

          // --- Workouts ---
          for (const workout of dayWorkouts) {
            const stableId = `ah_${Math.round(workout.startDate.getTime() / 1000)}_${workout.activityType}`;
            const activityType = ACTIVITY_TYPE_MAP[workout.activityType] ?? workout.activityType;
            const durationMinutes = Math.round(workout.durationSeconds / 60);
            const elevationFt = workout.elevationM != null ? workout.elevationM * 3.28084 : undefined;
            const paceMinPerKm = workout.avgSpeedMps != null && workout.avgSpeedMps > 0
              ? 1000 / (workout.avgSpeedMps * 60)
              : workout.distanceKm && workout.distanceKm > 0
                ? durationMinutes / workout.distanceKm
                : undefined;

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
              console.log(`[HealthSync] workout_session upserted stableId=${stableId}`);
            }

            if (processedSet.has(`${hero.hero_id}:${stableId}`)) {
              console.log(`[HealthSync] skipping already-processed workout hero=${hero.hero_id} stableId=${stableId}`);
              continue;
            }

            // Build HealthInput with activity-specific minute field
            const isDistancePrimary = ['run', 'cycle', 'hike', 'walk', 'swim'].includes(activityType);
            const minuteField = activityTypeToMinuteField(activityType);
            const hasDist = (workout.distanceKm ?? 0) > 0;

            const input: HealthInput = {
              ...(activityType === 'swim'  && hasDist ? { distanceSwimKm:  workout.distanceKm } :
                  activityType === 'cycle' && hasDist ? { distanceCycleKm: workout.distanceKm } :
                  (activityType === 'hike' || activityType === 'walk') && hasDist ? { distanceHikeKm: workout.distanceKm } :
                  activityType === 'run'   && hasDist ? { distanceRunKm:   workout.distanceKm } :
                  {}),
              // For distance activities, also capture duration as minute source
              // For pure minute activities, duration is the primary source
              [minuteField]: isDistancePrimary ? undefined : durationMinutes || undefined,
              ...(!isDistancePrimary ? {} : durationMinutes >= 20 ? { [minuteField]: durationMinutes } : {}),
              elevationFt,
            };

            const skillCtx = {
              userId: user.id,
              heroId: hero.hero_id,
              heroDef,
              heroLevel: hero.level,
              activityType,
              durationMinutes,
              distanceKm: workout.distanceKm,
              paceMinPerKm,
              weeklyHiitCount: weeklyHiitCount ?? 0,
              weekHasHiit,
              avgPaceMinPerKm: isPaceActivity(activityType) ? paceAverages[activityType] : undefined,
            };

            console.log(`[HealthSync] processing workout hero=${hero.hero_id} type=${activityType} date=${date} durationMin=${durationMinutes} distKm=${workout.distanceKm?.toFixed(2) ?? 'n/a'} sleepMult=${sleepMult} stableId=${stableId}`);

            const result = await awardXp(
              user.id, hero.hero_id, heroDef.primaryStat, heroDef.secondaryStat,
              heroState.total_xp, heroState.level, heroState.streak_days,
              heroState.longest_streak, heroState.last_active_date,
              input, timezone, activityType, 'apple_health',
              isToday ? undefined : date,
              durationMinutes >= 20,
              stableId,
              sleepMult,
              undefined,
              streakOpts,
            );

            // Apply skill multipliers on top of base XP result
            const skillMult = getWorkoutSkillMultiplier(result.totalXp, skillCtx);
            const flatBonus = getWorkoutFlatBonus(skillCtx);
            const skillXp = Math.floor(result.totalXp * skillMult) - result.totalXp + flatBonus;
            if (skillXp > 0) {
              // Award the skill delta as a separate event for clean accounting
              await supabase.from('xp_events').insert({
                user_id: user.id,
                hero_id: hero.hero_id,
                source: 'skill_bonus',
                raw_value: skillXp,
                xp_earned: skillXp,
                bonus_multiplier: skillMult,
                event_date: date,
                source_platform: 'skill',
                activity_type: activityType,
                session_id: `${stableId}_skill`,
                timezone,
              });
              await supabase.from('user_heroes')
                .update({ total_xp: result.newTotalXp + skillXp })
                .eq('user_id', user.id)
                .eq('hero_id', hero.hero_id);
              console.log(`[Skill] workout bonus hero=${hero.hero_id} mult=${skillMult.toFixed(2)} flat=${flatBonus} skillXp=${skillXp}`);
            }

            dayWorkoutXp += result.totalXp + skillXp;

            heroState = {
              ...heroState,
              total_xp: result.newTotalXp + skillXp,
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

          // --- Steps ---
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
                isToday ? undefined : date, false, undefined, sleepMult, undefined, streakOpts,
              );
              heroState = { ...heroState, total_xp: result.newTotalXp, level: result.newLevel, tier: result.newTier };
            }
          }

          // --- Day-level skill bonuses (Mulan variety, Argonaut Sprint, Eternal Flame) ---
          // Add puzzle to activityTypes if any puzzle XP was logged today
          const { data: puzzleToday } = await supabase
            .from('xp_events')
            .select('id')
            .eq('user_id', user.id)
            .eq('source', 'puzzle')
            .eq('event_date', date)
            .limit(1);
          if ((puzzleToday ?? []).length > 0) activityTypes.add('puzzle');

          const daySkillCtx = {
            userId: user.id,
            heroId: hero.hero_id,
            heroDef,
            heroLevel: hero.level,
            date,
            activityTypes,
            dayXp: dayWorkoutXp,
            dayHasRun: activityTypes.has('run'),
          };

          const { dayMultiplier, stepsMultiplier } = getDaySkillResult(daySkillCtx, consecutiveCyclingDays);

          // Mulan primary variety bonus (+50% class bonus on 2+ activity type days)
          const varietyBonus = heroDef.primaryStat === 'variedActivity' && activityTypes.size >= 2
            ? 0.50  // +50% on all workout XP that day
            : 0;
          const totalDayMult = dayMultiplier * (1 + varietyBonus) - 1;  // excess over 1.0
          if (totalDayMult > 0 && dayWorkoutXp > 0) {
            const dayBonusXp = Math.floor(dayWorkoutXp * totalDayMult);
            if (dayBonusXp > 0) {
              await supabase.from('xp_events').insert({
                user_id: user.id,
                hero_id: hero.hero_id,
                source: 'day_skill_bonus',
                raw_value: dayBonusXp,
                xp_earned: dayBonusXp,
                bonus_multiplier: 1 + totalDayMult,
                event_date: date,
                source_platform: 'skill',
                activity_type: 'day_bonus',
                session_id: `day_bonus_${hero.hero_id}_${date}`,
                timezone,
              });
              await supabase.from('user_heroes')
                .update({ total_xp: heroState.total_xp + dayBonusXp })
                .eq('user_id', user.id)
                .eq('hero_id', hero.hero_id);
              heroState = { ...heroState, total_xp: heroState.total_xp + dayBonusXp };
              console.log(`[Skill] day bonus hero=${hero.hero_id} date=${date} mult=${(1 + totalDayMult).toFixed(2)} xp=${dayBonusXp} types=[${[...activityTypes].join(',')}]`);
            }
          }

          // Steps skill multiplier (Argonaut Sprint, Legend of Hua)
          if (stepsMultiplier > 1 && totalSteps > 0) {
            const stepsXpBase = Math.floor(totalSteps / 1);  // rough — actual steps XP already awarded above
            const stepsBonus = Math.floor((stepsMultiplier - 1) * (totalSteps / 500));  // deltaSteps/stepsPerXp
            if (stepsBonus > 0) {
              await supabase.from('xp_events').insert({
                user_id: user.id,
                hero_id: hero.hero_id,
                source: 'steps_skill_bonus',
                raw_value: stepsBonus,
                xp_earned: stepsBonus,
                bonus_multiplier: stepsMultiplier,
                event_date: date,
                source_platform: 'skill',
                activity_type: 'steps',
                session_id: `steps_skill_${hero.hero_id}_${date}`,
                timezone,
              });
              await supabase.from('user_heroes')
                .update({ total_xp: heroState.total_xp + stepsBonus })
                .eq('user_id', user.id)
                .eq('hero_id', hero.hero_id);
              heroState = { ...heroState, total_xp: heroState.total_xp + stepsBonus };
              console.log(`[Skill] steps bonus hero=${hero.hero_id} date=${date} mult=${stepsMultiplier.toFixed(2)} xp=${stepsBonus}`);
            }
          }
        }

        // --- Active skill checks (end of sync) ---
        await checkActiveSkills(
          { userId: user.id, heroId: hero.hero_id, heroDef, heroLevel: hero.level },
          today,
          heroState.streak_days,
        );
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

  return { todayStats, sleepSummary, isSyncing, isConnecting, needsHealthSetup, sleepEnabled, connectHealth, forceSync, enableSleepTracking, disableSleepTracking };
}
