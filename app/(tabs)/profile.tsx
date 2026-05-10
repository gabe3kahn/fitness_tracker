import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/user-store';
import { useActiveHero, useActiveHeroDef, useRefreshHero } from '../../hooks/useHeroProgression';
import { signOut } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { CLASS_COLORS, TIER_LABELS } from '../../constants/ui';

function SettingsRow({
  label, value, onPress, destructive = false,
}: {
  label: string; value?: string; onPress?: () => void; destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-4 border-b border-[#1E1E35]"
      onPress={onPress}
      disabled={!onPress}
    >
      <Text className={`text-base ${destructive ? 'text-red-400' : 'text-white'}`}>{label}</Text>
      {value && <Text className="text-gray-400 text-sm">{value}</Text>}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useUserStore();
  const { data: activeHero } = useActiveHero();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const refreshHero = useRefreshHero();
  const [signingOut, setSigningOut] = useState(false);
  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setUser(null);
    setSigningOut(false);
  }

  async function handleResetXp() {
    if (!user || !activeHero) return;
    Alert.alert(
      'Reset Hero XP',
      `This will reset ${heroDef?.name ?? 'your hero'} to Level 1 with 0 XP. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            await supabase
              .from('user_heroes')
              .update({ total_xp: 0, level: 1, tier: 'novice', streak_days: 0 })
              .eq('user_id', user.id)
              .eq('hero_id', activeHero.hero_id);
            await supabase
              .from('xp_events')
              .delete()
              .eq('user_id', user.id)
              .eq('hero_id', activeHero.hero_id);
            refreshHero();
          },
        },
      ]
    );
  }

  async function handleSetXp() {
    if (!user || !activeHero) return;
    Alert.prompt(
      'Set XP (Dev)',
      'Enter a total XP value to jump to any level:',
      async (value) => {
        const xp = parseInt(value ?? '0');
        if (isNaN(xp) || xp < 0) return;
        const { levelForXp, getTierForLevel } = await import('../../constants/xp-config').then(
          (m) => ({ levelForXp: m.levelForXp, getTierForLevel: require('../../constants/heroes').getTierForLevel })
        );
        const level = levelForXp(xp);
        const tier = getTierForLevel(level);
        await supabase
          .from('user_heroes')
          .update({ total_xp: xp, level, tier })
          .eq('user_id', user.id)
          .eq('hero_id', activeHero.hero_id);
        refreshHero();
      },
      'plain-text',
      String(activeHero.total_xp)
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Text className="text-white text-2xl font-bold">Profile</Text>
          <Text className="text-gray-400 text-sm mt-1">{user?.email}</Text>
        </View>

        {/* Active hero summary */}
        {activeHero && heroDef && (
          <View
            style={{ borderColor: colors.border }}
            className="mx-5 mb-6 bg-[#12121E] border rounded-2xl p-5"
          >
            <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-2">
              Active Hero
            </Text>
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-white text-xl font-bold">{heroDef.name}</Text>
                <Text className="text-gray-400 text-sm">{heroDef.origin}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white font-bold">Level {activeHero.level}</Text>
                <Text style={{ color: colors.accent }} className="text-xs">
                  {TIER_LABELS[activeHero.tier as keyof typeof TIER_LABELS]}
                </Text>
              </View>
            </View>
            <Text className="text-gray-400 text-xs mt-3">
              {activeHero.total_xp.toLocaleString()} total XP · {activeHero.streak_days} day streak
            </Text>
          </View>
        )}

        {/* Account */}
        <View className="px-5 mb-6">
          <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">Account</Text>
          <View className="bg-[#12121E] border border-[#1E1E35] rounded-xl px-4">
            <SettingsRow label="Email" value={user?.email ?? '—'} />
            <SettingsRow
              label="Switch Hero"
              onPress={() => router.push('/hero-select')}
              value="→"
            />
          </View>
        </View>

        {/* Developer tools */}
        <View className="px-5 mb-6">
          <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
            Developer Tools
          </Text>
          <View className="bg-[#12121E] border border-[#1E1E35] rounded-xl px-4">
            <SettingsRow label="Set XP (jump to level)" onPress={handleSetXp} value="→" />
            <SettingsRow label="Reset Hero XP to 0" onPress={handleResetXp} destructive />
          </View>
        </View>

        {/* Sign out */}
        <View className="px-5">
          <TouchableOpacity
            className="bg-[#12121E] border border-[#1E1E35] rounded-xl py-4 items-center"
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut
              ? <ActivityIndicator color="#EF4444" />
              : <Text className="text-red-400 font-semibold">Sign Out</Text>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
