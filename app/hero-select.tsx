import { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HEROES, HeroDef, HeroClass, StatKey } from '../constants/heroes';
import { CLASS_COLORS, CLASS_LABELS, CLASS_SYMBOLS } from '../constants/ui';
import { getHeroImage } from '../constants/hero-images';
import { supabase } from '../services/supabase';
import { useUserStore } from '../stores/user-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 12;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 4;
const CARD_HEIGHT = 300;

// Per-hero vertical offset (px) to position the face within the 144px art crop window.
// Negative = shift image up, revealing content further down. 0 = show from top.
const HERO_IMAGE_OFFSET_Y: Partial<Record<string, number>> = {
  yoshitsune: -50,
};

const STAT_LABELS: Record<StatKey, string> = {
  strengthWorkouts: 'Strength Workouts',
  runningDistance:  'Running Distance',
  streaks:          'Workout Streaks',
  variedActivity:   'Varied Activity',
  hiitWorkouts:     'HIIT Workouts',
  cyclingDistance:  'Cycling Distance',
  steps:            'Daily Steps',
  workoutDuration:  'Workout Duration',
  elevation:        'Elevation Gain',
  hikingDistance:   'Hiking Distance',
};

function HeroCard({ hero, colors }: { hero: HeroDef; colors: typeof CLASS_COLORS[HeroClass] }) {
  return (
    <View
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, marginHorizontal: CARD_MARGIN * 2, borderColor: colors.border }}
      className="rounded-2xl bg-[#12121E] border-2 overflow-hidden"
    >
      {/* Art area */}
      <View style={{ backgroundColor: colors.dimBg, overflow: 'hidden' }} className="h-36">
        {getHeroImage(hero.id, 'novice') ? (
          <Image
            source={getHeroImage(hero.id, 'novice')!}
            style={{ width: '100%', height: 550, marginTop: HERO_IMAGE_OFFSET_Y[hero.id] ?? 0 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 64 }}>{CLASS_SYMBOLS[hero.id] ?? '⚔'}</Text>
          </View>
        )}
        <View
          style={{ borderColor: colors.border }}
          className="absolute bottom-3 left-4 px-3 py-1 rounded-full border"
        >
          <Text style={{ color: colors.accent }} className="text-xs font-bold tracking-widest uppercase">
            {CLASS_LABELS[hero.heroClass]}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View className="px-4 pt-3 pb-4">
        <Text className="text-white text-xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{hero.name}</Text>
        <Text className="text-gray-400 text-xs mb-3">{hero.origin}</Text>
        <View className="flex-row gap-2">
          <View className="flex-1 bg-[#1A1A2E] rounded-lg px-2 py-1.5">
            <Text className="text-gray-400 text-xs mb-0.5">Primary +50%</Text>
            <Text style={{ color: colors.accent }} className="text-xs font-semibold">
              {STAT_LABELS[hero.primaryStat]}
            </Text>
          </View>
          <View className="flex-1 bg-[#1A1A2E] rounded-lg px-2 py-1.5">
            <Text className="text-gray-400 text-xs mb-0.5">Secondary +25%</Text>
            <Text className="text-gray-300 text-xs font-semibold">
              {STAT_LABELS[hero.secondaryStat]}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function HeroSelectScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const currentIndexRef = useRef(0);

  const currentHero = HEROES[currentIndex];
  const colors = CLASS_COLORS[currentHero.heroClass];
  const firstSkill = currentHero.skills[0];

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_MARGIN * 4));
    if (index >= 0 && index < HEROES.length && index !== currentIndexRef.current) {
      currentIndexRef.current = index;
      setCurrentIndex(index);
    }
  }

  async function handleSelectHero() {
    if (!user) return;
    setError('');
    setLoading(true);
    const hero = HEROES[currentIndexRef.current];

    const { error: dbError } = await supabase
      .from('user_heroes')
      .upsert(
        { user_id: user.id, hero_id: hero.id, is_active: true },
        { onConflict: 'user_id,hero_id' }
      );

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    await supabase
      .from('user_heroes')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .neq('hero_id', hero.id);

    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView className="flex-1 bg-[#09090F]">

      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <Text style={{ color: colors.accent }} className="text-xs font-bold tracking-widest uppercase mb-3">
          Arete
        </Text>
        <Text className="text-white text-3xl font-black mb-2" style={{ letterSpacing: -0.5, lineHeight: 36 }}>
          Your legend{'\n'}begins here.
        </Text>
        <Text className="text-gray-400 text-sm mb-4" style={{ lineHeight: 20 }}>
          Earn XP for every workout, quest, and puzzle you complete. Your hero's class shapes how your stats grow.
        </Text>
        <Text className="text-white text-base font-bold">Choose Your Hero</Text>
        <Text className="text-gray-500 text-xs mt-0.5">Swipe to browse · class shapes your XP bonuses</Text>
      </View>

      {/* Carousel — fixed height so button is always visible */}
      <FlatList
        ref={flatListRef}
        data={HEROES}
        keyExtractor={(h) => h.id}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH + CARD_MARGIN * 4}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingVertical: 8 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <HeroCard hero={item} colors={CLASS_COLORS[item.heroClass as HeroClass]} />
        )}
      />

      {/* Dot indicators */}
      <View className="flex-row justify-center gap-1.5 mt-2 mb-4">
        {HEROES.map((_, i) => (
          <View
            key={i}
            style={
              i === currentIndex
                ? { width: 20, height: 6, backgroundColor: colors.accent, borderRadius: 3 }
                : { width: 6, height: 6, backgroundColor: '#1E1E35', borderRadius: 3 }
            }
          />
        ))}
      </View>

      {/* First skill teaser */}
      <View className="mx-6 bg-[#12121E] rounded-xl px-4 py-3 mb-4 border border-[#1E1E35] flex-row items-center">
        <View className="flex-1">
          <Text className="text-gray-400 text-xs uppercase tracking-widest">
            First Skill · Level {firstSkill.unlocksAtLevel}
          </Text>
          <Text style={{ color: colors.accent }} className="font-bold mt-0.5">{firstSkill.name}</Text>
        </View>
        <Text className="text-gray-400 text-xs flex-1 text-right" numberOfLines={2}>
          {firstSkill.description}
        </Text>
      </View>

      {/* Error */}
      {error ? (
        <Text className="text-red-400 text-sm text-center mb-2 px-6">{error}</Text>
      ) : null}

      {/* CTA — always anchored at bottom */}
      <View className="px-6 pb-2 mt-auto">
        <TouchableOpacity
          style={{ backgroundColor: colors.border }}
          className="rounded-xl py-4 items-center"
          onPress={handleSelectHero}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base tracking-widest uppercase">
              Begin as {currentHero.name} →
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}
