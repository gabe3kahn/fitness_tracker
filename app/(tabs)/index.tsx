import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useActiveHero, useActiveHeroDef, useRefreshHero } from '../../hooks/useHeroProgression';
import { useDailyQuests, useWeeklyQuests, useMonthlyQuests, useBossQuests, useRefreshQuestProgress, QuestWithProgress } from '../../hooks/useQuests';
import { useQuestAssignments } from '../../hooks/useQuestAssignments';
import { useQuestRewards } from '../../hooks/useQuestRewards';
import { useLevelUpDetector } from '../../hooks/useLevelUpDetector';
import { XpBar } from '../../components/hero/XpBar';
import { awardXp, calculateXp, HealthInput } from '../../services/xp-engine';
import { useUserStore } from '../../stores/user-store';
import { CLASS_COLORS, TIER_LABELS, CLASS_SYMBOLS } from '../../constants/ui';
import { xpProgressInLevel, effectiveStreak } from '../../constants/xp-config';
import { useUnits } from '../../hooks/useUnits';
import { useHealthSync } from '../../hooks/useHealthSync';
import { isHealthKitAvailable } from '../../services/health/healthkit';
import { useLuckCheck } from '../../hooks/useLuckCheck';
import { LevelUpModal } from '../../components/hero/LevelUpModal';
import { LogPuzzleModal } from '../../components/LogPuzzleModal';
import { usePlayerStats } from '../../hooks/usePlayerStats';
import { PLAYER_STATS } from '../../constants/stats';

function QuestCard({ quest, accentColor }: { quest: QuestWithProgress; accentColor: string }) {
  const pct = Math.min(quest.progress / quest.target, 1);
  return (
    <View className="bg-[#12121E] border border-[#1E1E35] rounded-2xl p-4">
      <View className="flex-row justify-between items-start mb-2">
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text className="font-bold text-base text-white">{quest.title}</Text>
          <Text className="text-gray-400 text-sm mt-0.5">{quest.description}</Text>
        </View>
        <View style={{ backgroundColor: quest.isCompleted ? accentColor : 'transparent', borderColor: accentColor }} className="border rounded-lg px-2 py-1 items-center min-w-[44px]">
          <Text style={{ color: quest.isCompleted ? '#09090F' : accentColor }} className="text-xs font-bold">+{quest.xpReward}</Text>
          <Text style={{ color: quest.isCompleted ? '#09090F' : accentColor }} className="text-xs">XP</Text>
        </View>
      </View>
      <View style={{ height: 5, backgroundColor: '#252540', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 100, backgroundColor: accentColor }} />
      </View>
      <Text className="text-xs font-medium" style={{ color: quest.isCompleted ? accentColor : '#6B7280' }}>
        {quest.isCompleted ? '✓ Complete' : quest.progressLabel}
      </Text>
    </View>
  );
}

function formatSleepDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatTile({ icon, value, unit }: { icon: string; value: string; unit: string }) {
  return (
    <View className="flex-1 bg-[#12121E] border border-[#1E1E35] rounded-2xl py-4 px-2 items-center">
      <Text style={{ fontSize: 20 }} className="mb-2">{icon}</Text>
      <Text className="text-white text-2xl font-bold">{value}</Text>
      <Text className="text-gray-500 text-xs mt-1">{unit}</Text>
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
    const elevFt = isImperial ? elevUser : Math.round(elevUser * 3.28084);
    const durationMin = parseInt(durationStr) || 0;
    return {
      ...(distKm > 0 ? { distanceRunKm: distKm } : durationMin > 0 ? { workoutMinutes: durationMin } : {}),
      elevationFt: elevFt || undefined,
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
      undefined, (parseInt(durationStr) || 0) >= 20,
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
  const { daily: dailyIds, weekly: weeklyIds, monthly: monthlyIds, isLoading: assignmentsLoading } = useQuestAssignments(activeHero?.hero_id);
  const streakDays = activeHero?.streak_days ?? 0;
  const heroId = activeHero?.hero_id;
  const dailyQuests = useDailyQuests(heroId, streakDays, dailyIds);
  const weeklyQuests = useWeeklyQuests(heroId, streakDays, weeklyIds);
  const monthlyQuests = useMonthlyQuests(heroId, streakDays, monthlyIds);
  const bossQuests = useBossQuests(heroId, streakDays);
  useQuestRewards(heroId, dailyQuests, weeklyQuests, monthlyQuests, bossQuests);
  const { pendingLevelUp, clearLevelUp, onStatChosen } = useLevelUpDetector(activeHero, heroDef);
  const [logRunVisible, setLogRunVisible] = useState(false);
  const [logPuzzleVisible, setLogPuzzleVisible] = useState(false);
  const [lastResult, setLastResult] = useState<{ xpEarned: number; leveledUp: boolean } | null>(null);
  const [healthPromptVisible, setHealthPromptVisible] = useState(false);
  const [sleepOptInVisible, setSleepOptInVisible] = useState(false);
  const { todayStats, sleepSummary, isSyncing, isConnecting, needsHealthSetup, sleepEnabled, connectHealth, forceSync, enableSleepTracking } = useHealthSync(activeHero?.hero_id);
  const { luckyToday, dismissLuck } = useLuckCheck();
  const { claimableBonuses } = usePlayerStats(activeHero?.hero_id);
  const totalClaimable = PLAYER_STATS.reduce((s, stat) => s + (claimableBonuses[stat] ?? 0), 0);

  useEffect(() => {
    if (!needsHealthSetup) return;
    const timer = setTimeout(() => setHealthPromptVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [needsHealthSetup]);

  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;
  const { distanceUnit, isImperial } = useUnits();

  const todayDistanceDisplay = todayStats.distanceKm > 0
    ? (isImperial ? (todayStats.distanceKm * 0.621371).toFixed(1) : todayStats.distanceKm.toFixed(1))
    : '—';

  const { progress: xpInLevel, needed: xpToNext } = activeHero
    ? xpProgressInLevel(activeHero.total_xp, activeHero.level)
    : { progress: 0, needed: 0 };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const displayName = user?.email?.split('@')[0] ?? 'Hero';
  const syncTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  function handleXpResult(result: any) {
    setLastResult({ xpEarned: result.totalXp, leveledUp: result.leveledUp });
    refreshHero();
    refreshQuests();
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

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={forceSync} tintColor="#F59E0B" />}
      >

        {/* Header */}
        <View className="px-5 pt-5 pb-3 flex-row justify-between items-start">
          <View>
            <Text className="text-gray-400 text-sm">{greeting}, <Text className="text-white font-semibold">{displayName}</Text></Text>
            <Text className="text-white text-3xl font-bold tracking-tight mt-0.5">Today</Text>
          </View>
          <View className="items-end pt-1">
            <Text className="text-emerald-400 text-xs font-semibold">● Synced</Text>
            <Text className="text-gray-500 text-xs mt-0.5">{syncTime}</Text>
          </View>
        </View>

        {/* Lucky day modal */}
        <Modal visible={luckyToday} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <View style={{ backgroundColor: '#13100A', borderWidth: 1, borderColor: '#92400E', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%' }}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>🍀</Text>
              <Text style={{ color: '#FBBF24', fontSize: 26, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 }}>Lucky Day!</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>
                The fates smile upon you today.{'\n'}+1 Luck SP has been added to your stats.
              </Text>
              <TouchableOpacity
                onPress={dismissLuck}
                style={{ backgroundColor: '#78350F', borderWidth: 1, borderColor: '#D97706', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 }}
              >
                <Text style={{ color: '#FBBF24', fontWeight: '700', fontSize: 15, letterSpacing: 1 }}>CLAIM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Level-up modal */}
        {heroDef && pendingLevelUp && (
          <LevelUpModal
            visible={true}
            onDismiss={clearLevelUp}
            onStatChosen={onStatChosen}
            heroName={heroDef.name}
            levelUpInfo={pendingLevelUp}
            skills={heroDef.skills}
            colors={CLASS_COLORS[heroDef.heroClass]}
          />
        )}

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
        <View style={{ borderColor: colors.border, borderWidth: 2, borderRadius: 16, marginHorizontal: 20, marginBottom: 16, overflow: 'hidden' }}>
          {totalClaimable > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/hero')}
              activeOpacity={0.75}
              style={{
                backgroundColor: colors.accent + '2A',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 7,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                ✨ {totalClaimable} stat bonus{totalClaimable !== 1 ? 'es' : ''} ready to claim
              </Text>
              <Text style={{ color: colors.accent, fontSize: 12 }}>→</Text>
            </TouchableOpacity>
          )}
          <LinearGradient
            colors={[colors.dimBg, '#0D0D18']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}
          >
            {/* Streak pill */}
            <View
              style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#451a03', borderWidth: 1, borderColor: '#b45309', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 }}
            >
              <Text style={{ fontSize: 15 }}>🔥</Text>
              <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '700', marginLeft: 4 }}>{effectiveStreak(activeHero.streak_days, activeHero.last_active_date)}</Text>
            </View>

            {/* Portrait */}
            <View
              style={{ borderColor: colors.border }}
              className="w-16 h-16 rounded-2xl border bg-[#1A1A2E] items-center justify-center shrink-0"
            >
              <Text style={{ fontSize: 30 }}>{CLASS_SYMBOLS[heroDef.id] ?? '⚔'}</Text>
            </View>

            {/* Info */}
            <View className="flex-1" style={{ paddingRight: 80 }}>
              <Text className="text-white text-xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{heroDef.name}</Text>
              <Text style={{ color: colors.accent, opacity: 0.8 }} className="text-sm font-semibold mt-0.5 mb-2.5">
                {heroDef.heroClass.charAt(0).toUpperCase() + heroDef.heroClass.slice(1)}  ·  {TIER_LABELS[activeHero.tier as keyof typeof TIER_LABELS] ?? activeHero.tier}
              </Text>
              <View className="flex-row items-center mb-1.5">
                <View style={{ backgroundColor: colors.border }} className="rounded-md px-2 py-0.5">
                  <Text style={{ color: colors.accent }} className="text-xs font-bold">Lv {activeHero.level}</Text>
                </View>
                <Text className="text-white text-xs" style={{ marginLeft: 'auto' }}>
                  {xpInLevel.toLocaleString()} / {xpToNext.toLocaleString()} XP
                </Text>
              </View>
              <XpBar totalXp={activeHero.total_xp} level={activeHero.level} accentColor={colors.accent} compact />
            </View>
          </LinearGradient>
        </View>

        {/* Today's stats */}
        <View className="px-5 mb-4">
          {needsHealthSetup ? (
            <TouchableOpacity
              onPress={connectHealth}
              disabled={isConnecting}
              style={{ borderColor: colors.border }}
              className="bg-[#12121E] border rounded-2xl p-4 flex-row items-center justify-between"
              activeOpacity={0.7}
            >
              <View className="flex-1 mr-3">
                <Text className="text-white font-bold mb-0.5">Connect Apple Health</Text>
                <Text className="text-gray-400 text-xs">
                  {isConnecting ? 'Connecting…' : 'Sync workouts and earn XP automatically'}
                </Text>
              </View>
              {isConnecting
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Text style={{ color: colors.accent }} className="font-bold text-sm">Connect →</Text>
              }
            </TouchableOpacity>
          ) : (
            <View className="flex-row" style={{ gap: 10 }}>
              <StatTile
                icon="👟"
                value={todayStats.steps > 0 ? todayStats.steps.toLocaleString() : '—'}
                unit="steps"
              />
              <StatTile
                icon="⚡"
                value={todayStats.activeCalories > 0 ? todayStats.activeCalories.toLocaleString() : '—'}
                unit="kcal"
              />
              <StatTile
                icon="📍"
                value={todayDistanceDisplay}
                unit={distanceUnit}
              />
            </View>
          )}
        </View>

        {/* Sleep card */}
        {!needsHealthSetup && isHealthKitAvailable() && (
          <View className="px-5 mb-5">
            {sleepSummary ? (
              <TouchableOpacity
                className="rounded-2xl overflow-hidden"
                style={{ borderWidth: 1, borderColor: '#1B6B8A' }}
                activeOpacity={0.7}
                onPress={() => Alert.alert(
                  'Sleep Bonus',
                  'Your sleep last night affects today\'s XP:\n\n' +
                  '🌙 Well Rested (7.5+ hrs)  →  +10% XP\n' +
                  '😐 Normal (6–7.5 hrs)  →  no change\n' +
                  '😴 Poor (< 6 hrs)  →  −10% XP\n\n' +
                  'Only applies to today\'s workouts and steps.',
                )}
              >
                <LinearGradient
                  colors={['#0F2D42', '#080F18']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>
                    {sleepSummary.label === 'Well Rested' ? '🌙' : sleepSummary.label === 'Poor' ? '😴' : '😐'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text className="text-sky-200 text-base font-semibold">{sleepSummary.label}</Text>
                    <Text className="text-sky-300 text-sm mt-0.5">{formatSleepDuration(sleepSummary.totalHours)} last night</Text>
                  </View>
                  <Text
                    className="text-base font-bold"
                    style={{ color: sleepSummary.multiplier > 1 ? '#34D399' : sleepSummary.multiplier < 1 ? '#F87171' : '#9CA3AF' }}
                  >
                    {sleepSummary.multiplier > 1 ? '+10% XP' : sleepSummary.multiplier < 1 ? '−10% XP' : 'No bonus'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : sleepEnabled ? (
              <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#164E63' }}>
                <LinearGradient
                  colors={['#0D1F2D', '#080F18']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>🌙</Text>
                  <View>
                    <Text className="text-sky-300 text-sm font-semibold">No sleep data for last night</Text>
                    <Text className="text-sky-700 text-xs mt-0.5">Recorded by Apple Watch or Health app</Text>
                  </View>
                </LinearGradient>
              </View>
            ) : (
              <TouchableOpacity
                className="bg-[#12121E] border border-[#1E1E35] rounded-2xl px-4 py-3 flex-row items-center justify-between"
                activeOpacity={0.7}
                onPress={() => setSleepOptInVisible(true)}
              >
                <View className="flex-row items-center flex-1 mr-3">
                  <Text style={{ fontSize: 22 }} className="mr-3">🌙</Text>
                  <View>
                    <Text className="text-white text-sm font-semibold">Enable Sleep Bonus</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">Let sleep quality affect your daily XP</Text>
                  </View>
                </View>
                <Text style={{ color: colors.accent }} className="text-sm font-bold">Enable →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quests */}
        {assignmentsLoading ? (
          <View className="px-5">
            <View className="bg-[#12121E] border border-[#1E1E35] rounded-2xl p-4 items-center">
              <ActivityIndicator color="#6B7280" />
            </View>
          </View>
        ) : (
          <View className="px-5 gap-6">
            {dailyQuests.length > 0 && (
              <View>
                <Text className="text-white text-sm uppercase tracking-widest mb-3">Today's Quest</Text>
                {dailyQuests.map(q => <QuestCard key={q.id} quest={q} accentColor={colors.accent} />)}
              </View>
            )}
            {weeklyQuests.length > 0 && (
              <View>
                <Text className="text-white text-sm uppercase tracking-widest mb-3">This Week</Text>
                {weeklyQuests.map(q => <QuestCard key={q.id} quest={q} accentColor={colors.accent} />)}
              </View>
            )}
            {monthlyQuests.length > 0 && (
              <View>
                <Text className="text-white text-sm uppercase tracking-widest mb-3">{new Date().toLocaleDateString('en-US', { month: 'long' })}</Text>
                {monthlyQuests.map(q => <QuestCard key={q.id} quest={q} accentColor={colors.accent} />)}
              </View>
            )}
          </View>
        )}

        {/* Manual log buttons */}
        <View className="mx-5 mt-5 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 border border-[#1E1E35] rounded-2xl py-4 items-center"
            onPress={() => setLogRunVisible(true)}
          >
            <Text style={{ color: colors.accent }} className="text-sm font-bold">+ Log Run</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 border border-[#1E1E35] rounded-2xl py-4 items-center"
            onPress={() => setLogPuzzleVisible(true)}
          >
            <Text style={{ color: colors.accent }} className="text-sm font-bold">🧠 Log Puzzle</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Apple Health setup prompt */}
      <Modal visible={healthPromptVisible} transparent animationType="fade">
        <View className="flex-1 justify-end bg-black/70">
          <View className="bg-[#12121E] rounded-t-2xl p-6 border-t border-[#1E1E35]">
            <Text className="text-white text-lg font-bold mb-1">Connect Apple Health</Text>
            <Text className="text-gray-400 text-sm mb-5">
              Arete reads your workouts and activity to award XP automatically. Your data stays on your device.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.border }}
              className="rounded-xl py-4 items-center mb-3"
              onPress={() => { setHealthPromptVisible(false); setTimeout(connectHealth, 500); }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold tracking-widest uppercase">Connect →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3 items-center"
              onPress={() => setHealthPromptVisible(false)}
            >
              <Text className="text-gray-400">Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep opt-in modal */}
      <Modal visible={sleepOptInVisible} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 justify-end bg-black/70"
          activeOpacity={1}
          onPress={() => setSleepOptInVisible(false)}
        >
          <TouchableOpacity
            className="bg-[#12121E] rounded-t-2xl p-6 border-t border-[#1E1E35]"
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text className="text-white text-lg font-bold mb-1">Sleep Bonus</Text>
            <Text className="text-gray-400 text-sm mb-4">
              Arete can read your sleep data from Apple Health to apply a daily XP multiplier.
            </Text>
            <View className="bg-[#1A1A2E] border border-[#1E1E35] rounded-xl p-4 mb-5">
              <Text className="text-white text-sm mb-2 font-medium">How it works:</Text>
              <Text className="text-gray-400 text-sm mb-1">🌙  Well Rested (7.5+ hrs)  →  +10% XP today</Text>
              <Text className="text-gray-400 text-sm mb-1">😐  Normal (6–7.5 hrs)  →  no change</Text>
              <Text className="text-gray-400 text-sm">😴  Poor (&lt; 6 hrs)  →  −10% XP today</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: colors.border }}
              className="rounded-xl py-4 items-center mb-3"
              onPress={() => { setSleepOptInVisible(false); enableSleepTracking(); }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold tracking-widest uppercase">Enable Sleep Bonus</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3 items-center"
              onPress={() => setSleepOptInVisible(false)}
            >
              <Text className="text-gray-400">Not Now</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {activeHero && heroDef && user && (
        <LogPuzzleModal
          visible={logPuzzleVisible}
          onClose={() => setLogPuzzleVisible(false)}
          heroId={activeHero.hero_id}
          primaryStat={heroDef.primaryStat}
          secondaryStat={heroDef.secondaryStat}
          currentTotalXp={activeHero.total_xp}
          currentLevel={activeHero.level}
          streakDays={effectiveStreak(activeHero.streak_days, activeHero.last_active_date)}
          longestStreak={activeHero.longest_streak}
          lastActiveDate={activeHero.last_active_date}
          userId={user.id}
          accentColor={colors.accent}
          onSuccess={handleXpResult}
        />
      )}

      {activeHero && heroDef && user && (
        <LogRunModal
          visible={logRunVisible}
          onClose={() => setLogRunVisible(false)}
          heroId={activeHero.hero_id}
          primaryStat={heroDef.primaryStat}
          secondaryStat={heroDef.secondaryStat}
          currentTotalXp={activeHero.total_xp}
          currentLevel={activeHero.level}
          streakDays={effectiveStreak(activeHero.streak_days, activeHero.last_active_date)}
          longestStreak={activeHero.longest_streak}
          lastActiveDate={activeHero.last_active_date}
          userId={user.id}
          onSuccess={handleXpResult}
        />
      )}
    </SafeAreaView>
  );
}
