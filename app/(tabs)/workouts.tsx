import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useActiveHero, useActiveHeroDef } from '../../hooks/useHeroProgression';
import { useHealthSync } from '../../hooks/useHealthSync';
import { useUnits } from '../../hooks/useUnits';
import { useUserStore } from '../../stores/user-store';
import { supabase } from '../../services/supabase';
import { CLASS_COLORS } from '../../constants/ui';
import { ACTIVITY_TO_STAT } from '../../constants/stats';

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Run', cycle: 'Cycle', walk: 'Walk', hike: 'Hike',
  swim: 'Swim', yoga: 'Yoga', pilates: 'Pilates', manual: 'Manual',
  hiit: 'HIIT', functionalstrengthtraining: 'Functional Training',
  traditionalstrengthtraining: 'Strength Training', other: 'Workout',
  wordle: 'Wordle', connections: 'Connections', mini: 'Mini Crossword', strands: 'Strands',
  puzzle: 'Puzzle',
};

const ACTIVITY_ICONS: Record<string, string> = {
  run: '🏃', cycle: '🚴', walk: '🚶', hike: '⛰️', swim: '🏊',
  yoga: '🧘', pilates: '🧘', hiit: '🔥', functionalstrengthtraining: '🏋️',
  traditionalstrengthtraining: '🏋️', manual: '⚔️', other: '💪',
  wordle: '🧠', connections: '🧠', mini: '🧠', strands: '🧠', puzzle: '🧠',
};

const ACTIVITY_BG: Record<string, string> = {
  run: '#1E1040', cycle: '#0D2040', walk: '#0D2020', hike: '#1A2010',
  swim: '#0D1A30', yoga: '#201040', pilates: '#201040', hiit: '#2A0D0D',
  functionalstrengthtraining: '#2A0D0D', traditionalstrengthtraining: '#2A0D0D',
  manual: '#181828', other: '#181828',
  wordle: '#180D28', connections: '#180D28', mini: '#180D28', strands: '#180D28', puzzle: '#180D28',
};

const STAT_TAG: Record<string, { bg: string; color: string; label: string }> = {
  strength:     { bg: '#200D0D', color: '#F87171', label: 'Strength' },
  endurance:    { bg: '#0D2040', color: '#60A5FA', label: 'Endurance' },
  dexterity:    { bg: '#0D200D', color: '#4ADE80', label: 'Dexterity' },
  intelligence: { bg: '#180D28', color: '#C084FC', label: 'Intelligence' },
  luck:         { bg: '#201400', color: '#FBBF24', label: 'Luck' },
};

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type TimeFilter = '7days' | 'weekly' | 'monthly';

interface WorkoutRow {
  session_id: string;
  event_date: string;
  activity_type: string;
  source_platform: string;
  total_xp: number;
  distance_km: number | null;
  duration_min: number | null;
  elevation_ft: number | null;
  puzzle_accuracy: number | null;
}

interface WorkoutGroup {
  key: string;
  label: string;
  sublabel: string;
  items: WorkoutRow[];
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const offset = startDow === 0 ? 6 : startDow - 1;
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = new Array(offset).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function groupWorkouts(workouts: WorkoutRow[], filter: TimeFilter): WorkoutGroup[] {
  const groups = new Map<string, WorkoutGroup>();
  for (const w of workouts) {
    const d = new Date(w.event_date + 'T12:00:00');
    let key: string, label: string, sublabel: string;
    if (filter === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      sublabel = '';
    } else {
      const dow = d.getDay();
      const daysBack = dow === 0 ? 6 : dow - 1;
      const mon = new Date(d); mon.setDate(d.getDate() - daysBack);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      key = mon.toLocaleDateString('en-CA');
      const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      label = `${fmt(mon)} – ${fmt(sun)}`;
      sublabel = mon.getFullYear() !== new Date().getFullYear() ? String(mon.getFullYear()) : '';
    }
    if (!groups.has(key)) groups.set(key, { key, label, sublabel, items: [] });
    groups.get(key)!.items.push(w);
  }
  return Array.from(groups.values()).map(g => ({
    ...g,
    items: [...g.items].sort((a, b) => b.event_date.localeCompare(a.event_date)),
  }));
}

function puzzleAccuracyColor(activityType: string, accuracy: number | null): string {
  if (activityType === 'wordle') {
    if (accuracy === null || accuracy === 7) return '#F87171'; // missed = red
    // 1 guess=green (#4ADE80) → 6 guesses=orange (#F97316)
    const ratio = Math.min(1, (accuracy - 1) / 5);
    const r = Math.round(74  + (249 - 74)  * ratio);
    const g = Math.round(222 + (115 - 222) * ratio);
    const b = Math.round(128 + (22  - 128) * ratio);
    return `rgb(${r},${g},${b})`;
  }
  if (activityType === 'connections') {
    // 0 mistakes=green (#4ADE80) → 4 mistakes=red (#F87171)
    const ratio = Math.min(1, (accuracy ?? 0) / 4);
    const r = Math.round(74  + (248 - 74)  * ratio);
    const g = Math.round(222 + (113 - 222) * ratio);
    const b = Math.round(128 + (113 - 128) * ratio);
    return `rgb(${r},${g},${b})`;
  }
  return '#fff';
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string, todayStr: string): { label: string; sublabel: string } {
  const d = new Date(dateStr + 'T12:00:00');
  const yesterday = new Date(todayStr + 'T12:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');
  const dayFmt = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (dateStr === todayStr) return { label: 'Today', sublabel: dayFmt };
  if (dateStr === yesterdayStr) return { label: 'Yesterday', sublabel: dayFmt };
  return { label: dayFmt, sublabel: '' };
}

function WorkoutCard({ w, colors, isImperial, distanceUnit }: {
  w: WorkoutRow;
  colors: { accent: string; border: string; dimBg: string };
  isImperial: boolean;
  distanceUnit: string;
}) {
  const distDisplay = w.distance_km != null
    ? `${(isImperial ? w.distance_km : w.distance_km * 1.60934).toFixed(1)} ${distanceUnit}`
    : null;
  const stat = ACTIVITY_TO_STAT[w.activity_type];
  const tagCfg = stat ? STAT_TAG[stat] : null;
  const isPuzzle = w.source_platform === 'manual' && (w.activity_type === 'wordle' || w.activity_type === 'connections' || w.activity_type === 'mini' || w.activity_type === 'strands');
  const puzzleAccuracyLabel = isPuzzle
    ? w.activity_type === 'wordle' && w.puzzle_accuracy != null
      ? w.puzzle_accuracy === 7
        ? 'Missed'
        : `${w.puzzle_accuracy} ${w.puzzle_accuracy === 1 ? 'Guess' : 'Guesses'}`
      : w.activity_type === 'connections' && w.puzzle_accuracy != null
        ? w.puzzle_accuracy === 0 ? 'Perfect' : `${w.puzzle_accuracy} ${w.puzzle_accuracy === 1 ? 'Mistake' : 'Mistakes'}`
        : null
    : null;
  const puzzleColor = isPuzzle
    ? puzzleAccuracyColor(w.activity_type, w.puzzle_accuracy)
    : '#fff';
  const hasMetrics = distDisplay || w.duration_min != null || (w.elevation_ft != null && w.elevation_ft > 0) || puzzleAccuracyLabel != null;

  return (
    <View style={{ backgroundColor: '#12121E', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: ACTIVITY_BG[w.activity_type] ?? '#181828', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontSize: 24 }}>{ACTIVITY_ICONS[w.activity_type] ?? '💪'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
            {ACTIVITY_LABELS[w.activity_type] ?? w.activity_type}
          </Text>
          <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
            {new Date(w.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {w.source_platform === 'apple_health' ? '  ·  Apple Health' : '  ·  Manual'}
          </Text>
        </View>
        <View style={{ backgroundColor: colors.border, borderWidth: 1, borderColor: colors.accent + '60', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>+{w.total_xp} XP</Text>
        </View>
      </View>
      {hasMetrics && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E1E35' }}>
          {puzzleAccuracyLabel && (
            <View>
              <Text style={{ color: puzzleColor, fontSize: 17, fontWeight: '700' }}>{puzzleAccuracyLabel}</Text>
              <Text style={{ color: '#6B7280', fontSize: 11 }}>Score</Text>
            </View>
          )}
          {distDisplay && (
            <View>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{distDisplay}</Text>
              <Text style={{ color: '#6B7280', fontSize: 11 }}>Distance</Text>
            </View>
          )}
          {w.duration_min != null && (
            <View>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{formatDuration(w.duration_min)}</Text>
              <Text style={{ color: '#6B7280', fontSize: 11 }}>Duration</Text>
            </View>
          )}
          {w.elevation_ft != null && w.elevation_ft > 0 && (
            <View>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{Math.round(w.elevation_ft)} ft</Text>
              <Text style={{ color: '#6B7280', fontSize: 11 }}>Gain</Text>
            </View>
          )}
          {tagCfg && (
            <View style={{ marginLeft: 'auto', backgroundColor: tagCfg.bg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: tagCfg.color, fontSize: 11, fontWeight: '600' }}>{tagCfg.label}</Text>
            </View>
          )}
        </View>
      )}
      {!hasMetrics && tagCfg && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <View style={{ backgroundColor: tagCfg.bg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: tagCfg.color, fontSize: 11, fontWeight: '600' }}>{tagCfg.label}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function GroupItems({ items, colors, isImperial, distanceUnit, todayStr, withDateHeaders }: {
  items: WorkoutRow[];
  colors: { accent: string; border: string; dimBg: string };
  isImperial: boolean;
  distanceUnit: string;
  todayStr: string;
  withDateHeaders: boolean;
}) {
  if (!withDateHeaders) {
    return (
      <>
        {items.map(w => <WorkoutCard key={w.session_id} w={w} colors={colors} isImperial={isImperial} distanceUnit={distanceUnit} />)}
      </>
    );
  }
  const elements: JSX.Element[] = [];
  let lastDate = '';
  for (const w of items) {
    if (w.event_date !== lastDate) {
      lastDate = w.event_date;
      const { label, sublabel } = formatDateLabel(w.event_date, todayStr);
      elements.push(
        <View key={`date-${w.event_date}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: elements.length > 0 ? 12 : 0, marginBottom: 8 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</Text>
          {sublabel ? <Text style={{ color: '#4B5563', fontSize: 11 }}>{sublabel}</Text> : null}
        </View>
      );
    }
    elements.push(<WorkoutCard key={w.session_id} w={w} colors={colors} isImperial={isImperial} distanceUnit={distanceUnit} />);
  }
  return <>{elements}</>;
}

export default function WorkoutsScreen() {
  const { user } = useUserStore();
  const { data: activeHero, isLoading: heroLoading } = useActiveHero();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;
  const { isSyncing, forceSync } = useHealthSync();
  const { isImperial, distanceUnit } = useUnits();

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7days');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['__first__']));

  const todayStr = now.toLocaleDateString('en-CA');

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  }

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  function switchFilter(f: TimeFilter) {
    setTimeFilter(f);
    setSelectedDate(null);
    setOpenGroups(new Set(['__first__']));
  }

  const { data: rawEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['workout-history', user?.id, activeHero?.hero_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('xp_events')
        .select('session_id, event_date, activity_type, source_platform, source, raw_value, xp_earned, puzzle_accuracy, created_at')
        .eq('user_id', user!.id)
        .eq('hero_id', activeHero!.hero_id)
        .neq('activity_type', 'steps')
        .order('event_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      return data ?? [];
    },
    enabled: !!user && !!activeHero,
  });

  const { data: workoutSessionsMeta } = useQuery({
    queryKey: ['workout-sessions-meta', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_sessions')
        .select('session_id, elevation_ft, duration_minutes')
        .eq('user_id', user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { workoutsByDate, workoutList, weekSummary } = useMemo(() => {
    if (!rawEvents) return { workoutsByDate: new Map<string, number>(), workoutList: [] as WorkoutRow[], weekSummary: { count: 0, distanceKm: 0, durationMin: 0, xp: 0 } };

    const sessionMeta = new Map(
      (workoutSessionsMeta ?? []).map((s) => [s.session_id, {
        elevation_ft: s.elevation_ft ?? null,
        duration_min: s.duration_minutes ?? null,
      }])
    );

    const sessionMap = new Map<string, WorkoutRow>();
    const dateToSessions = new Map<string, Set<string>>();

    for (const e of rawEvents) {
      if (e.source === 'quest_reward') continue; // exclude from log and calendar

      const isPuzzle = e.source === 'puzzle';

      if (!sessionMap.has(e.session_id)) {
        const meta = sessionMeta.get(e.session_id);
        sessionMap.set(e.session_id, {
          session_id: e.session_id,
          event_date: e.event_date,
          activity_type: e.activity_type,
          source_platform: e.source_platform,
          total_xp: 0, distance_km: null,
          duration_min: meta?.duration_min ?? null,
          elevation_ft: meta?.elevation_ft ?? null,
          puzzle_accuracy: e.puzzle_accuracy ?? null,
        });
      }
      const row = sessionMap.get(e.session_id)!;
      row.total_xp += e.xp_earned;
      if (e.source === 'distanceRun' || e.source === 'distanceHike' || e.source === 'distanceCycle' || e.source === 'distanceSwim') row.distance_km = e.raw_value;
      // Manual workouts have no workout_sessions row — fall back to raw_value for duration
      if (e.source === 'workoutMinutes' && row.duration_min == null) row.duration_min = e.raw_value;

      // Only physical workouts highlight calendar days
      if (!isPuzzle) {
        if (!dateToSessions.has(e.event_date)) dateToSessions.set(e.event_date, new Set());
        dateToSessions.get(e.event_date)!.add(e.session_id);
      }
    }

    const workoutsByDate = new Map(
      Array.from(dateToSessions.entries()).map(([date, sessions]) => [date, sessions.size])
    );
    const workoutList = Array.from(sessionMap.values());

    const dow = now.getDay();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    const weekStartStr = weekStart.toLocaleDateString('en-CA');
    const weekSummary = { count: 0, distanceKm: 0, durationMin: 0, xp: 0 };
    for (const w of workoutList) {
      if (w.event_date >= weekStartStr && w.event_date <= todayStr) {
        weekSummary.count++;
        weekSummary.distanceKm += w.distance_km ?? 0;
        weekSummary.durationMin += w.duration_min ?? 0;
        weekSummary.xp += w.total_xp;
      }
    }

    return { workoutsByDate, workoutList, weekSummary };
  }, [rawEvents, workoutSessionsMeta]);

  const displayedGroups = useMemo((): WorkoutGroup[] => {
    if (selectedDate) {
      const items = workoutList.filter(w => w.event_date === selectedDate);
      const { label, sublabel } = formatDateLabel(selectedDate, todayStr);
      return [{ key: selectedDate, label, sublabel, items }];
    }
    if (timeFilter === '7days') {
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 6);
      cutoff.setHours(0, 0, 0, 0);
      const cutoffStr = cutoff.toLocaleDateString('en-CA');
      const filtered = workoutList.filter(w => w.event_date >= cutoffStr);
      const dateMap = new Map<string, WorkoutRow[]>();
      for (const w of filtered) {
        if (!dateMap.has(w.event_date)) dateMap.set(w.event_date, []);
        dateMap.get(w.event_date)!.push(w);
      }
      return Array.from(dateMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, items]) => {
          const { label, sublabel } = formatDateLabel(date, todayStr);
          return { key: date, label, sublabel, items };
        });
    }
    return groupWorkouts(workoutList, timeFilter);
  }, [workoutList, selectedDate, timeFilter]);

  // Resolve '__first__' sentinel to the actual first group key
  const resolvedOpen = useMemo(() => {
    if (!openGroups.has('__first__') || displayedGroups.length === 0) return openGroups;
    const next = new Set(openGroups);
    next.delete('__first__');
    next.add(displayedGroups[0].key);
    return next;
  }, [openGroups, displayedGroups]);

  const monthGrid = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const isLoading = heroLoading || eventsLoading;
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#09090F] items-center justify-center">
        <ActivityIndicator color="#F59E0B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={forceSync} tintColor="#F59E0B" />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>Workouts</Text>
        </View>

        {/* Calendar */}
        <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 20, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: '#6B7280', fontSize: 20, fontWeight: '600' }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '700' }}>{monthLabel}</Text>
            <TouchableOpacity
              onPress={nextMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={calYear === now.getFullYear() && calMonth === now.getMonth()}
            >
              <Text style={{ color: calYear === now.getFullYear() && calMonth === now.getMonth() ? '#2A2A45' : '#6B7280', fontSize: 20, fontWeight: '600' }}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DOW_LABELS.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: '#4B5563', fontSize: 11, fontWeight: '600' }}>{d}</Text>
              </View>
            ))}
          </View>

          {monthGrid.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row', marginBottom: 4 }}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={{ flex: 1 }} />;
                const dateStr = day.toLocaleDateString('en-CA');
                const isFuture = dateStr > todayStr;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const hasWorkout = (workoutsByDate.get(dateStr) ?? 0) > 0;

                // Color logic: selected=full accent, workout=tinted accent, today=border
                const bgColor = isSelected
                  ? colors.accent
                  : hasWorkout && !isFuture
                  ? colors.accent + '30'
                  : 'transparent';

                return (
                  <TouchableOpacity
                    key={di}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}
                    onPress={() => !isFuture && setSelectedDate(isSelected ? null : dateStr)}
                    disabled={isFuture}
                  >
                    <View style={{
                      width: 34, height: 34, borderRadius: 10,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: bgColor,
                      borderWidth: isToday && !isSelected ? 1 : 0,
                      borderColor: colors.accent,
                    }}>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: isToday || isSelected || hasWorkout ? '700' : '400',
                        color: isSelected
                          ? '#09090F'
                          : isFuture ? '#2A2A45'
                          : hasWorkout ? colors.accent
                          : isToday ? colors.accent
                          : '#6B7280',
                      }}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Week summary */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 20 }}>
          {[
            { val: String(weekSummary.count), lbl: 'This Week' },
            { val: weekSummary.distanceKm > 0 ? (isImperial ? weekSummary.distanceKm.toFixed(1) : (weekSummary.distanceKm * 1.60934).toFixed(1)) : '—', lbl: distanceUnit },
            { val: weekSummary.durationMin > 0 ? String(Math.round(weekSummary.durationMin)) : '—', lbl: 'Min' },
            { val: weekSummary.xp > 0 ? weekSummary.xp.toLocaleString() : '—', lbl: 'XP' },
          ].map(({ val, lbl }) => (
            <View key={lbl} style={{ flex: 1, backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{val}</Text>
              <Text style={{ color: '#555', fontSize: 9, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Activity list */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* Filter tabs + clear */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 10, padding: 3, gap: 2 }}>
              {(['7days', 'weekly', 'monthly'] as TimeFilter[]).map(f => (
                <TouchableOpacity
                  key={f}
                  onPress={() => switchFilter(f)}
                  style={{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 7, backgroundColor: timeFilter === f && !selectedDate ? colors.accent : 'transparent' }}
                >
                  <Text style={{ color: timeFilter === f && !selectedDate ? '#09090F' : '#6B7280', fontSize: 12, fontWeight: '600' }}>
                    {f === '7days' ? '7 Days' : f === 'weekly' ? 'Weekly' : 'Monthly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedDate && (
              <TouchableOpacity onPress={() => setSelectedDate(null)} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Groups */}
          {displayedGroups.map((group, gi) => {
            const isOpen = resolvedOpen.has(group.key);
            const groupXp = group.items.reduce((s, w) => s + w.total_xp, 0);
            const isSingleSection = timeFilter === '7days' || !!selectedDate;

            return (
              <View key={group.key} style={{ marginBottom: 8 }}>
                {/* Section header — always shown for weekly/monthly, hidden for flat 7-day view */}
                {!isSingleSection ? (
                  <TouchableOpacity
                    onPress={() => toggleGroup(group.key)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#D1D5DB', fontSize: 16, fontWeight: '700' }}>{group.label}</Text>
                      {group.sublabel ? <Text style={{ color: '#6B7280', fontSize: 12 }}>{group.sublabel}</Text> : null}
                    </View>
                    <Text style={{ color: '#6B7280', fontSize: 12, marginRight: 10 }}>
                      {group.items.length} workout{group.items.length !== 1 ? 's' : ''} · +{groupXp.toLocaleString()} XP
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 16 }}>{isOpen ? '∧' : '∨'}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: gi > 0 ? 20 : 0 }}>
                    <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                      {group.label}
                    </Text>
                    {group.sublabel ? <Text style={{ color: '#4B5563', fontSize: 12 }}>{group.sublabel}</Text> : null}
                    <View style={{ flex: 1, height: 1, backgroundColor: '#1A1A2E', marginLeft: 4 }} />
                  </View>
                )}

                {(isSingleSection || isOpen) && (
                  <GroupItems
                    items={group.items}
                    colors={colors}
                    isImperial={isImperial}
                    distanceUnit={distanceUnit}
                    todayStr={todayStr}
                    withDateHeaders={!isSingleSection}
                  />
                )}

                {!isSingleSection && gi < displayedGroups.length - 1 && (
                  <View style={{ height: 1, backgroundColor: '#1A1A2E', marginVertical: 4 }} />
                )}
              </View>
            );
          })}

          {displayedGroups.every(g => g.items.length === 0) && (
            <Text style={{ color: '#6B7280', fontSize: 14 }}>No workouts found.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
