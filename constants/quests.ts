import type { PlayerStat } from './stats';

export type QuestType = 'daily' | 'weekly' | 'monthly' | 'boss';

export type QuestMetric =
  | 'steps'
  | 'workouts'           // distinct workout sessions
  | 'workoutMinutes'     // total workout minutes
  | 'runningDistance'    // miles
  | 'hikingDistance'     // miles
  | 'cyclingDistance'    // miles
  | 'swimmingDistance'   // miles
  | 'elevationFt'        // feet
  | 'streakDays'
  | 'puzzleCount'        // distinct puzzle sessions
  | 'wordleLow'          // wordle solved in ≤3 guesses
  | 'connectionsPerfect' // connections solved with 0 mistakes
  | 'activityVariety';   // distinct activity types in period

export interface StatReward {
  stat: PlayerStat;
  sp: number;
}

export interface QuestDef {
  id: string;
  title: string;
  descriptionTemplate: string;  // use {target} as a placeholder
  type: QuestType;
  metric: QuestMetric;
  target: number;
  xpReward: number;
  heroId?: string;              // undefined = available to all heroes
  statReward?: StatReward;
  daysOfWeek?: number[];        // 0=Sun, 6=Sat — if set, only eligible on those days
}

// ─── Daily ───────────────────────────────────────────────────────────────────
// Dailies award XP only.

export const DAILY_QUESTS: QuestDef[] = [
  // Global
  {
    id: 'daily_first_blood',
    title: 'First Blood',
    descriptionTemplate: 'Complete any workout today',
    type: 'daily', metric: 'workouts', target: 1,
    xpReward: 20,
  },
  {
    id: 'daily_steps_10k',
    title: '10,000 Steps',
    descriptionTemplate: 'Walk 10,000 steps today',
    type: 'daily', metric: 'steps', target: 10000,
    xpReward: 15,
  },
  {
    id: 'daily_grind',
    title: 'The Grind',
    descriptionTemplate: 'Log 30 minutes of activity',
    type: 'daily', metric: 'workoutMinutes', target: 30,
    xpReward: 20,
  },
  {
    id: 'daily_mind_sharpener',
    title: 'Mind Sharpener',
    descriptionTemplate: 'Complete any puzzle today',
    type: 'daily', metric: 'puzzleCount', target: 1,
    xpReward: 15,
  },
  {
    id: 'daily_summit_seeker',
    title: 'Summit Seeker',
    descriptionTemplate: 'Gain 500 ft of elevation',
    type: 'daily', metric: 'elevationFt', target: 500,
    xpReward: 25,
  },
  {
    id: 'daily_double_session',
    title: 'Double Session',
    descriptionTemplate: 'Log 2 workouts today',
    type: 'daily', metric: 'workouts', target: 2,
    xpReward: 30,
  },
  {
    id: 'daily_sharp_mind',
    title: 'Sharp Mind',
    descriptionTemplate: 'Solve a Wordle in 3 guesses or fewer',
    type: 'daily', metric: 'wordleLow', target: 1,
    xpReward: 20,
  },
  {
    id: 'daily_clean_sweep',
    title: 'Clean Sweep',
    descriptionTemplate: 'Solve Connections with no mistakes',
    type: 'daily', metric: 'connectionsPerfect', target: 1,
    xpReward: 20,
  },
  {
    id: 'daily_trailblazer',
    title: 'Trailblazer',
    descriptionTemplate: 'Hike {target} miles today',
    type: 'daily', metric: 'hikingDistance', target: 3,
    xpReward: 25,
    daysOfWeek: [0, 6],
  },

  // Hero-specific — XP only
  {
    id: 'daily_hercules',
    title: 'Herculean Effort',
    descriptionTemplate: 'Work out for 60 minutes today',
    type: 'daily', metric: 'workoutMinutes', target: 60,
    xpReward: 25, heroId: 'hercules',
  },
  {
    id: 'daily_atalanta',
    title: "Huntress's Pace",
    descriptionTemplate: 'Run {target} miles today',
    type: 'daily', metric: 'runningDistance', target: 3,
    xpReward: 25, heroId: 'atalanta',
  },
  {
    id: 'daily_yoshitsune',
    title: 'Disciplined Steps',
    descriptionTemplate: 'Walk 12,000 steps today',
    type: 'daily', metric: 'steps', target: 12000,
    xpReward: 20, heroId: 'yoshitsune',
  },
  {
    id: 'daily_mulan',
    title: "Soldier's Variety",
    descriptionTemplate: 'Log 2 different activity types today',
    type: 'daily', metric: 'activityVariety', target: 2,
    xpReward: 25, heroId: 'mulan',
  },
  {
    id: 'daily_cuchulainn',
    title: 'Warp Spasm',
    descriptionTemplate: 'Complete 2 workouts today',
    type: 'daily', metric: 'workouts', target: 2,
    xpReward: 25, heroId: 'cuchulainn',
  },
  {
    id: 'daily_boudicca',
    title: "Queen's Ride",
    descriptionTemplate: 'Cycle {target} miles today',
    type: 'daily', metric: 'cyclingDistance', target: 10,
    xpReward: 25, heroId: 'boudicca',
  },
];

// ─── Weekly ──────────────────────────────────────────────────────────────────
// Global quests: stat reward where the quest embodies that stat.
// Hero-specific quests: XP only (heroes already specialise in their stat).

export const WEEKLY_QUESTS: QuestDef[] = [
  // Global — with stat reward
  {
    id: 'weekly_road_warrior',
    title: 'Road Warrior',
    descriptionTemplate: 'Run {target} miles this week',
    type: 'weekly', metric: 'runningDistance', target: 15,
    xpReward: 100,
    statReward: { stat: 'endurance', sp: 1 },
  },
  {
    id: 'weekly_open_water',
    title: 'Open Water',
    descriptionTemplate: 'Swim {target} miles this week',
    type: 'weekly', metric: 'swimmingDistance', target: 3,
    xpReward: 100,
    statReward: { stat: 'endurance', sp: 1 },
  },
  {
    id: 'weekly_grind',
    title: 'Grind Week',
    descriptionTemplate: 'Work out 5 days this week',
    type: 'weekly', metric: 'workouts', target: 5,
    xpReward: 100,
    statReward: { stat: 'strength', sp: 1 },
  },
  {
    id: 'weekly_high_altitude',
    title: 'High Altitude',
    descriptionTemplate: 'Gain 2,000 ft of elevation this week',
    type: 'weekly', metric: 'elevationFt', target: 2000,
    xpReward: 100,
    statReward: { stat: 'strength', sp: 1 },
  },
  {
    id: 'weekly_brainiac',
    title: 'Brainiac',
    descriptionTemplate: 'Complete 5 puzzles this week',
    type: 'weekly', metric: 'puzzleCount', target: 5,
    xpReward: 75,
    statReward: { stat: 'intelligence', sp: 1 },
  },
  {
    id: 'weekly_variety_pack',
    title: 'Variety Pack',
    descriptionTemplate: 'Log 3 different activity types this week',
    type: 'weekly', metric: 'activityVariety', target: 3,
    xpReward: 75,
    statReward: { stat: 'dexterity', sp: 1 },
  },
  {
    id: 'weekly_wordle_ace',
    title: 'Wordle Ace',
    descriptionTemplate: 'Solve 3 Wordles in 3 guesses or fewer',
    type: 'weekly', metric: 'wordleLow', target: 3,
    xpReward: 75,
    statReward: { stat: 'intelligence', sp: 1 },
  },
  {
    id: 'weekly_perfect_mind',
    title: 'Perfect Mind',
    descriptionTemplate: 'Solve 3 Connections with no mistakes',
    type: 'weekly', metric: 'connectionsPerfect', target: 3,
    xpReward: 75,
    statReward: { stat: 'intelligence', sp: 1 },
  },
  {
    id: 'weekly_cross_trainer',
    title: 'Cross-Trainer',
    descriptionTemplate: 'Log 4 different activity types this week',
    type: 'weekly', metric: 'activityVariety', target: 4,
    xpReward: 100,
    statReward: { stat: 'dexterity', sp: 1 },
  },
  {
    id: 'weekly_lucky_streak',
    title: 'On a Roll',
    descriptionTemplate: 'Maintain a 5-day activity streak',
    type: 'weekly', metric: 'streakDays', target: 5,
    xpReward: 75,
    statReward: { stat: 'luck', sp: 1 },
  },

  // Global — XP only
  {
    id: 'weekly_velodrome',
    title: 'Velodrome',
    descriptionTemplate: 'Cycle {target} miles this week',
    type: 'weekly', metric: 'cyclingDistance', target: 40,
    xpReward: 100,
  },
  {
    id: 'weekly_endurance_mode',
    title: 'Endurance Mode',
    descriptionTemplate: 'Log 5 hours of workouts this week',
    type: 'weekly', metric: 'workoutMinutes', target: 300,
    xpReward: 100,
  },
  {
    id: 'weekly_steps',
    title: '50K Steps',
    descriptionTemplate: 'Walk 50,000 steps this week',
    type: 'weekly', metric: 'steps', target: 50000,
    xpReward: 75,
  },
  {
    id: 'weekly_trail_legs',
    title: 'Trail Legs',
    descriptionTemplate: 'Hike {target} miles this week',
    type: 'weekly', metric: 'hikingDistance', target: 12,
    xpReward: 75,
  },

  // Hero-specific — XP only
  {
    id: 'weekly_hercules',
    title: 'Six Days of Labor',
    descriptionTemplate: 'Work out 6 days this week',
    type: 'weekly', metric: 'workouts', target: 6,
    xpReward: 125, heroId: 'hercules',
  },
  {
    id: 'weekly_atalanta',
    title: 'Long Hunt',
    descriptionTemplate: 'Run {target} miles this week',
    type: 'weekly', metric: 'runningDistance', target: 25,
    xpReward: 125, heroId: 'atalanta',
  },
  {
    id: 'weekly_yoshitsune',
    title: 'Seven Days Unbroken',
    descriptionTemplate: 'Maintain a 7-day activity streak',
    type: 'weekly', metric: 'streakDays', target: 7,
    xpReward: 150, heroId: 'yoshitsune',
  },
  {
    id: 'weekly_mulan',
    title: 'All-Round Warrior',
    descriptionTemplate: 'Log 5 different activity types this week',
    type: 'weekly', metric: 'activityVariety', target: 5,
    xpReward: 125, heroId: 'mulan',
  },
  {
    id: 'weekly_cuchulainn',
    title: 'Relentless',
    descriptionTemplate: 'Complete 8 workouts this week',
    type: 'weekly', metric: 'workouts', target: 8,
    xpReward: 150, heroId: 'cuchulainn',
  },
  {
    id: 'weekly_boudicca',
    title: 'Iceni Assault',
    descriptionTemplate: 'Cycle {target} miles this week',
    type: 'weekly', metric: 'cyclingDistance', target: 75,
    xpReward: 125, heroId: 'boudicca',
  },
];

// ─── Monthly ─────────────────────────────────────────────────────────────────
// Global quests: stat reward on meaningful achievements, 1 SP each.
// Hero-specific quests: XP only.

export const MONTHLY_QUESTS: QuestDef[] = [
  // Global — with stat reward
  {
    id: 'monthly_marathon',
    title: 'Marathon Month',
    descriptionTemplate: 'Run {target} miles this month',
    type: 'monthly', metric: 'runningDistance', target: 50,
    xpReward: 400,
    statReward: { stat: 'endurance', sp: 1 },
  },
  {
    id: 'monthly_swimmer',
    title: 'The Swimmer',
    descriptionTemplate: 'Swim {target} miles this month',
    type: 'monthly', metric: 'swimmingDistance', target: 15,
    xpReward: 400,
    statReward: { stat: 'endurance', sp: 1 },
  },
  {
    id: 'monthly_long_trail',
    title: 'The Long Trail',
    descriptionTemplate: 'Hike {target} miles this month',
    type: 'monthly', metric: 'hikingDistance', target: 40,
    xpReward: 300,
    statReward: { stat: 'endurance', sp: 1 },
  },
  {
    id: 'monthly_unbreakable',
    title: 'Unbreakable',
    descriptionTemplate: 'Complete 20 workouts this month',
    type: 'monthly', metric: 'workouts', target: 20,
    xpReward: 400,
    statReward: { stat: 'strength', sp: 1 },
  },
  {
    id: 'monthly_peak_bagger',
    title: 'Peak Bagger',
    descriptionTemplate: 'Gain 6,000 ft of elevation this month',
    type: 'monthly', metric: 'elevationFt', target: 6000,
    xpReward: 350,
    statReward: { stat: 'strength', sp: 1 },
  },
  {
    id: 'monthly_scholar',
    title: 'Scholar',
    descriptionTemplate: 'Complete 20 puzzles this month',
    type: 'monthly', metric: 'puzzleCount', target: 20,
    xpReward: 250,
    statReward: { stat: 'intelligence', sp: 1 },
  },
  {
    id: 'monthly_precision_mind',
    title: 'Precision Mind',
    descriptionTemplate: 'Solve 5 Wordles in 3 guesses or fewer this month',
    type: 'monthly', metric: 'wordleLow', target: 5,
    xpReward: 250,
    statReward: { stat: 'intelligence', sp: 1 },
  },
  {
    id: 'monthly_perfectionist',
    title: 'The Perfectionist',
    descriptionTemplate: 'Solve 8 Connections with no mistakes this month',
    type: 'monthly', metric: 'connectionsPerfect', target: 8,
    xpReward: 300,
    statReward: { stat: 'intelligence', sp: 1 },
  },
  {
    id: 'monthly_renaissance',
    title: 'Renaissance Hero',
    descriptionTemplate: 'Log 5 different activity types this month',
    type: 'monthly', metric: 'activityVariety', target: 5,
    xpReward: 300,
    statReward: { stat: 'dexterity', sp: 1 },
  },
  {
    id: 'monthly_fortune_streak',
    title: "Fortune's Favor",
    descriptionTemplate: 'Maintain a 10-day activity streak this month',
    type: 'monthly', metric: 'streakDays', target: 10,
    xpReward: 300,
    statReward: { stat: 'luck', sp: 1 },
  },

  // Global — XP only
  {
    id: 'monthly_grand_tour',
    title: 'Grand Tour',
    descriptionTemplate: 'Cycle {target} miles this month',
    type: 'monthly', metric: 'cyclingDistance', target: 150,
    xpReward: 400,
  },
  {
    id: 'monthly_committed',
    title: 'Committed',
    descriptionTemplate: 'Log 1,500 minutes of activity this month',
    type: 'monthly', metric: 'workoutMinutes', target: 1500,
    xpReward: 400,
  },
  {
    id: 'monthly_active_life',
    title: 'Active Life',
    descriptionTemplate: 'Walk 200,000 steps this month',
    type: 'monthly', metric: 'steps', target: 200000,
    xpReward: 300,
  },

  // Hero-specific — XP only
  {
    id: 'monthly_hercules',
    title: 'Twelve Labors',
    descriptionTemplate: 'Log 2,000 minutes of activity this month',
    type: 'monthly', metric: 'workoutMinutes', target: 2000,
    xpReward: 500, heroId: 'hercules',
  },
  {
    id: 'monthly_atalanta',
    title: 'The Long Hunt',
    descriptionTemplate: 'Run {target} miles this month',
    type: 'monthly', metric: 'runningDistance', target: 80,
    xpReward: 500, heroId: 'atalanta',
  },
  {
    id: 'monthly_yoshitsune',
    title: "Exile's Resolve",
    descriptionTemplate: 'Maintain a 25-day activity streak',
    type: 'monthly', metric: 'streakDays', target: 25,
    xpReward: 600, heroId: 'yoshitsune',
  },
  {
    id: 'monthly_mulan',
    title: 'Legend of Hua',
    descriptionTemplate: 'Log 6 different activity types this month',
    type: 'monthly', metric: 'activityVariety', target: 6,
    xpReward: 500, heroId: 'mulan',
  },
  {
    id: 'monthly_cuchulainn',
    title: 'Battle Fury',
    descriptionTemplate: 'Complete 25 workouts this month',
    type: 'monthly', metric: 'workouts', target: 25,
    xpReward: 500, heroId: 'cuchulainn',
  },
  {
    id: 'monthly_boudicca',
    title: 'Warrior Queen',
    descriptionTemplate: 'Cycle {target} miles this month',
    type: 'monthly', metric: 'cyclingDistance', target: 200,
    xpReward: 500, heroId: 'boudicca',
  },
];

// ─── Boss Battles ─────────────────────────────────────────────────────────────
// Global bosses give 2 SP — rare, hard achievements.
// Hero-specific bosses: XP only.

export const BOSS_BATTLES: QuestDef[] = [
  // Global
  {
    id: 'boss_30day_streak',
    title: 'The Undefeated',
    descriptionTemplate: 'Achieve a 30-day activity streak',
    type: 'boss', metric: 'streakDays', target: 30,
    xpReward: 1000,
    statReward: { stat: 'luck', sp: 2 },
  },
  {
    id: 'boss_century_march',
    title: 'Century March',
    descriptionTemplate: 'Walk 100,000 steps in a week',
    type: 'boss', metric: 'steps', target: 100000,
    xpReward: 750,
    statReward: { stat: 'endurance', sp: 2 },
  },

  // Hero-specific — XP only
  {
    id: 'boss_hercules_labors',
    title: 'The Hundred Labors',
    descriptionTemplate: 'Complete 100 total workouts',
    type: 'boss', metric: 'workouts', target: 100,
    xpReward: 800, heroId: 'hercules',
  },
  {
    id: 'boss_atalanta_golden',
    title: 'The Golden Apple',
    descriptionTemplate: 'Run {target} miles total',
    type: 'boss', metric: 'runningDistance', target: 200,
    xpReward: 800, heroId: 'atalanta',
  },
  {
    id: 'boss_yoshitsune_undefeated',
    title: 'Never Defeated',
    descriptionTemplate: 'Achieve a 60-day activity streak',
    type: 'boss', metric: 'streakDays', target: 60,
    xpReward: 1500, heroId: 'yoshitsune',
  },
  {
    id: 'boss_mulan_legend',
    title: 'Legend of the North',
    descriptionTemplate: 'Log 8 different activity types total',
    type: 'boss', metric: 'activityVariety', target: 8,
    xpReward: 800, heroId: 'mulan',
  },
  {
    id: 'boss_cuchulainn_fury',
    title: 'Champion of Ulster',
    descriptionTemplate: 'Complete 200 total workouts',
    type: 'boss', metric: 'workouts', target: 200,
    xpReward: 1000, heroId: 'cuchulainn',
  },
  {
    id: 'boss_boudicca_iron',
    title: 'Iron Distance',
    descriptionTemplate: 'Cycle {target} miles total',
    type: 'boss', metric: 'cyclingDistance', target: 500,
    xpReward: 1000, heroId: 'boudicca',
  },
];
