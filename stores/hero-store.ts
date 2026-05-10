import { create } from 'zustand';
import { HeroTier } from '../constants/heroes';

export interface UserHero {
  id: string;
  heroId: string;
  isActive: boolean;
  totalXp: number;
  level: number;
  tier: HeroTier;
  streakDays: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

interface HeroStore {
  heroes: UserHero[];
  activeHero: UserHero | null;
  setHeroes: (heroes: UserHero[]) => void;
  setActiveHero: (hero: UserHero | null) => void;
  updateHeroXp: (heroId: string, xpDelta: number, newLevel: number, newTier: HeroTier) => void;
}

export const useHeroStore = create<HeroStore>((set) => ({
  heroes: [],
  activeHero: null,
  setHeroes: (heroes) => set({ heroes }),
  setActiveHero: (activeHero) => set({ activeHero }),
  updateHeroXp: (heroId, xpDelta, newLevel, newTier) =>
    set((state) => ({
      heroes: state.heroes.map((h) =>
        h.heroId === heroId
          ? { ...h, totalXp: h.totalXp + xpDelta, level: newLevel, tier: newTier }
          : h
      ),
      activeHero:
        state.activeHero?.heroId === heroId
          ? { ...state.activeHero, totalXp: state.activeHero.totalXp + xpDelta, level: newLevel, tier: newTier }
          : state.activeHero,
    })),
}));
