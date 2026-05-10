import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';
import { DAILY_QUESTS, WEEKLY_QUESTS, BOSS_BATTLES, QuestDef, QuestMetric } from '../constants/quests';
import { useUnits } from './useUnits';

const DISTANCE_METRICS = new Set<QuestMetric>(['runningDistance', 'cyclingDistance']);
const ELEVATION_METRICS = new Set<QuestMetric>(['elevationFt']);

export interface QuestWithProgress extends QuestDef {
  description: string;
  progress: number;
  isCompleted: boolean;
}

type EventRow = {
  source: string;
  raw_value: number;
  event_date: string;
  activity_type: string;
};

// Returns 'YYYY-MM-DD' in the device's local timezone
function getLocalToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

// Returns the Monday of the current week in local time
function getLocalWeekStart(): string {
  const today = new Date();
  const d = today.getDay(); // 0 = Sunday
  const monday = new Date(today);
  monday.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
  return monday.toLocaleDateString('en-CA');
}

// Maps quest metrics to xp_events columns
const SOURCE_MAP: Partial<Record<QuestMetric, { source: string; activityType?: string }>> = {
  steps:           { source: 'steps' },
  activeMinutes:   { source: 'activeMinutes' },
  workouts:        { source: 'workout' },
  caloriesBurned:  { source: 'calories' },
  runningDistance: { source: 'distance', activityType: 'run' },
  cyclingDistance: { source: 'distance', activityType: 'cycle' },
  elevationFt:     { source: 'elevation' },
};

function getQuestProgress(
  quest: QuestDef,
  events: EventRow[],
  streakDays: number,
  today: string,
  weekStart: string,
): number {
  if (quest.metric === 'streakDays') return streakDays;

  const periodStart = quest.type === 'daily' ? today : weekStart;
  const relevantEvents = events.filter((e) => e.event_date >= periodStart);

  const info = SOURCE_MAP[quest.metric];
  if (!info) return 0;

  return relevantEvents
    .filter((e) => e.source === info.source && (!info.activityType || e.activity_type === info.activityType))
    .reduce((sum, e) => sum + (e.raw_value ?? 0), 0);
}

function resolveDescription(
  quest: QuestDef,
  formatDistance: (km: number) => string,
  formatElevation: (m: number) => string,
): string {
  if (!quest.descriptionTemplate.includes('{target}')) return quest.descriptionTemplate;
  if (DISTANCE_METRICS.has(quest.metric)) return quest.descriptionTemplate.replace('{target}', formatDistance(quest.target));
  if (ELEVATION_METRICS.has(quest.metric)) return quest.descriptionTemplate.replace('{target}', formatElevation(quest.target));
  return quest.descriptionTemplate.replace('{target}', quest.target.toLocaleString());
}

// Fetches this week's xp_events — enough to compute both daily and weekly progress
function useWeekEvents(): EventRow[] {
  const { user } = useUserStore();
  const weekStart = getLocalWeekStart();

  const { data = [] } = useQuery({
    queryKey: ['xp-events-progress', user?.id, weekStart],
    queryFn: async (): Promise<EventRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('xp_events')
        .select('source, raw_value, event_date, activity_type')
        .eq('user_id', user.id)
        .gte('event_date', weekStart);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    enabled: !!user,
  });

  return data;
}

function buildQuestList(
  defs: QuestDef[],
  heroId: string | undefined,
  events: EventRow[],
  streakDays: number,
  today: string,
  weekStart: string,
  formatDistance: (km: number) => string,
  formatElevation: (m: number) => string,
): QuestWithProgress[] {
  return defs
    .filter((q) => q.heroId === undefined || q.heroId === heroId)
    .map((q) => {
      const progress = getQuestProgress(q, events, streakDays, today, weekStart);
      return {
        ...q,
        description: resolveDescription(q, formatDistance, formatElevation),
        progress,
        isCompleted: progress >= q.target,
      };
    });
}

export function useDailyQuests(heroId?: string, streakDays = 0): QuestWithProgress[] {
  const events = useWeekEvents();
  const { formatDistance, formatElevation } = useUnits();
  const today = getLocalToday();
  const weekStart = getLocalWeekStart();
  return buildQuestList(DAILY_QUESTS, heroId, events, streakDays, today, weekStart, formatDistance, formatElevation);
}

export function useWeeklyQuests(heroId?: string, streakDays = 0): QuestWithProgress[] {
  const events = useWeekEvents();
  const { formatDistance, formatElevation } = useUnits();
  const today = getLocalToday();
  const weekStart = getLocalWeekStart();
  return buildQuestList(WEEKLY_QUESTS, heroId, events, streakDays, today, weekStart, formatDistance, formatElevation);
}

export function useBossQuests(heroId?: string, streakDays = 0): QuestWithProgress[] {
  const { formatDistance, formatElevation } = useUnits();
  // Boss quests require all-time cumulative data — tracked separately in a future iteration.
  // Streak-based boss quests are the exception since streak_days is always available.
  return BOSS_BATTLES
    .filter((q) => q.heroId === undefined || q.heroId === heroId)
    .map((q) => {
      const progress = q.metric === 'streakDays' ? streakDays : 0;
      return {
        ...q,
        description: resolveDescription(q, formatDistance, formatElevation),
        progress,
        isCompleted: progress >= q.target,
      };
    });
}

export function useRefreshQuestProgress() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const weekStart = getLocalWeekStart();
  return () => queryClient.invalidateQueries({ queryKey: ['xp-events-progress', user?.id, weekStart] });
}
