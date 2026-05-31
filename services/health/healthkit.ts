import { Platform } from 'react-native';

export function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios';
}

export interface HealthWorkout {
  id: string;
  activityType: string;
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  distanceKm?: number;
  activeCalories?: number;
  elevationM?: number;
  avgSpeedMps?: number;
  isIndoor?: boolean;
  name?: string;
}

export interface TodayStats {
  steps: number;
  activeCalories: number;
  distanceKm: number;
}

export interface SleepSummary {
  totalHours: number;
  deepHours: number;
  remHours: number;
  multiplier: 0.9 | 1.0 | 1.1;
  label: 'Poor' | 'Normal' | 'Well Rested';
}

const METERS_TO_KM = 0.001;

// CategoryValueSleepAnalysis numeric values from HealthKit (stable constants)
// inBed=0, asleepUnspecified/asleep=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5
const ASLEEP_VALUES = new Set([1, 3, 4, 5]);
const DEEP_VALUE = 4;
const REM_VALUE = 5;

const BASE_READ_IDENTIFIERS = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierHeartRate',
] as const;

const SLEEP_READ_IDENTIFIERS = [
  ...BASE_READ_IDENTIFIERS,
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

let _hk: typeof import('@kingstinct/react-native-healthkit') | null = null;

async function getHK() {
  if (!_hk) {
    _hk = await import('@kingstinct/react-native-healthkit');
  }
  return _hk;
}

export async function requestHealthKitPermissions(includeSleep = false): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  try {
    const hk = await getHK();
    const identifiers = includeSleep ? SLEEP_READ_IDENTIFIERS : BASE_READ_IDENTIFIERS;
    console.log('[HealthKit] requestAuthorization identifiers:', identifiers);
    await hk.requestAuthorization({ toRead: identifiers as any, toShare: [] });
    console.log('[HealthKit] requestAuthorization resolved');
    return true;
  } catch (e) {
    console.warn('[HealthKit] Permission request failed:', e);
    return false;
  }
}

// Queries all sleep samples in rangeStart→rangeEnd, buckets by "morning date" (the date you
// wake up on), and returns a SleepSummary per night. One HealthKit call for the whole range.
// morningDate D = samples starting in [D-1 6pm, D 2pm]. Samples 2pm–6pm are ignored (naps).
export async function querySleepByNight(rangeStart: Date, rangeEnd: Date): Promise<Map<string, SleepSummary | null>> {
  if (!isHealthKitAvailable()) return new Map();
  try {
    const hk = await getHK();
    const samples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate: rangeStart, endDate: rangeEnd } },
      limit: 0,
    });
    console.log(`[HealthKit] sleep range ${rangeStart.toISOString()}→${rangeEnd.toISOString()}: ${samples?.length ?? 0} samples`);
    if (!samples || samples.length === 0) return new Map();

    // Attribute each sample to its morning date
    const grouped = new Map<string, { samples: typeof samples; cutoff: Date }>();
    for (const s of samples) {
      const h = s.startDate.getHours();
      if (h >= 14 && h < 18) continue; // afternoon — skip (nap window)
      const morning = new Date(s.startDate);
      morning.setHours(0, 0, 0, 0);
      if (h >= 18) morning.setDate(morning.getDate() + 1); // 6pm+ belongs to next morning
      const key = morning.toLocaleDateString('en-CA');
      const cutoff = new Date(`${key}T14:00:00`);
      if (!grouped.has(key)) grouped.set(key, { samples: [], cutoff });
      grouped.get(key)!.samples.push(s);
    }

    const result = new Map<string, SleepSummary | null>();
    for (const [dateStr, { samples: night, cutoff }] of grouped) {
      let totalSeconds = 0, deepSeconds = 0, remSeconds = 0;
      for (const s of night) {
        if (!ASLEEP_VALUES.has(s.value as number)) continue;
        if (s.startDate >= cutoff) continue;
        const dur = (s.endDate.getTime() - s.startDate.getTime()) / 1000;
        totalSeconds += dur;
        if ((s.value as number) === DEEP_VALUE) deepSeconds += dur;
        if ((s.value as number) === REM_VALUE) remSeconds += dur;
      }
      if (totalSeconds < 30 * 60) { result.set(dateStr, null); continue; }
      const totalHours = totalSeconds / 3600;
      const multiplier: SleepSummary['multiplier'] = totalHours >= 7.5 ? 1.1 : totalHours >= 6 ? 1.0 : 0.9;
      const label: SleepSummary['label'] = totalHours >= 7.5 ? 'Well Rested' : totalHours >= 6 ? 'Normal' : 'Poor';
      const summary = { totalHours, deepHours: deepSeconds / 3600, remHours: remSeconds / 3600, multiplier, label };
      console.log(`[HealthKit] sleep ${dateStr}: totalHrs=${totalHours.toFixed(1)} label=${label} mult=${multiplier}`);
      result.set(dateStr, summary);
    }
    return result;
  } catch (e) {
    console.warn('[HealthKit] Sleep range query failed:', e);
    return new Map();
  }
}

export async function queryStepsForDate(dateStr: string): Promise<number> {
  if (!isHealthKitAvailable()) return 0;
  try {
    const hk = await getHK();
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(`${dateStr}T23:59:59`);
    const result = await hk.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: { date: { startDate: start, endDate: end } } },
    );
    return Math.round(result?.sumQuantity?.quantity ?? 0);
  } catch (e) {
    console.warn(`[HealthKit] Steps query for ${dateStr} failed:`, e);
    return 0;
  }
}

// When Apple Watch + a 3rd-party app (Strava, Nike Run Club, etc.) both write the same
// session to HealthKit, we get two HKWorkout objects with different stable UUIDs.
// Deduplicate by treating same-type workouts with overlapping time windows as one session,
// keeping the entry with the longer duration (more complete data).
function deduplicateWorkouts(workouts: HealthWorkout[]): HealthWorkout[] {
  const byDuration = [...workouts].sort((a, b) => b.durationSeconds - a.durationSeconds);
  const kept: HealthWorkout[] = [];
  for (const w of byDuration) {
    const overlaps = kept.some(
      (k) =>
        k.activityType === w.activityType &&
        k.startDate < w.endDate &&
        w.startDate < k.endDate,
    );
    if (!overlaps) kept.push(w);
  }
  return kept;
}

export async function queryWorkoutsSince(sinceDate: Date): Promise<HealthWorkout[]> {
  if (!isHealthKitAvailable()) return [];
  try {
    const hk = await getHK();
    console.log(`[HealthKit] queryWorkouts since=${sinceDate.toISOString()}`);
    const raw = await hk.queryWorkoutSamples({
      filter: { date: { startDate: sinceDate } },
      limit: 0,
      ascending: true,
    });

    const activityTypeEnum = hk.WorkoutActivityType as unknown as Record<number, string>;

    const workouts: HealthWorkout[] = (raw ?? []).map((w) => ({
      id: w.uuid,
      activityType: (activityTypeEnum[w.workoutActivityType as unknown as number] ?? 'other').toLowerCase(),
      startDate: w.startDate,
      endDate: w.endDate,
      durationSeconds: w.duration.quantity,
      distanceKm: w.totalDistance != null ? w.totalDistance.quantity * METERS_TO_KM : undefined,
      activeCalories: w.totalEnergyBurned != null ? w.totalEnergyBurned.quantity : undefined,
      elevationM: (w.metadata as any)?.HKElevationAscended?.quantity ?? undefined,
      avgSpeedMps: (w.metadata as any)?.HKAverageSpeed?.quantity ?? undefined,
      isIndoor: (w.metadata as any)?.HKIndoorWorkout === true,
      name: (w.metadata as any)?.HKWorkoutBrandName ?? undefined,
    }));

    console.log(`[HealthKit] raw workouts=${raw?.length ?? 0}`);
    const deduped = deduplicateWorkouts(workouts);
    console.log(`[HealthKit] after dedup=${deduped.length}`);
    deduped.forEach((w) =>
      console.log(`[HealthKit]   workout type=${w.activityType} date=${w.startDate.toISOString()} durationMin=${Math.round(w.durationSeconds/60)} distKm=${w.distanceKm?.toFixed(2) ?? 'n/a'} cal=${w.activeCalories ?? 'n/a'} elevM=${w.elevationM?.toFixed(1) ?? 'n/a'} avgSpeedMps=${w.avgSpeedMps?.toFixed(2) ?? 'n/a'} indoor=${w.isIndoor ?? false} name=${w.name ?? 'n/a'} id=${w.id}`)
    );
    return deduped;
  } catch (e) {
    console.warn('[HealthKit] Workout query failed:', e);
    return [];
  }
}

export async function queryTodayStats(): Promise<TodayStats> {
  if (!isHealthKitAvailable()) return { steps: 0, activeCalories: 0, distanceKm: 0 };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const now = new Date();
  const dateFilter = { filter: { date: { startDate: startOfDay, endDate: now } } };

  try {
    const hk = await getHK();

    const [stepsRes, caloriesRes, distanceRes] = await Promise.all([
      hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], dateFilter)
        .catch((e: any) => { console.warn('[HealthKit] getSteps failed:', e); return null; }),
      hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], dateFilter)
        .catch((e: any) => { console.warn('[HealthKit] getTotalCalories failed:', e); return null; }),
      hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierDistanceWalkingRunning', ['cumulativeSum'], { ...dateFilter, unit: 'm' } as any)
        .catch((e: any) => { console.warn('[HealthKit] getTotalDistance failed:', e); return null; }),
    ]);

    const result = {
      steps: Math.round(stepsRes?.sumQuantity?.quantity ?? 0),
      activeCalories: Math.round(caloriesRes?.sumQuantity?.quantity ?? 0),
      distanceKm: (distanceRes?.sumQuantity?.quantity ?? 0) * METERS_TO_KM,
    };
    console.log(`[HealthKit] todayStats steps=${result.steps} cal=${result.activeCalories} distKm=${result.distanceKm.toFixed(2)}`);
    return result;
  } catch (e) {
    console.warn('[HealthKit] Today stats query failed:', e);
    return { steps: 0, activeCalories: 0, distanceKm: 0 };
  }
}
