import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useActiveHero, useActiveHeroDef, useRefreshHero } from '../../hooks/useHeroProgression';
import { useDailyQuests, useWeeklyQuests, useRefreshQuestProgress, QuestWithProgress } from '../../hooks/useQuests';
import { XpBar } from '../../components/hero/XpBar';
import { awardXp, calculateXp, HealthInput } from '../../services/xp-engine';
import { useUserStore } from '../../stores/user-store';
import { CLASS_COLORS, TIER_LABELS } from '../../constants/ui';
import { useUnits } from '../../hooks/useUnits';
import { useHealthSync } from '../../hooks/useHealthSync';

function QuestCard({
  title, description, progress, target, xpReward, isCompleted, accentColor,
}: QuestWithProgress & { accentColor: string }) {
  const pct = Math.min(progress / target, 1);
  return (
    <View className="bg-[#12121E] border border-[#1E1E35] rounded-xl p-4 mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className={`font-bold text-base ${isCompleted ? 'text-gray-400' : 'text-white'}`}>
            {title}
          </Text>
          <Text className="text-gray-400 text-sm mt-0.5">{description}</Text>
        </View>
        <View style={{ borderColor: accentColor }} className="border rounded-lg px-2 py-1 items-center">
          <Text style={{ color: accentColor }} className="text-xs font-bold">+{xpReward}</Text>
          <Text style={{ color: accentColor }} className="text-xs">XP</Text>
        </View>
      </View>
      <View className="h-1.5 bg-[#1E1E35] rounded-full overflow-hidden">
        <View
          style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: isCompleted ? '#4B5563' : accentColor }}
          className="h-full rounded-full"
        />
      </View>
      <Text className="text-gray-400 text-xs mt-1">
        {isCompleted ? 'Complete!' : `${progress.toLocaleString()} / ${target.toLocaleString()}`}
      </Text>
    </View>
  );
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1 bg-[#12121E] border border-[#1E1E35] rounded-xl p-3 items-center">
      <Text className="text-white text-xl font-bold">{value}</Text>
      <Text className="text-gray-400 text-xs mt-0.5">{unit}</Text>
      <Text className="text-gray-400 text-xs uppercase tracking-wider mt-1">{label}</Text>
    </View>
  );
}

function LogRunModal({
  visible, onClose, heroId, primaryStat, secondaryStat,
  currentTotalXp, currentLevel, streakDays, longestStreak,
  lastActiveDate, userId, onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  heroId: string;
  primaryStat: any;
  secondaryStat: any;
  currentTotalXp: number;
  currentLevel: number;
  streakDays: number;
  longestStreak: number;
  lastActiveDate: string | null;
  userId: string;
  onSuccess: (result: any) => void;
}) {
  const { isImperial, distanceUnit, elevationUnit } = useUnits();
  const [distanceStr, setDistanceStr] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [elevationStr, setElevationStr] = useState('');
  const [loading, setLoading] = useState(false);

  const builtInput = useMemo((): HealthInput => {
    const distUser = parseFloat(distanceStr) || 0;
    const distKm = isImperial ? distUser * 1.60934 : distUser;
    const elevUser = parseFloat(elevationStr) || 0;
    // HealthInput always expects elevation in feet
    const elevFt = isImperial ? elevUser : Math.round(elevUser * 3.28084);
    const hasActivity = distUser > 0 || (parseInt(durationStr) || 0) > 0;
    return {
      distanceKm: distKm || undefined,
      activeMinutes: parseInt(durationStr) || undefined,
      elevationFt: elevFt || undefined,
      workoutCount: hasActivity ? 1 : undefined,
    };
  }, [distanceStr, durationStr, elevationStr, isImperial]);

  const previewXp = useMemo(() => {
    const { totalXp } = calculateXp(builtInput, primaryStat, secondaryStat, streakDays);
    return totalXp;
  }, [builtInput, primaryStat, secondaryStat, streakDays]);

  function handleClose() {
    setDistanceStr('');
    setDurationStr('');
    setElevationStr('');
    onClose();
  }

  async function handleSubmit() {
    if (!distanceStr && !durationStr) {
      Alert.alert('Missing data', 'Enter at least distance or duration.');
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLoading(true);
    const result = await awardXp(
      userId, heroId, primaryStat, secondaryStat,
      currentTotalXp, currentLevel, streakDays, longestStreak, lastActiveDate,
      builtInput, timezone, 'run', 'manual',
    );
    setLoading(false);
    setDistanceStr('');
    setDurationStr('');
    setElevationStr('');
    onSuccess(result);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-[#12121E] rounded-t-2xl p-6 border-t border-[#1E1E35]">
          <View className="flex-row justify-between items-center mb-5">
            <View>
              <Text className="text-white text-lg font-bold">Log Run</Text>
              <Text className="text-gray-400 text-xs mt-0.5">Saved in your local time</Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Distance */}
          <View className="flex-row items-center mb-3">
            <View className="w-32">
              <Text className="text-white text-sm font-medium">Distance</Text>
            </View>
            <TextInput
              className="flex-1 bg-[#1A1A2E] text-white border border-[#1E1E35] rounded-lg px-3 py-2.5 text-sm mr-2"
              value={distanceStr}
              onChangeText={setDistanceStr}
              placeholder="0.0"
              placeholderTextColor="#374151"
              keyboardType="decimal-pad"
            />
            <Text className="text-gray-400 text-sm w-8">{distanceUnit}</Text>
          </View>

          {/* Duration */}
          <View className="flex-row items-center mb-3">
            <View className="w-32">
              <Text className="text-white text-sm font-medium">Duration</Text>
            </View>
            <TextInput
              className="flex-1 bg-[#1A1A2E] text-white border border-[#1E1E35] rounded-lg px-3 py-2.5 text-sm mr-2"
              value={durationStr}
              onChangeText={setDurationStr}
              placeholder="0"
              placeholderTextColor="#374151"
              keyboardType="numeric"
            />
            <Text className="text-gray-400 text-sm w-8">min</Text>
          </View>

          {/* Elevation (optional) */}
          <View className="flex-row items-center mb-4">
            <View className="w-32">
              <Text className="text-white text-sm font-medium">Elevation</Text>
              <Text className="text-gray-500 text-xs">optional</Text>
            </View>
            <TextInput
              className="flex-1 bg-[#1A1A2E] text-white border border-[#1E1E35] rounded-lg px-3 py-2.5 text-sm mr-2"
              value={elevationStr}
              onChangeText={setElevationStr}
              placeholder="0"
              placeholderTextColor="#374151"
              keyboardType="numeric"
            />
            <Text className="text-gray-400 text-sm w-8">{elevationUnit}</Text>
          </View>

          {/* XP preview */}
          {previewXp > 0 && (
            <View className="items-center mb-3">
              <Text className="text-amber-400 font-semibold">
                Preview: +{previewXp.toLocaleString()} XP
              </Text>
            </View>
          )}

          <TouchableOpacity
            className="bg-amber-500 rounded-xl py-4 items-center"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#09090F" />
              : <Text className="text-[#09090F] font-bold tracking-widest">LOG RUN</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { data: activeHero, isLoading } = useActiveHero();
  const refreshHero = useRefreshHero();
  const refreshQuests = useRefreshQuestProgress();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const dailyQuests = useDailyQuests(activeHero?.hero_id, activeHero?.streak_days ?? 0);
  const weeklyQuests = useWeeklyQuests(activeHero?.hero_id, activeHero?.streak_days ?? 0);
  const [logRunVisible, setLogRunVisible] = useState(false);
  const [lastResult, setLastResult] = useState<{ xpEarned: number; leveledUp: boolean } | null>(null);
  const { todayStats, isSyncing } = useHealthSync();

  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;
  const { distanceUnit, isImperial } = useUnits();

  const todayDistanceDisplay = todayStats.distanceKm > 0
    ? (isImperial ? (todayStats.distanceKm * 0.621371).toFixed(1) : todayStats.distanceKm.toFixed(1))
    : '—';

  function handleXpResult(result: any) {
    setLastResult({ xpEarned: result.totalXp, leveledUp: result.leveledUp });
    refreshHero();
    refreshQuests();
    if (result.leveledUp) {
      Alert.alert('⚔ Level Up!', `${heroDef?.name} reached Level ${result.newLevel}!`);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#09090F] items-center justify-center">
        <ActivityIndicator color="#F59E0B" />
      </SafeAreaView>
    );
  }

  if (!activeHero || !heroDef) {
    return (
      <SafeAreaView className="flex-1 bg-[#09090F] items-center justify-center px-8">
        <Text className="text-amber-400 text-5xl font-bold text-center tracking-widest mb-2">
          HEROFIT
        </Text>
        <Text className="text-gray-400 text-center mb-8">
          Choose your hero to begin your legend.
        </Text>
        <TouchableOpacity
          className="bg-amber-500 rounded-xl px-8 py-4"
          onPress={() => router.replace('/hero-select')}
        >
          <Text className="text-[#09090F] font-bold tracking-widest">CHOOSE HERO</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row justify-between items-center">
          <View>
            <Text className="text-gray-400 text-xs uppercase tracking-widest">{today}</Text>
            <Text className="text-white text-2xl font-bold mt-0.5">Dashboard</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: colors.dimBg, borderColor: colors.border }}
            className="border rounded-xl px-4 py-2"
            onPress={() => setLogRunVisible(true)}
          >
            <Text style={{ color: colors.accent }} className="text-sm font-bold">+ Log Run</Text>
          </TouchableOpacity>
        </View>

        {/* XP result flash */}
        {lastResult && (
          <View className="mx-5 mb-3 bg-[#12121E] border border-amber-500/30 rounded-xl px-4 py-3 flex-row items-center justify-between">
            <Text className="text-amber-400 font-semibold">
              +{lastResult.xpEarned.toLocaleString()} XP earned
              {lastResult.leveledUp ? '  ·  Level Up! 🎉' : ''}
            </Text>
            <TouchableOpacity onPress={() => setLastResult(null)}>
              <Text className="text-gray-400">✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero card */}
        <View
          style={{ borderColor: colors.border }}
          className="mx-5 mb-4 bg-[#12121E] border-2 rounded-2xl overflow-hidden"
        >
          <View style={{ backgroundColor: colors.dimBg }} className="px-5 pt-5 pb-4">
            <View className="flex-row justify-between items-start">
              <View>
                <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-1">
                  Active Hero
                </Text>
                <Text className="text-white text-3xl font-bold">{heroDef.name}</Text>
                <Text className="text-gray-400 text-sm">{heroDef.origin}</Text>
              </View>
              <View className="items-center">
                <View style={{ borderColor: colors.border }} className="border rounded-full px-3 py-1 mb-1">
                  <Text style={{ color: colors.accent }} className="text-xs font-bold uppercase tracking-wider">
                    {TIER_LABELS[activeHero.tier as keyof typeof TIER_LABELS] ?? activeHero.tier}
                  </Text>
                </View>
                <Text className="text-gray-400 text-xs">Level {activeHero.level}</Text>
              </View>
            </View>
          </View>
          <View className="px-5 py-4">
            <XpBar totalXp={activeHero.total_xp} level={activeHero.level} accentColor={colors.accent} />
            <View className="flex-row items-center mt-4">
              <Text className="text-orange-400 text-base mr-1">🔥</Text>
              <Text className="text-white font-bold">{activeHero.streak_days}</Text>
              <Text className="text-gray-400 text-sm ml-1">
                day streak · best {activeHero.longest_streak}
              </Text>
            </View>
          </View>
        </View>

        {/* Today's stats */}
        <View className="px-5 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-400 text-xs uppercase tracking-widest">Today's Activity</Text>
            {isSyncing && <Text className="text-gray-500 text-xs">Syncing…</Text>}
          </View>
          <View className="flex-row gap-2">
            <StatTile
              label="Steps"
              value={todayStats.steps > 0 ? todayStats.steps.toLocaleString() : '—'}
              unit="steps"
            />
            <StatTile
              label="Calories"
              value={todayStats.activeCalories > 0 ? todayStats.activeCalories.toLocaleString() : '—'}
              unit="kcal"
            />
            <StatTile
              label="Distance"
              value={todayDistanceDisplay}
              unit={distanceUnit}
            />
          </View>
        </View>

        {/* Daily quests */}
        <View className="px-5 mb-4">
          <Text className="text-gray-400 text-xs uppercase tracking-widest mb-3">Daily Quests</Text>
          {dailyQuests.map((q) => (
            <QuestCard key={q.id} {...q} accentColor={colors.accent} />
          ))}
        </View>

        {/* Weekly quests */}
        <View className="px-5">
          <Text className="text-gray-400 text-xs uppercase tracking-widest mb-3">Weekly Quests</Text>
          {weeklyQuests.map((q) => (
            <QuestCard key={q.id} {...q} accentColor={colors.accent} />
          ))}
        </View>

      </ScrollView>

      {activeHero && heroDef && user && (
        <LogRunModal
          visible={logRunVisible}
          onClose={() => setLogRunVisible(false)}
          heroId={activeHero.hero_id}
          primaryStat={heroDef.primaryStat}
          secondaryStat={heroDef.secondaryStat}
          currentTotalXp={activeHero.total_xp}
          currentLevel={activeHero.level}
          streakDays={activeHero.streak_days}
          longestStreak={activeHero.longest_streak}
          lastActiveDate={activeHero.last_active_date}
          userId={user.id}
          onSuccess={handleXpResult}
        />
      )}
    </SafeAreaView>
  );
}
