import { Platform } from 'react-native';

export function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios';
}

export interface HealthWorkout {
  id: string;
  activityType: string;   // 'running', 'cycling', 'hiking', 'walking', etc.
  startDate: Date;
  endDate: Date;
  durationSeconds: number;
  distanceKm?: number;
  activeCalories?: number;
  name?: string;
}

export interface TodayStats {
  steps: number;
  activeCalories: number;
  distanceKm: number;
}

// DataType strings accepted by @kayzmann/expo-healthkit requestAuthorization
const READ_TYPES = ['steps', 'distance', 'activeEnergy', 'workouts', 'heartRate'];

// Apple Health stores distance internally in meters
const METERS_TO_KM = 0.001;

let _hk: any = null;

async function getHK(): Promise<any> {
  if (!_hk) {
    const mod = await import('@kayzmann/expo-healthkit');
    _hk = mod.default ?? mod;
  }
  return _hk;
}

export async function requestHealthKitPermissions(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  try {
    const hk = await getHK();
    await hk.requestAuthorization(READ_TYPES, []);
    return true;
  } catch (e) {
    console.warn('[HealthKit] Permission request failed:', e);
    return false;
  }
}

export async function queryWorkoutsSince(sinceDate: Date): Promise<HealthWorkout[]> {
  if (!isHealthKitAvailable()) return [];
  try {
    const hk = await getHK();
    const raw: any[] = await hk.queryWorkouts({ startDate: sinceDate, endDate: new Date() });
    return (raw ?? []).map((w) => ({
      id: String(w.id ?? w.uuid ?? `${w.startDate}-${w.activityType}`),
      activityType: String(w.activityType ?? 'other').toLowerCase(),
      startDate: new Date(w.startDate),
      endDate: new Date(w.endDate),
      durationSeconds: Number(w.duration ?? 0),
      // Package may return meters or already converted — adjust METERS_TO_KM if values look wrong
      distanceKm: w.distance != null ? Number(w.distance) * METERS_TO_KM : undefined,
      activeCalories: w.calories != null ? Number(w.calories) : undefined,
      name: w.metadata?.HKExternalUUID ?? w.metadata?.workoutName ?? undefined,
    }));
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

  try {
    const hk = await getHK();

    const [distanceRaw, caloriesRaw, stepSamples] = await Promise.all([
      hk.getTotalDistance(startOfDay, now).catch(() => 0),
      hk.getTotalCalories(startOfDay, now).catch(() => 0),
      hk.getSteps({ startDate: startOfDay, endDate: now }).catch(() => []),
    ]);

    const steps = (stepSamples as any[] ?? []).reduce(
      (sum: number, s: any) => sum + Number(s.quantity ?? s.value ?? 0),
      0,
    );

    return {
      steps: Math.round(steps),
      activeCalories: Math.round(Number(caloriesRaw ?? 0)),
      distanceKm: Number(distanceRaw ?? 0) * METERS_TO_KM,
    };
  } catch (e) {
    console.warn('[HealthKit] Today stats query failed:', e);
    return { steps: 0, activeCalories: 0, distanceKm: 0 };
  }
}
