import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { PlayerStat, PLAYER_STATS } from '../../constants/stats';

const STAT_STYLE: Record<PlayerStat, { label: string; icon: string; color: string }> = {
  strength:     { label: 'Strength',     icon: '⚔️', color: '#F87171' },
  endurance:    { label: 'Endurance',    icon: '🏃', color: '#60A5FA' },
  dexterity:    { label: 'Dexterity',    icon: '⚡', color: '#4ADE80' },
  intelligence: { label: 'Intelligence', icon: '🧠', color: '#C084FC' },
  luck:         { label: 'Luck',         icon: '🍀', color: '#FBBF24' },
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

interface HeroSkill {
  name: string;
  description: string;
  unlocksAtLevel: number;
}

interface HeroColors {
  border: string;
  accent: string;
  dimBg: string;
}

export interface LevelUpInfo {
  heroId: string;
  startLevel: number;
  endLevel: number;
  statChanges: Partial<Record<PlayerStat, { from: number; to: number }>>;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onStatChosen: (stat: PlayerStat, level: number) => Promise<void>;
  heroName: string;
  levelUpInfo: LevelUpInfo;
  skills: HeroSkill[];
  colors: HeroColors;
}

const STAT_ORDER: PlayerStat[] = ['strength', 'endurance', 'dexterity', 'intelligence', 'luck'];
const STAT_PICK_ROWS: PlayerStat[][] = [
  ['strength', 'endurance'],
  ['dexterity', 'intelligence'],
  ['luck'],
];

function StatTile({ stat, from, to }: { stat: PlayerStat; from: number; to: number }) {
  const s = STAT_STYLE[stat];
  return (
    <View style={{ flex: 1, backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 15 }}>{s.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '500' }}>{s.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '700' }}>{from}</Text>
          <Text style={{ color: s.color, fontSize: 11 }}>→</Text>
          <Text style={{ color: s.color, fontSize: 15, fontWeight: '800' }}>{to}</Text>
        </View>
      </View>
    </View>
  );
}

function StatPickerTile({ stat, selected, onPress }: { stat: PlayerStat; selected: boolean; onPress: () => void }) {
  const s = STAT_STYLE[stat];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        backgroundColor: selected ? s.color + '22' : '#12121E',
        borderWidth: 1.5,
        borderColor: selected ? s.color : '#1E1E35',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 22 }}>{s.icon}</Text>
      <Text style={{ color: selected ? s.color : '#9CA3AF', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
        {s.label}
      </Text>
    </TouchableOpacity>
  );
}

export function LevelUpModal({ visible, onDismiss, onStatChosen, heroName, levelUpInfo, skills, colors }: Props) {
  const { startLevel, endLevel, statChanges } = levelUpInfo;
  const numLevels = endLevel - startLevel;

  // step 0 = celebration, step 1..numLevels = picker for startLevel+step
  const [step, setStep] = useState(0);
  const [selectedStat, setSelectedStat] = useState<PlayerStat | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setSelectedStat(null);
      setConfirming(false);
    }
  }, [visible, levelUpInfo.heroId, levelUpInfo.endLevel]);

  const unlockedSkills = skills.filter(s => s.unlocksAtLevel > startLevel && s.unlocksAtLevel <= endLevel);
  const nextSkill = skills
    .filter(s => s.unlocksAtLevel > endLevel)
    .sort((a, b) => a.unlocksAtLevel - b.unlocksAtLevel)[0];

  const statPairs = STAT_ORDER
    .filter(s => statChanges[s] != null)
    .map(s => ({ stat: s, ...statChanges[s]! }));
  const rows: typeof statPairs[] = [];
  for (let i = 0; i < statPairs.length; i += 2) rows.push(statPairs.slice(i, i + 2));

  const handleContinueToPicker = () => {
    setStep(1);
    setSelectedStat(null);
  };

  const handleConfirmPick = async () => {
    if (!selectedStat || confirming) return;
    setConfirming(true);
    const pickLevel = startLevel + step;
    await onStatChosen(selectedStat, pickLevel);
    setConfirming(false);
    if (step >= numLevels) {
      onDismiss();
    } else {
      setStep(s => s + 1);
      setSelectedStat(null);
    }
  };

  const pickLevel = startLevel + step;
  const isLastPick = step >= numLevels;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <ScrollView style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: '#0F0F1C', borderWidth: 1.5, borderColor: colors.border, borderRadius: 24, padding: 28, overflow: 'hidden' }}>

            {/* Background glow */}
            <View style={{ position: 'absolute', top: -60, left: '50%', marginLeft: -100, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.accent, opacity: 0.1 }} pointerEvents="none" />

            {step === 0 ? (
              <>
                {/* Header */}
                <Text style={{ color: colors.border, fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 }}>
                  ⚔ Level Up!
                </Text>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 16 }}>
                  {heroName}
                </Text>

                {/* Level row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
                  <Text style={{ color: '#4B5563', fontSize: 28, fontWeight: '800' }}>{startLevel}</Text>
                  <Text style={{ color: colors.accent, fontSize: 20 }}>→</Text>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.accent, fontSize: 52, fontWeight: '900', lineHeight: 56, textShadowColor: colors.accent, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }}>
                      {endLevel}
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
                      Level
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: '#1E1E35', marginBottom: 16 }} />

                {/* Stats */}
                <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                  Stats gained
                </Text>
                <View style={{ gap: 8 }}>
                  {rows.map((row, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                      {row.map(({ stat, from, to }) => (
                        <StatTile key={stat} stat={stat} from={from} to={to} />
                      ))}
                      {row.length === 1 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
                </View>

                {/* Unlocked skills */}
                {unlockedSkills.length > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: '#1E1E35', marginVertical: 16 }} />
                    <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                      {unlockedSkills.length === 1 ? 'Skill unlocked' : 'Skills unlocked'}
                    </Text>
                    <View style={{ gap: 8 }}>
                      {unlockedSkills.map(skill => (
                        <View key={skill.name} style={{ backgroundColor: '#12121E', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.dimBg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Text style={{ fontSize: 20 }}>{SKILL_ICONS[skill.name] ?? '⚔'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <View style={{ backgroundColor: colors.dimBg, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ color: colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Lv {skill.unlocksAtLevel}</Text>
                              </View>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{skill.name}</Text>
                            </View>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, lineHeight: 18 }}>{skill.description}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Next-skill hint */}
                {unlockedSkills.length === 0 && nextSkill && (
                  <View style={{ marginTop: 12, backgroundColor: '#12121E', borderWidth: 1, borderColor: '#1E1E35', borderRadius: 12, padding: 12 }}>
                    <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '600' }}>
                      Next skill at <Text style={{ color: colors.accent }}>Level {nextSkill.unlocksAtLevel}</Text>{'  ·  '}{nextSkill.name}
                    </Text>
                  </View>
                )}

                {/* Button */}
                <TouchableOpacity
                  onPress={handleContinueToPicker}
                  style={{ marginTop: 20, backgroundColor: colors.dimBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    Choose Bonus →
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Picker header */}
                <Text style={{ color: colors.border, fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 }}>
                  Level {pickLevel} Bonus
                </Text>
                {numLevels > 1 && (
                  <Text style={{ color: '#4B5563', fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 4 }}>
                    {step} of {numLevels}
                  </Text>
                )}
                <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 20, marginTop: 4 }}>
                  Choose a stat to upgrade
                </Text>

                {/* Stat picker grid */}
                <View style={{ gap: 8, marginBottom: 20 }}>
                  {STAT_PICK_ROWS.map((row, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                      {row.map(stat => (
                        <StatPickerTile
                          key={stat}
                          stat={stat}
                          selected={selectedStat === stat}
                          onPress={() => setSelectedStat(stat)}
                        />
                      ))}
                      {row.length === 1 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
                </View>

                {/* Confirm button */}
                <TouchableOpacity
                  onPress={handleConfirmPick}
                  disabled={!selectedStat || confirming}
                  style={{
                    backgroundColor: selectedStat ? colors.dimBg : '#0F0F1C',
                    borderWidth: 1.5,
                    borderColor: selectedStat ? colors.border : '#1E1E35',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                  }}
                >
                  {confirming ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={{ color: selectedStat ? colors.accent : '#4B5563', fontWeight: '800', fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                      {isLastPick ? 'Confirm' : 'Next →'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}

          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
