export type HeroClass = 'warrior' | 'runner' | 'disciplined' | 'all-rounder' | 'berserker' | 'endurance';
export type HeroTier = 'novice' | 'apprentice' | 'champion' | 'legend' | 'mythic';
export type StatKey =
  | 'strengthWorkouts'
  | 'runningDistance'
  | 'streaks'
  | 'variedActivity'
  | 'hiitWorkouts'
  | 'cyclingDistance'
  | 'steps'
  | 'workoutDuration'
  | 'elevation'
  | 'hikingDistance';

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
    secondaryStat: 'elevation',
    statDistribution: { strength: 3, endurance: 2, dexterity: 1, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Lion Skin',      description: '+10% XP from strength workouts', unlocksAtLevel: 5 },
      { name: 'Twelve Labors',  description: 'Complete 12 strength sessions in a month to earn a bonus XP burst', unlocksAtLevel: 10 },
      { name: 'Nemean Roar',    description: 'Strength sessions over 60 min earn double duration XP', unlocksAtLevel: 15 },
      { name: 'Olympian Might', description: 'Strength XP bonus increased to +25%', unlocksAtLevel: 20 },
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
      { name: 'Golden Apple',    description: 'Your longest run of the month earns bonus XP', unlocksAtLevel: 10 },
      { name: 'Boar Slayer',     description: 'Runs over 6 miles earn +25% extra XP', unlocksAtLevel: 15 },
      { name: 'Argonaut Sprint', description: 'Steps XP doubled on days you also run', unlocksAtLevel: 20 },
      { name: 'Artemis Blessed', description: 'Running XP bonus increased to +25%', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'yoshitsune',
    name: 'Minamoto no Yoshitsune',
    origin: 'Japanese History',
    heroClass: 'disciplined',
    primaryStat: 'workoutDuration',
    secondaryStat: 'streaks',
    statDistribution: { strength: 1, endurance: 2, dexterity: 2, intelligence: 2, luck: 1 },
    skills: [
      { name: 'Tengu\'s Teaching', description: 'Streak bonus grows +15% per day', unlocksAtLevel: 5 },
      { name: 'Ushiwakamaru',      description: '+10% XP from all workout minutes', unlocksAtLevel: 10 },
      { name: 'Exile\'s Resolve',  description: 'Breaking your streak preserves half your streak count instead of resetting to zero', unlocksAtLevel: 15 },
      { name: 'Genpei Victor',     description: 'Streak bonus cap raised from +100% to +150%', unlocksAtLevel: 20 },
      { name: 'Never Defeated',    description: 'Reaching 7, 30, and 100-day streaks awards bonus XP bursts', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'mulan',
    name: 'Mulan',
    origin: 'Chinese Legend',
    heroClass: 'all-rounder',
    primaryStat: 'variedActivity',
    secondaryStat: 'hikingDistance',
    statDistribution: { strength: 2, endurance: 2, dexterity: 2, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Soldier\'s Resolve',  description: '+10% XP on days you log 2 or more different activities', unlocksAtLevel: 5 },
      { name: 'Northern Campaign',   description: 'Log 5 different activity types in a week to earn a bonus XP burst', unlocksAtLevel: 10 },
      { name: 'Honor the Family',    description: 'Days with 3 or more different activities earn an extra +10% XP', unlocksAtLevel: 15 },
      { name: 'Imperial Champion',   description: 'Strength and cardio on the same day triggers a combined training bonus', unlocksAtLevel: 20 },
      { name: 'Legend of Hua',       description: 'Variety bonus applies to steps XP on days you log 2 or more activities', unlocksAtLevel: 25 },
    ],
  },
  {
    id: 'cuchulainn',
    name: 'Cú Chulainn',
    origin: 'Irish Myth',
    heroClass: 'berserker',
    primaryStat: 'hiitWorkouts',
    secondaryStat: 'strengthWorkouts',
    statDistribution: { strength: 4, endurance: 1, dexterity: 1, intelligence: 1, luck: 1 },
    skills: [
      { name: 'Warp Spasm',       description: '+15% XP from HIIT workouts', unlocksAtLevel: 5 },
      { name: 'Gáe Bulg',         description: 'Runs, rides, and swims faster than your 30-day average pace earn bonus XP', unlocksAtLevel: 10 },
      { name: 'Red Branch Knight', description: 'Complete 3 HIIT sessions in a week to earn a bonus XP burst', unlocksAtLevel: 15 },
      { name: 'Riastrad',          description: 'Strength sessions in the same week as a HIIT workout earn double duration XP', unlocksAtLevel: 20 },
      { name: 'Battle Frenzy',     description: 'HIIT XP bonus increased to +35%; strength sessions also earn +20% XP', unlocksAtLevel: 25 },
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
      { name: 'Warrior Queen',   description: '+10% XP from cycling distance', unlocksAtLevel: 5 },
      { name: 'Iceni Rising',    description: 'Sessions over 60 minutes earn bonus endurance XP', unlocksAtLevel: 10 },
      { name: 'Battle Chariot',  description: 'Cycling XP bonus increased to +25%', unlocksAtLevel: 25 },
      { name: 'Roman Defiance',  description: 'Your longest cycling ride of the month earns bonus XP', unlocksAtLevel: 20 },
      { name: 'Eternal Flame',   description: 'Consecutive cycling days build a stacking daily XP multiplier', unlocksAtLevel: 25 },
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
