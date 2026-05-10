export type QuestType = 'daily' | 'weekly' | 'epic' | 'boss';
export type QuestMetric = 'steps' | 'activeMinutes' | 'workouts' | 'caloriesBurned' | 'runningDistance' | 'cyclingDistance' | 'streakDays' | 'elevationFt';

export interface QuestDef {
  id: string;
  title: string;
  /** Use {target} as a placeholder — resolved to the correct unit at display time */
  descriptionTemplate: string;
  type: QuestType;
  metric: QuestMetric;
  /** Always stored in metric base units (km for distance, m for elevation) */
  target: number;
  xpReward: number;
  heroId?: string;
}

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: 'daily_steps_5k',
    title: 'Morning Warrior',
    descriptionTemplate: 'Walk 5,000 steps today',
    type: 'daily',
    metric: 'steps',
    target: 5000,
    xpReward: 50,
  },
  {
    id: 'daily_active_20',
    title: 'Stay Active',
    descriptionTemplate: 'Log 20 active minutes',
    type: 'daily',
    metric: 'activeMinutes',
    target: 20,
    xpReward: 40,
  },
  {
    id: 'daily_workout',
    title: 'First Blood',
    descriptionTemplate: 'Complete any workout',
    type: 'daily',
    metric: 'workouts',
    target: 1,
    xpReward: 75,
  },
];

export const WEEKLY_QUESTS: QuestDef[] = [
  {
    id: 'weekly_run_15k',
    title: 'Road to Glory',
    descriptionTemplate: 'Run {target} this week',
    type: 'weekly',
    metric: 'runningDistance',
    target: 15,
    xpReward: 200,
  },
  {
    id: 'weekly_streak_5',
    title: 'Iron Will',
    descriptionTemplate: 'Maintain a 5-day activity streak',
    type: 'weekly',
    metric: 'streakDays',
    target: 5,
    xpReward: 150,
  },
  {
    id: 'weekly_calories_2500',
    title: 'Furnace',
    descriptionTemplate: 'Burn 2,500 active calories this week',
    type: 'weekly',
    metric: 'caloriesBurned',
    target: 2500,
    xpReward: 175,
  },
];

export const BOSS_BATTLES: QuestDef[] = [
  {
    id: 'boss_first_10k_run',
    title: 'Defeat the Nemean Lion',
    descriptionTemplate: 'Complete your first {target} run',
    type: 'boss',
    metric: 'runningDistance',
    target: 10,
    xpReward: 500,
    heroId: 'hercules',
  },
  {
    id: 'boss_30day_streak',
    title: 'The Undefeated',
    descriptionTemplate: 'Achieve a 30-day activity streak',
    type: 'boss',
    metric: 'streakDays',
    target: 30,
    xpReward: 1000,
  },
  {
    id: 'boss_100k_steps',
    title: 'Century March',
    descriptionTemplate: 'Walk 100,000 steps in a week',
    type: 'boss',
    metric: 'steps',
    target: 100000,
    xpReward: 750,
  },
  {
    id: 'boss_cycle_100k',
    title: 'Iron Distance',
    descriptionTemplate: 'Cycle {target} in a week',
    type: 'boss',
    metric: 'cyclingDistance',
    target: 100,
    xpReward: 600,
    heroId: 'boudicca',
  },
  {
    id: 'boss_100_workouts',
    title: 'Ten Thousand Blows',
    descriptionTemplate: 'Complete 100 total workouts',
    type: 'boss',
    metric: 'workouts',
    target: 100,
    xpReward: 800,
  },
];
