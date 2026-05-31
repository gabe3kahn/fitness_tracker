import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, BOSS_BATTLES, QuestDef, QuestMetric } from '../constants/quests';
import { useUnits } from './useUnits';

const DISTANCE_METRICS = new Set<QuestMetric>(['runningDistance', 'hikingDistance', 'cyclingDistance', 'swimmingDistance']);
const ELEVATION_METRICS = new Set<QuestMetric>(['elevationFt']);

// Quest targets and raw_values are in miles/feet; useUnits formatters expect km/meters.
const KM_PER_MI = 1.60934;
const M_PER_FT = 0.3048;

export interface QuestWithProgress extends QuestDef {
  description: string;
  progress: number;
  isCompleted: boolean;
  progressLabel: string;
}

type EventRow = {
  source: string;
  raw_value: number;
  event_date: string;
  activity_type: string;
  session_id: string;
  puzzle_accuracy: number | null;
};

// Returns 'YYYY-MM-DD' in the device's local timezone
function getLocalToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

// Returns the Monday of the current week in local time
function getLocalWeekStart(): string {
  const today = new Date();
  const d = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
  return monday.toLocaleDateString('en-CA');
}

// Returns the first day of the current month in local time
function getLocalMonthStart(): string {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA');
}

// Maps quest metrics to xp_events source column values
const SOURCE_MAP: Partial<Record<QuestMetric, string>> = {
  steps:            'steps',
  workoutMinutes:   'workoutMinutes',
  runningDistance:  'distanceRun',
  hikingDistance:   'distanceHike',
  cyclingDistance:  'distanceCycle',
  swimmingDistance: 'distanceSwim',
  elevationFt:      'elevation',
};

function getQuestProgress(quest: QuestDef, events: EventRow[], streakDays: number, periodStart: string): number {
  if (quest.metric === 'streakDays') return streakDays;

  const periodEvents = events.filter((e) => e.event_date >= periodStart);

  // Count distinct workout sessions (any source that isn't steps/puzzle/streak)
  if (quest.metric === 'workouts') {
    const workoutSessions = new Set(
      periodEvents
        .filter((e) => e.source === 'workoutMinutes' || e.source === 'distanceRun' || e.source === 'distanceHike' || e.source === 'distanceCycle' || e.source === 'distanceSwim' || e.source === 'elevation')
        .map((e) => e.session_id)
    );
    return workoutSessions.size;
  }

  // Count distinct puzzle sessions
  if (quest.metric === 'puzzleCount') {
    return new Set(periodEvents.filter((e) => e.source === 'puzzle').map((e) => e.session_id)).size;
  }

  // Count Wordle sessions solved in ≤3 guesses
  if (quest.metric === 'wordleLow') {
    return new Set(
      periodEvents
        .filter((e) => e.activity_type === 'wordle' && e.puzzle_accuracy != null && e.puzzle_accuracy <= 3)
        .map((e) => e.session_id)
    ).size;
  }

  // Count Connections sessions solved with 0 mistakes
  if (quest.metric === 'connectionsPerfect') {
    return new Set(
      periodEvents
        .filter((e) => e.activity_type === 'connections' && e.puzzle_accuracy === 0)
        .map((e) => e.session_id)
    ).size;
  }

  // Count distinct non-puzzle activity types
  if (quest.metric === 'activityVariety') {
    return new Set(
      periodEvents
        .filter((e) => e.source !== 'steps' && e.source !== 'puzzle' && e.activity_type && e.activity_type !== 'manual')
        .map((e) => e.activity_type)
    ).size;
  }

  // Sum raw_value for simple cumulative metrics
  const source = SOURCE_MAP[quest.metric];
  if (!source) return 0;

  return periodEvents
    .filter((e) => e.source === source)
    .reduce((sum, e) => sum + (e.raw_value ?? 0), 0);
}

function formatProgressLabel(
  quest: QuestDef,
  progress: number,
  formatDistance: (mi: number) => string,
  formatElevation: (m: number) => string,
): string {
  if (DISTANCE_METRICS.has(quest.metric)) {
    return `${formatDistance(progress)} / ${formatDistance(quest.target)}`;
  }
  if (ELEVATION_METRICS.has(quest.metric)) {
    return `${formatElevation(progress)} / ${formatElevation(quest.target)}`;
  }
  return `${Math.round(progress).toLocaleString()} / ${quest.target.toLocaleString()}`;
}

function resolveDescription(
  quest: QuestDef,
  formatDistance: (mi: number) => string,
  formatElevation: (m: number) => string,
): string {
  if (!quest.descriptionTemplate.includes('{target}')) return quest.descriptionTemplate;
  if (DISTANCE_METRICS.has(quest.metric)) return quest.descriptionTemplate.replace('{target}', formatDistance(quest.target));
  if (ELEVATION_METRICS.has(quest.metric)) return quest.descriptionTemplate.replace('{target}', formatElevation(quest.target));
  return quest.descriptionTemplate.replace('{target}', quest.target.toLocaleString());
}

// Fetches events from monthStart onward — covers daily, weekly, and monthly windows
function usePeriodEvents(heroId?: string): EventRow[] {
  const { user } = useUserStore();
  const monthStart = getLocalMonthStart();

  const { data = [] } = useQuery({
    queryKey: ['xp-events-progress', user?.id, heroId, monthStart],
    queryFn: async (): Promise<EventRow[]> => {
      if (!user || !heroId) return [];
      const { data, error } = await supabase
        .from('xp_events')
        .select('source, raw_value, event_date, activity_type, session_id, puzzle_accuracy')
        .eq('user_id', user.id)
        .eq('hero_id', heroId)
        .gte('event_date', monthStart);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    enabled: !!user && !!heroId,
  });

  return data;
}

function buildQuestList(
  defs: QuestDef[],
  heroId: string | undefined,
  events: EventRow[],
  streakDays: number,
  periodStart: string,
  formatDistance: (mi: number) => string,
  formatElevation: (m: number) => string,
): QuestWithProgress[] {
  return defs
    .filter((q) => q.heroId === undefined || q.heroId === heroId)
    .map((q) => {
      const progress = getQuestProgress(q, events, streakDays, periodStart);
      return {
        ...q,
        description: resolveDescription(q, formatDistance, formatElevation),
        progress,
        isCompleted: progress >= q.target,
        progressLabel: formatProgressLabel(q, progress, formatDistance, formatElevation),
      };
    });
}

function useQuestFormatters() {
  const { formatDistance, formatElevation } = useUnits();
  return {
    formatDistanceMi: (mi: number) => formatDistance(mi * KM_PER_MI),
    formatElevationFt: (ft: number) => formatElevation(ft * M_PER_FT),
  };
}

export function useDailyQuests(heroId?: string, streakDays = 0, assignedIds?: string[]): QuestWithProgress[] {
  const events = usePeriodEvents(heroId);
  const { formatDistanceMi, formatElevationFt } = useQuestFormatters();
  const defs = assignedIds ? DAILY_QUESTS.filter(q => assignedIds.includes(q.id)) : DAILY_QUESTS;
  return buildQuestList(defs, heroId, events, streakDays, getLocalToday(), formatDistanceMi, formatElevationFt);
}

export function useWeeklyQuests(heroId?: string, streakDays = 0, assignedIds?: string[]): QuestWithProgress[] {
  const events = usePeriodEvents(heroId);
  const { formatDistanceMi, formatElevationFt } = useQuestFormatters();
  const defs = assignedIds ? WEEKLY_QUESTS.filter(q => assignedIds.includes(q.id)) : WEEKLY_QUESTS;
  return buildQuestList(defs, heroId, events, streakDays, getLocalWeekStart(), formatDistanceMi, formatElevationFt);
}

export function useMonthlyQuests(heroId?: string, streakDays = 0, assignedIds?: string[]): QuestWithProgress[] {
  const events = usePeriodEvents(heroId);
  const { formatDistanceMi, formatElevationFt } = useQuestFormatters();
  const defs = assignedIds ? MONTHLY_QUESTS.filter(q => assignedIds.includes(q.id)) : MONTHLY_QUESTS;
  return buildQuestList(defs, heroId, events, streakDays, getLocalMonthStart(), formatDistanceMi, formatElevationFt);
}

export function useBossQuests(heroId?: string, streakDays = 0): QuestWithProgress[] {
  const { formatDistanceMi, formatElevationFt } = useQuestFormatters();
  // Boss quests require all-time cumulative data — non-streak metrics pending implementation.
  return BOSS_BATTLES
    .filter((q) => q.heroId === undefined || q.heroId === heroId)
    .map((q) => {
      const progress = q.metric === 'streakDays' ? streakDays : 0;
      return {
        ...q,
        description: resolveDescription(q, formatDistanceMi, formatElevationFt),
        progress,
        isCompleted: progress >= q.target,
        progressLabel: formatProgressLabel(q, progress, formatDistanceMi, formatElevationFt),
      };
    });
}

export function useRefreshQuestProgress() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  return () => queryClient.invalidateQueries({ queryKey: ['xp-events-progress', user?.id] });
}
