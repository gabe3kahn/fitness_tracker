export type PlayerStat = 'strength' | 'endurance' | 'dexterity' | 'intelligence' | 'luck';

export const PLAYER_STATS: PlayerStat[] = ['strength', 'endurance', 'dexterity', 'intelligence', 'luck'];

// Activity type (from ACTIVITY_TYPE_MAP output) → which stat it trains
export const ACTIVITY_TO_STAT: Record<string, PlayerStat> = {
  run:                          'endurance',
  walk:                         'endurance',
  hike:                         'endurance',
  swim:                         'endurance',
  cycle:                        'endurance',
  functionalstrengthtraining:   'strength',
  traditionalstrengthtraining:  'strength',
  hiit:                         'strength',
  yoga:                         'dexterity',
  pilates:                      'dexterity',
  other:                        'dexterity',
  wordle:                       'intelligence',
  connections:                  'intelligence',
  mini:                         'intelligence',
  strands:                      'intelligence',
};

// 1 SP = 1 stat level for all stats. Workout/puzzle SP only accumulates toward claim thresholds
// and never directly counts here — stat levels come only from level_up, stat_bonus, and lucky_day.
export function levelFromSpForStat(_stat: PlayerStat, totalSp: number): number {
  return totalSp + 1;
}

export const LUCK_SP_PER_LUCKY_DAY = 1;
