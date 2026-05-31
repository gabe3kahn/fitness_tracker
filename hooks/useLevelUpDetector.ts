import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserStore } from '../stores/user-store';
import { awardStatSp, getPlayerStats } from '../services/stat-engine';
import { supabase } from '../services/supabase';
import type { LevelUpInfo } from '../components/hero/LevelUpModal';
import type { ActiveHeroRow } from './useHeroProgression';
import type { HeroDef } from '../constants/heroes';
import { PLAYER_STATS, type PlayerStat } from '../constants/stats';
import type { StatDistribution } from '../constants/heroes';

function primaryPlayerStat(dist: StatDistribution): PlayerStat {
  return (Object.keys(dist) as PlayerStat[]).reduce((best, stat) => dist[stat] > dist[best] ? stat : best);
}

// Centrally detects level-ups by watching activeHero.level. Any XP source that
// invalidates ['active-hero'] will trigger this — health sync, quests, manual logs.
// Awards 1 SP to each stat + 1 extra SP to the hero's primary stat per level gained.
// Also exposes onStatChosen so the level-up modal can persist the player's bonus pick.
export function useLevelUpDetector(
  activeHero: ActiveHeroRow | null | undefined,
  heroDef: HeroDef | null | undefined,
): {
  pendingLevelUp: LevelUpInfo | null;
  clearLevelUp: () => void;
  onStatChosen: (stat: PlayerStat, level: number) => Promise<void>;
} {
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpInfo | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeHero || !heroDef || !user) return;

    const currentLevel = activeHero.level;

    // Initialize silently on first load — no modal for the current level
    if (prevLevelRef.current === null) {
      prevLevelRef.current = currentLevel;
      return;
    }

    const startLevel = prevLevelRef.current;
    prevLevelRef.current = currentLevel;
    if (currentLevel <= startLevel) return;

    (async () => {
      // Award per-level: 1 SP to each stat, 2 SP to primary stat.
      // Loop per level so each has a unique session_id (idempotent on recalculate).
      const primary = primaryPlayerStat(heroDef.statDistribution);
      for (let lvl = startLevel + 1; lvl <= currentLevel; lvl++) {
        const sessionId = `level_up_${activeHero.hero_id}_${lvl}`;
        await Promise.all(
          PLAYER_STATS.map((stat: PlayerStat) => {
            const sp = stat === primary ? 2 : 1;
            return awardStatSp(user.id, activeHero.hero_id, stat, sp, 'level_up', sessionId);
          })
        );
      }

      queryClient.invalidateQueries({ queryKey: ['player-stats', user.id] });

      const currentStats = await getPlayerStats(user.id, activeHero.hero_id);
      const numLevels = currentLevel - startLevel;
      const statChanges: Partial<Record<PlayerStat, { from: number; to: number }>> = {};
      for (const stat of PLAYER_STATS) {
        const to = currentStats[stat].level;
        const spPerLevel = stat === primary ? 2 : 1;
        const from = Math.max(1, to - spPerLevel * numLevels);
        if (to > from) statChanges[stat] = { from, to };
      }

      console.log(`[LevelUp] hero=${activeHero.hero_id} ${startLevel}→${currentLevel} primary=${primary}`);
      setPendingLevelUp({ heroId: activeHero.hero_id, startLevel, endLevel: currentLevel, statChanges });
    })();
  }, [activeHero?.level, activeHero?.hero_id]);

  const onStatChosen = async (stat: PlayerStat, level: number) => {
    if (!user || !activeHero) return;
    const sessionId = `level_up_choice_${activeHero.hero_id}_${level}`;
    await supabase
      .from('level_up_choices')
      .upsert(
        { user_id: user.id, hero_id: activeHero.hero_id, level, chosen_stat: stat },
        { onConflict: 'user_id,hero_id,level', ignoreDuplicates: true },
      );
    await awardStatSp(user.id, activeHero.hero_id, stat, 1, 'level_up', sessionId);
    queryClient.invalidateQueries({ queryKey: ['player-stats', user.id] });
    console.log(`[LevelUp] stat choice: hero=${activeHero.hero_id} level=${level} stat=${stat}`);
  };

  return {
    pendingLevelUp,
    clearLevelUp: () => setPendingLevelUp(null),
    onStatChosen,
  };
}
