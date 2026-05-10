import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveHero, useActiveHeroDef } from '../../hooks/useHeroProgression';
import { useDailyQuests, useWeeklyQuests, useBossQuests, QuestWithProgress } from '../../hooks/useQuests';
import { CLASS_COLORS } from '../../constants/ui';

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-3">
      <Text className="text-gray-400 text-xs uppercase tracking-widest">{title}</Text>
      {subtitle && <Text className="text-gray-400 text-xs mt-0.5">{subtitle}</Text>}
    </View>
  );
}

function QuestRow({
  quest, accentColor, badgeColor,
}: {
  quest: QuestWithProgress;
  accentColor: string;
  badgeColor?: string;
}) {
  const pct = Math.min(quest.progress / quest.target, 1);
  const badge = badgeColor ?? accentColor;
  return (
    <View className="bg-[#12121E] border border-[#1E1E35] rounded-xl p-4 mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className={`font-bold text-base ${quest.isCompleted ? 'text-gray-400' : 'text-white'}`}>
            {quest.title}
          </Text>
          <Text className="text-gray-400 text-sm mt-0.5">{quest.description}</Text>
        </View>
        <View style={{ borderColor: badge }} className="border rounded-lg px-2 py-1 items-center min-w-[44px]">
          <Text style={{ color: badge }} className="text-xs font-bold">+{quest.xpReward}</Text>
          <Text style={{ color: badge }} className="text-xs">XP</Text>
        </View>
      </View>
      <View className="h-1.5 bg-[#1E1E35] rounded-full overflow-hidden">
        <View
          style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: quest.isCompleted ? '#4B5563' : accentColor }}
          className="h-full rounded-full"
        />
      </View>
      <Text className="text-gray-400 text-xs mt-1">
        {quest.isCompleted
          ? 'Complete! ✓'
          : `${quest.progress.toLocaleString()} / ${quest.target.toLocaleString()}`}
      </Text>
    </View>
  );
}

export default function QuestsScreen() {
  const { data: activeHero, isLoading } = useActiveHero();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const streakDays = activeHero?.streak_days ?? 0;
  const dailyQuests = useDailyQuests(activeHero?.hero_id, streakDays);
  const weeklyQuests = useWeeklyQuests(activeHero?.hero_id, streakDays);
  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;

  const bossQuests = useBossQuests(activeHero?.hero_id, streakDays);

  const resetTime = (() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const hours = Math.floor((tomorrow.getTime() - now.getTime()) / 3600000);
    const mins = Math.floor(((tomorrow.getTime() - now.getTime()) % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  })();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#09090F] items-center justify-center">
        <ActivityIndicator color="#F59E0B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pt-4 pb-4">
          <Text className="text-white text-2xl font-bold">Quests</Text>
          <Text className="text-gray-400 text-xs mt-1">Complete quests to earn bonus XP</Text>
        </View>

        <View className="px-5 mb-5">
          <SectionHeader title="Daily Quests" subtitle={`Resets in ${resetTime}`} />
          {dailyQuests.map((q) => (
            <QuestRow key={q.id} quest={q} accentColor={colors.accent} />
          ))}
        </View>

        <View className="px-5 mb-5">
          <SectionHeader title="Weekly Quests" subtitle="Resets Monday" />
          {weeklyQuests.map((q) => (
            <QuestRow key={q.id} quest={q} accentColor={colors.accent} />
          ))}
        </View>

        <View className="px-5">
          <SectionHeader title="Boss Battles" subtitle="Major milestones — legendary rewards" />
          {bossQuests.map((q) => (
            <QuestRow key={q.id} quest={q} accentColor="#EF4444" badgeColor="#EF4444" />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
