export type DefenseType = 'block' | 'dodge';
export type RangePreference = 'melee' | 'ranged';
export type AttackRange = 'melee' | 'ranged';
export type ActionType = 'attack' | 'rest';
export type ActionOrder = 'action-first' | 'move-first';

export interface Position {
  col: number; // 1 = enemy far side, 5 = hero far side
  row: number; // 1–5 lateral
}

export interface HeroStats {
  strength: number;
  endurance: number;
  intelligence: number;
  dexterity: number;
  luck: number;
}

export interface CombatAttributes {
  damage: number;
  maxHp: number;
  speed: number;
  maxStamina: number;
  staminaRecovery: number;
  defense: number;
  critRate: number;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  staminaCost: number;
  range: AttackRange;
  damageMultiplier: number;
  vulnerability: number; // defense penalty applied to self after using (0 = none)
}

export interface Fighter {
  id: string;
  name: string;
  side: 'hero' | 'enemy';
  stats: HeroStats;
  attributes: CombatAttributes;
  hp: number;
  stamina: number;
  momentum: number;
  position: Position;
  movement: number;          // max squares per turn (1 or 2)
  defenseType: DefenseType;
  rangePreference: RangePreference;
  staggeredNextTurn: boolean;
  vulnerability: number;     // active defense penalty from last heavy attack; resets on next action
}

// Sealed declaration — movement destination is chosen reactively during resolution
export interface Declaration {
  fighterId: string;
  priority: number;
  action: ActionType;
  actionOrder: ActionOrder;
  skill?: SkillDef;
}

export type CombatEventType =
  | 'round_start'
  | 'stamina_recovered'
  | 'move'
  | 'move_failed'
  | 'attack_hit'
  | 'attack_miss'
  | 'attack_crit'
  | 'block'
  | 'dodge_success'
  | 'dodge_fail'
  | 'rest'
  | 'momentum_surge'
  | 'momentum_stagger'
  | 'hp_lost'
  | 'fighter_defeated'
  | 'encounter_end';

export interface CombatEventDetail {
  // Accuracy
  accuracyValue?: number;
  accuracyRoll?: number;
  distance?: number;
  blockerCount?: number;
  offPreference?: boolean;
  // Crit / damage
  critRoll?: number;
  critThreshold?: number;
  critMultiplier?: number;
  skillMultiplier?: number;
  rawDamage?: number;
  // Defense
  targetVulnerability?: number;
  effectiveDefense?: number;
  blockReduction?: number;
  dodgeChance?: number;
  dodgeRoll?: number;
  finalDamage?: number;
  // Momentum
  momentumBefore?: number;
  momentumDelta?: number;
  momentumAfter?: number;
  // Movement
  fromPosition?: Position;
  toPosition?: Position;
}

export interface CombatEvent {
  type: CombatEventType;
  fighterId: string;
  targetId?: string;
  value?: number;
  message: string;
  detail?: CombatEventDetail;
}

export interface CombatState {
  hero: Fighter;
  enemies: Fighter[];
  round: number;
  log: CombatEvent[];
  isOver: boolean;
  winner?: 'hero' | 'enemies';
}

// Represents an in-progress round where movement is being resolved reactively
export interface TurnPhase {
  sortedDecls: Declaration[];
  currentIndex: number;
  state: CombatState;
  actionResolved?: boolean; // action-first: attack already fired, next call to resolveNextFighter does move only
}
