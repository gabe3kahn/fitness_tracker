export type HeroClass = 'warrior' | 'runner' | 'disciplined' | 'all-rounder' | 'berserker' | 'endurance';
export type HeroTier = 'novice' | 'apprentice' | 'champion' | 'legend' | 'mythic';
export type StatKey = 'strengthWorkouts' | 'runningDistance' | 'streaks' | 'variedActivity' | 'hiitWorkouts' | 'cyclingDistance' | 'steps' | 'workoutDuration';

export interface StatDistribution {
  strength: number;
  endurance: number;
  dexterity: number;
  intelligence: number;
  luck: number;
}

export interface HeroSkill {
  name: string;
  description: string;
  unlocksAtLevel: number;
}

export interface HeroDef {
  id: string;
  name: string;
  origin: string;
  heroClass: HeroClass;
  primaryStat: StatKey;
  secondaryStat: StatKey;
  /** 8 points awarded per level-up, distributed across player stats. Min 1 per stat. */
  statDistribution: StatDistribution;
  skills: HeroSkill[];
}

export const HEROES: HeroDef[] = [
  {
    id: 'hercules',
    name: 'Hercules',
    origin: 'Greek Myth',
    heroClass: 'warrior',
    primaryStat: 'strengthWorkouts',
    secondaryStat: 'workoutDuration',
    statDistribution: { strength: 3, endurance: 2, dexterity: 1, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Lion Skin', description: '+10% XP from all strength workouts', unlocksAtLevel: 5 },
      { name: 'Twelve Labors', description: 'Bonus XP for completing 12 workouts in a week', unlocksAtLevel: 10 },
      { name: 'Olympian Might', description: 'Strength workout XP bonus increased to +20%', unlocksAtLevel: 15 },
      { name: 'Nemean Roar', description: 'Daily streak bonus doubled', unlocksAtLevel: 20 },
      { name: 'Divine Lineage', description: '+5% XP from all sources permanently', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'atalanta',
    name: 'Atalanta',
    origin: 'Greek Myth',
    heroClass: 'runner',
    primaryStat: 'runningDistance',
    secondaryStat: 'steps',
    statDistribution: { strength: 1, endurance: 4, dexterity: 1, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Huntress Stride', description: '+10% XP from running distance', unlocksAtLevel: 5 },
      { name: 'Golden Apple', description: 'Bonus XP for personal distance records', unlocksAtLevel: 10 },
      { name: 'Boar Slayer', description: 'Long run bonus: extra XP for runs over 6 mi', unlocksAtLevel: 15 },
      { name: 'Argonaut Sprint', description: '+15% XP from steps on active days', unlocksAtLevel: 20 },
      { name: 'Artemis Blessed', description: 'Running XP bonus increased to +25%', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'yoshitsune',
    name: 'Minamoto no Yoshitsune',
    origin: 'Japanese History',
    heroClass: 'disciplined',
    primaryStat: 'streaks',
    secondaryStat: 'workoutDuration',
    statDistribution: { strength: 1, endurance: 2, dexterity: 2, intelligence: 2, luck: 1 },
    skills: [
      { name: 'Tengu\'s Teaching', description: 'Streak bonus starts earlier (day 2 instead of day 3)', unlocksAtLevel: 5 },
      { name: 'Ushiwakamaru', description: '+10% XP from all workout minutes', unlocksAtLevel: 10 },
      { name: 'Exile\'s Resolve', description: 'Streak recovery: half streak preserved after a missed day', unlocksAtLevel: 15 },
      { name: 'Genpei Victor', description: 'Streak cap raised: bonus maxes at +150% instead of +100%', unlocksAtLevel: 20 },
      { name: 'Never Defeated', description: 'Streak milestones award bonus XP bursts', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'mulan',
    name: 'Mulan',
    origin: 'Chinese Legend',
    heroClass: 'all-rounder',
    primaryStat: 'variedActivity',
    secondaryStat: 'workoutDuration',
    statDistribution: { strength: 2, endurance: 2, dexterity: 2, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Soldier\'s Resolve', description: '+10% XP when 3+ different activity types logged in a day', unlocksAtLevel: 5 },
      { name: 'Northern Campaign', description: 'Bonus XP for logging 5 different activity types in a week', unlocksAtLevel: 10 },
      { name: 'Honor the Family', description: '+15% XP on days with 3+ different activity types', unlocksAtLevel: 15 },
      { name: 'Imperial Champion', description: 'All-activity days grant a daily XP multiplier', unlocksAtLevel: 20 },
      { name: 'Legend of Hua', description: '+5% XP per unique activity type logged in a week', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'cuchulainn',
    name: 'Cú Chulainn',
    origin: 'Irish Myth',
    heroClass: 'berserker',
    primaryStat: 'hiitWorkouts',
    secondaryStat: 'workoutDuration',
    statDistribution: { strength: 4, endurance: 1, dexterity: 1, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Warp Spasm', description: '+15% XP from high-intensity workouts', unlocksAtLevel: 5 },
      { name: 'Gáe Bulg', description: 'Bonus XP for reaching max heart rate zone', unlocksAtLevel: 10 },
      { name: 'Red Branch Knight', description: 'HIIT streak bonus: 3 HIIT sessions in a week gives XP burst', unlocksAtLevel: 15 },
      { name: 'Champion\'s Light', description: 'Heart rate zone XP bonus increased to +20%', unlocksAtLevel: 20 },
      { name: 'Battle Frenzy', description: 'HIIT XP bonus increased to +30%', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'boudicca',
    name: 'Boudicca',
    origin: 'British History',
    heroClass: 'endurance',
    primaryStat: 'cyclingDistance',
    secondaryStat: 'workoutDuration',
    statDistribution: { strength: 1, endurance: 4, dexterity: 1, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Warrior Queen', description: '+10% XP from cycling and cardio distance', unlocksAtLevel: 5 },
      { name: 'Iceni Rising', description: 'Long session bonus: extra XP for workouts over 60 minutes', unlocksAtLevel: 10 },
      { name: 'Battle Chariot', description: '+15% XP from workout duration', unlocksAtLevel: 15 },
      { name: 'Roman Defiance', description: 'Endurance milestone XP bursts for distance records', unlocksAtLevel: 20 },
      { name: 'Eternal Flame', description: 'Duration XP bonus increased to +25%', unlocksAtLevel: 25 },
    ],
  },
];

export const TIER_LEVELS: Record<HeroTier, { min: number; max: number | null }> = {
  novice:     { min: 1,  max: 9  },
  apprentice: { min: 10, max: 24 },
  champion:   { min: 25, max: 39 },
  legend:     { min: 40, max: 59 },
  mythic:     { min: 60, max: null },
};

export function getTierForLevel(level: number): HeroTier {
  for (const [tier, range] of Object.entries(TIER_LEVELS) as [HeroTier, typeof TIER_LEVELS[HeroTier]][]) {
    if (level >= range.min && (range.max === null || level <= range.max)) return tier;
  }
  return 'novice';
}
