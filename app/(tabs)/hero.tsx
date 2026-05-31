import { useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useActiveHero, useActiveHeroDef } from '../../hooks/useHeroProgression';
import { usePlayerStats, useRefreshPlayerStats } from '../../hooks/usePlayerStats';
import { PLAYER_STATS, PlayerStat } from '../../constants/stats';
import { PlayerStatRow, claimStatBonuses } from '../../services/stat-engine';
import { XpBar } from '../../components/hero/XpBar';
import { CLASS_COLORS, TIER_LABELS, CLASS_SYMBOLS } from '../../constants/ui';
import { HeroTier, TIER_LEVELS } from '../../constants/heroes';
import { getHeroImage } from '../../constants/hero-images';
import { streakMultiplier, xpProgressInLevel, effectiveStreak } from '../../constants/xp-config';
import { useUserStore } from '../../stores/user-store';

const STAT_CONFIG: Record<PlayerStat, { label: string; color: string; symbol: string; gradient: [string, string] }> = {
  strength:     { label: 'Strength',     color: '#F87171', symbol: '⚔️', gradient: ['#EF4444', '#F97316'] },
  endurance:    { label: 'Endurance',    color: '#60A5FA', symbol: '🏃', gradient: ['#3B82F6', '#06B6D4'] },
  dexterity:    { label: 'Dexterity',    color: '#4ADE80', symbol: '⚡', gradient: ['#10B981', '#84CC16'] },
  intelligence: { label: 'Intelligence', color: '#C084FC', symbol: '🧠', gradient: ['#8B5CF6', '#EC4899'] },
  luck:         { label: 'Luck',         color: '#FBBF24', symbol: '🍀', gradient: ['#F59E0B', '#EAB308'] },
};

const SKILL_ICONS: Record<string, string> = {
  'Lion Skin': '🦁',          'Twelve Labors': '🏋️',      'Olympian Might': '💪',
  'Nemean Roar': '🌩️',        'Divine Lineage': '✨',
  'Huntress Stride': '🏹',    'Golden Apple': '🍎',        'Boar Slayer': '🐗',
  'Argonaut Sprint': '🌊',    'Artemis Blessed': '🌙',
  "Tengu's Teaching": '🥷',   'Ushiwakamaru': '⚔️',        "Exile's Resolve": '🗡️',
  'Genpei Victor': '🏆',      'Never Defeated': '🔰',
  "Soldier's Resolve": '🛡️', 'Northern Campaign': '❄️',   'Honor the Family': '🎋',
  'Imperial Champion': '👑',  'Legend of Hua': '🌸',
  'Warp Spasm': '⚡',          'Gáe Bulg': '🔱',            'Red Branch Knight': '☘️',
  "Champion's Light": '💡',   'Battle Frenzy': '🔥',
  'Warrior Queen': '👑',      'Iceni Rising': '⚔️',        'Battle Chariot': '🐎',
  'Roman Defiance': '🛡️',    'Eternal Flame': '🔥',
};

function StatRow({ stat, row, cap }: { stat: PlayerStat; row: PlayerStatRow; cap: number }) {
  const cfg = STAT_CONFIG[stat];
  const pct = Math.min(row.level / cap, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <Text style={{ fontSize: 16, width: 22 }}>{cfg.symbol}</Text>
      <Text style={{ color: cfg.color, fontSize: 14, fontWeight: '600', width: 96 }} numberOfLines={1}>{cfg.label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: '#252540', borderRadius: 100, overflow: 'hidden' }}>
        <LinearGradient
          colors={cfg.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: pct === 0 ? 4 : `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 100 }}
        />
      </View>
      <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '700', width: 26, textAlign: 'right' }}>{row.level}</Text>
    </View>
  );
}


export default function HeroScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { data: activeHero, isLoading } = useActiveHero();
  const heroDef = useActiveHeroDef(activeHero?.hero_id);
  const colors = heroDef ? CLASS_COLORS[heroDef.heroClass] : CLASS_COLORS.warrior;
  const { playerStats, claimableBonuses } = usePlayerStats(activeHero?.hero_id);
  const refreshStats = useRefreshPlayerStats();
  const [showNextTier, setShowNextTier] = useState(true);
  const [claimingStat, setClaimingStat] = useState<PlayerStat | null>(null);

  async function handleClaim(stat: PlayerStat) {
    if (!user || !activeHero || claimingStat) return;
    setClaimingStat(stat);
    await claimStatBonuses(user.id, activeHero.hero_id, stat);
    refreshStats();
    setClaimingStat(null);
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


  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Hero banner */}
        <View style={{ height: 460, width: '100%', overflow: 'hidden' }}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.dimBg }]} />
          {getHeroImage(heroDef.id, activeHero.tier as HeroTier) ? (
            <Image
              source={getHeroImage(heroDef.id, activeHero.tier as HeroTier)!}
              style={{ width: '100%', height: 600 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 96 }}>{CLASS_SYMBOLS[heroDef.id] ?? '⚔'}</Text>
            </View>
          )}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <View style={{ flex: 1 }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.05)' }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.12)' }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.22)' }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.35)' }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.50)' }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.65)' }} />
            <View style={{ height: 12, backgroundColor: 'rgba(9,9,15,0.80)' }} />
            <View style={{ height: 16, backgroundColor: 'rgba(9,9,15,0.92)' }} />
            <View style={{ height: 24, backgroundColor: 'rgba(9,9,15,1.00)' }} />
          </View>
          <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800' }}>{heroDef.name}</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 2 }}>{heroDef.origin}</Text>
            <View style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4, marginTop: 10 }}>
              <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
                {TIER_LABELS[activeHero.tier as keyof typeof TIER_LABELS]}  ·  Level {activeHero.level}
              </Text>
            </View>
          </View>
        </View>

        {/* XP progress */}
        {(() => {
          const { progress, needed } = xpProgressInLevel(activeHero.total_xp, activeHero.level);
          const currentStreak = effectiveStreak(activeHero.streak_days, activeHero.last_active_date);
          const bonusPct = Math.round((streakMultiplier(currentStreak) - 1) * 100);
          const tierOrder = ['novice', 'apprentice', 'champion', 'legend', 'mythic'] as const;
          const nextTierKey = tierOrder[tierOrder.indexOf(activeHero.tier as any) + 1];
          const nextTierMin = nextTierKey ? TIER_LEVELS[nextTierKey]?.min : null;
          return (
            <View className="mx-5 -mt-4 bg-[#12121E] border border-[#1E1E35] rounded-2xl p-5">
              <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: colors.border, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {TIER_LABELS[activeHero.tier as keyof typeof TIER_LABELS]}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View>
                  <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800', lineHeight: 36 }}>{activeHero.level}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Level</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#D1D5DB', fontSize: 12, marginBottom: 6 }}>
                    {progress.toLocaleString()} / {needed.toLocaleString()} XP to Level {activeHero.level + 1}
                  </Text>
                  <XpBar totalXp={activeHero.total_xp} level={activeHero.level} accentColor={colors.accent} compact />
                  <View style={{ flexDirection: 'row', marginTop: 6 }}>
                    <Text
                      style={{ color: '#9CA3AF', fontSize: 11, flex: 1 }}
                      numberOfLines={1}
                      onTextLayout={(e) => {
                        if (e.nativeEvent.lines[0]?.text?.includes('…')) setShowNextTier(false);
                      }}
                    >
                      🔥 {currentStreak}-day streak{bonusPct !== 0 ? ` · ${bonusPct > 0 ? '+' : ''}${bonusPct}% XP` : ''}
                    </Text>
                    {nextTierMin && showNextTier && (
                      <Text style={{ color: '#6B7280', fontSize: 11, flexShrink: 0, marginLeft: 8 }}>
                        → Lv {nextTierMin} for {TIER_LABELS[nextTierKey as keyof typeof TIER_LABELS]}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Player stats */}
        {(() => {
          const maxStatLevel = Math.max(...PLAYER_STATS.map(s => playerStats[s].level));
          const cap = Math.max(100, 100 * Math.ceil((maxStatLevel + 1) / 90));
          return (
            <View className="mx-5 mt-4 bg-[#12121E] border border-[#1E1E35] rounded-2xl p-5">
              <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-4">Player Stats</Text>
              {PLAYER_STATS.map((stat) => (
                <StatRow key={stat} stat={stat} row={playerStats[stat]} cap={cap} />
              ))}
              {PLAYER_STATS.some(s => (claimableBonuses[s] ?? 0) > 0) && (
                <View style={{ borderTopWidth: 1, borderTopColor: '#1E1E35', marginTop: 6, paddingTop: 14 }}>
                  <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                    Bonus Available
                  </Text>
                  {PLAYER_STATS.filter(s => (claimableBonuses[s] ?? 0) > 0).map(stat => {
                    const cfg = STAT_CONFIG[stat];
                    return (
                      <View key={stat} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <Text style={{ fontSize: 16, width: 22 }}>{cfg.symbol}</Text>
                        <Text style={{ color: cfg.color, fontSize: 14, fontWeight: '600', flex: 1 }}>{cfg.label}</Text>
                        <TouchableOpacity
                          onPress={() => handleClaim(stat)}
                          disabled={!!claimingStat}
                          style={{
                            borderWidth: 1,
                            borderColor: cfg.color,
                            backgroundColor: cfg.color + '26',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            minWidth: 96,
                            alignItems: 'center',
                          }}
                        >
                          {claimingStat === stat
                            ? <ActivityIndicator size="small" color={cfg.color} />
                            : <Text style={{ color: cfg.color, fontSize: 12, fontWeight: '700' }}>⬆ Claim ×{claimableBonuses[stat]}</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* Skills */}
        <View className="mx-5 mt-4 bg-[#12121E] border border-[#1E1E35] rounded-2xl p-5">
          <Text style={{ color: colors.accent }} className="text-xs uppercase tracking-widest mb-4">
            Skills
          </Text>
          {heroDef.skills.map((skill, i) => {
            const isUnlocked = activeHero.level >= skill.unlocksAtLevel;
            return (
              <View
                key={skill.name}
                className="flex-row items-start"
                style={{ paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#1A1A2A' }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: isUnlocked ? colors.border : '#1E1E35',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 12, flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 18 }}>{SKILL_ICONS[skill.name] ?? CLASS_SYMBOLS[heroDef.id] ?? '⚔'}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center mb-0.5">
                    <Text style={{ color: isUnlocked ? '#fff' : '#6B7280', fontSize: 17, fontWeight: '700' }}>
                      {skill.name}
                    </Text>
                    <Text className="text-xs font-semibold" style={{ color: isUnlocked ? colors.accent : '#4B5563' }}>
                      {isUnlocked ? 'Unlocked' : `Lv. ${skill.unlocksAtLevel}`}
                    </Text>
                  </View>
                  <Text style={{ color: isUnlocked ? '#9CA3AF' : '#4B5563' }} className="text-xs">
                    {skill.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Switch hero — dev only */}
        {__DEV__ && (
          <TouchableOpacity
            onPress={() => router.push('/hero-select')}
            style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#2A2A45', borderRadius: 14, paddingVertical: 14, backgroundColor: '#12121E' }}
          >
            <Text style={{ fontSize: 16 }}>⚔️</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 }}>Switch Hero</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
