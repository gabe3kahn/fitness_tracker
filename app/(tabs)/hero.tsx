import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useActiveHero, useActiveHeroDef } from '../../hooks/useHeroProgression';
import { XpBar } from '../../components/hero/XpBar';
import { CLASS_COLORS, TIER_LABELS, CLASS_SYMBOLS } from '../../constants/ui';
import { TIER_LEVELS } from '../../constants/heroes';

export default function HeroScreen() {
  const router = useRouter();
  const { data: activeHero, isLoading } = useActiveHero();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;

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
        <Text className="text-gray-400 text-center mb-6">No hero selected.</Text>
        <TouchableOpacity
          className="bg-amber-500 rounded-xl px-8 py-4"
          onPress={() => router.replace('/hero-select')}
        >
          <Text className="text-[#09090F] font-bold tracking-widest">CHOOSE HERO</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tiers = Object.entries(TIER_LEVELS) as [string, { min: number; max: number | null }][];

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Hero banner */}
        <View style={{ backgroundColor: colors.dimBg }} className="px-5 pt-6 pb-8">
          <Text className="text-6xl text-center mb-4">
            {CLASS_SYMBOLS[heroDef.id] ?? '⚔'}
          </Text>
          <Text className="text-white text-4xl font-bold text-center">{heroDef.name}</Text>
          <Text className="text-gray-400 text-center mt-1">{heroDef.origin}</Text>
          <View style={{ borderColor: colors.border }} className="self-center border rounded-full px-4 py-1 mt-3">
            <Text style={{ color: colors.accent }} className="text-xs font-bold uppercase tracking-widest">
              {TIER_LABELS[activeHero.tier as keyof typeof TIER_LABELS]}  ·  Level {activeHero.level}
            </Text>
          </View>
        </View>

        {/* XP progress */}
        <View className="mx-5 -mt-4 bg-[#12121E] border border-[#1E1E35] rounded-2xl p-5">
          <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-3">
            Progression
          </Text>
          <XpBar totalXp={activeHero.total_xp} level={activeHero.level} accentColor={colors.accent} />
          <View className="flex-row justify-between mt-4">
            <View>
              <Text className="text-gray-400 text-xs uppercase tracking-wider">Total XP</Text>
              <Text className="text-white font-bold text-lg">{activeHero.total_xp.toLocaleString()}</Text>
            </View>
            <View className="items-center">
              <Text className="text-gray-400 text-xs uppercase tracking-wider">Streak</Text>
              <Text className="text-orange-400 font-bold text-lg">🔥 {activeHero.streak_days}</Text>
            </View>
            <View className="items-end">
              <Text className="text-gray-400 text-xs uppercase tracking-wider">Best Streak</Text>
              <Text className="text-white font-bold text-lg">{activeHero.longest_streak} days</Text>
            </View>
          </View>
        </View>

        {/* Tier roadmap */}
        <View className="mx-5 mt-4 bg-[#12121E] border border-[#1E1E35] rounded-2xl p-5">
          <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-4">
            Tier Roadmap
          </Text>
          {tiers.map(([tier, range]) => {
            const isUnlocked = activeHero.level >= range.min;
            const isCurrent = activeHero.tier === tier;
            return (
              <View key={tier} className="flex-row items-center mb-3">
                <View
                  style={isCurrent ? { backgroundColor: colors.border } : undefined}
                  className={`w-2 h-2 rounded-full mr-3 ${isUnlocked ? '' : 'bg-[#1E1E35]'}`}
                />
                <View className="flex-1">
                  <Text className={`font-semibold ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                    {TIER_LABELS[tier as keyof typeof TIER_LABELS]}
                    {isCurrent ? '  ← current' : ''}
                  </Text>
                  <Text className={`text-xs ${isUnlocked ? 'text-gray-400' : 'text-gray-400'}`}>
                    Level {range.min}{range.max ? `–${range.max}` : '+'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Skills */}
        <View className="mx-5 mt-4 bg-[#12121E] border border-[#1E1E35] rounded-2xl p-5">
          <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-4">
            Skills
          </Text>
          {heroDef.skills.map((skill) => {
            const isUnlocked = activeHero.level >= skill.unlocksAtLevel;
            return (
              <View key={skill.name} className="mb-4 last:mb-0">
                <View className="flex-row justify-between items-start mb-0.5">
                  <Text className={`font-bold text-base flex-1 mr-2 ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                    {skill.name}
                  </Text>
                  <View
                    style={isUnlocked ? { borderColor: colors.border } : undefined}
                    className={`border rounded-full px-2 py-0.5 ${isUnlocked ? '' : 'border-[#1E1E35]'}`}
                  >
                    <Text className={`text-xs ${isUnlocked ? '' : 'text-gray-400'}`}
                      style={isUnlocked ? { color: colors.accent } : undefined}
                    >
                      Lv. {skill.unlocksAtLevel}
                    </Text>
                  </View>
                </View>
                <Text className={`text-sm ${isUnlocked ? 'text-gray-400' : 'text-gray-400'}`}>
                  {skill.description}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Change hero */}
        <TouchableOpacity
          className="mx-5 mt-4 border border-[#1E1E35] rounded-xl py-4 items-center"
          onPress={() => router.push('/hero-select')}
        >
          <Text className="text-gray-400 text-sm">Switch Hero</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
