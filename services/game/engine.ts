import { HEROES } from '../../constants/heroes';
import type {
  HeroStats, CombatAttributes, Fighter, SkillDef,
  Declaration, CombatState, CombatEvent, AttackRange,
  CombatEventDetail, Position, TurnPhase,
} from './types';

// ─── Attribute derivation ─────────────────────────────────────────────────────

const WEIGHTS = {
  damage:          { strength: 0.65, intelligence: 0.35 },
  maxHp:           { endurance: 0.55, strength: 0.45 },
  speed:           { dexterity: 0.65, endurance: 0.35 },
  maxStamina:      { endurance: 0.70, strength: 0.30 },
  staminaRecovery: { intelligence: 1.00 },
  defense:         { intelligence: 0.40, dexterity: 0.30, luck: 0.30 },
  critRate:        { luck: 0.70, dexterity: 0.30 },
} as const;

const SCALE = {
  damage:          2,
  maxHp:           10,
  speed:           1,
  maxStamina:      5,
  staminaRecovery: 0.5,
  defense:         1,
  critRate:        0.01,
} as const;

function weightedSum(stats: HeroStats, weights: Partial<Record<keyof HeroStats, number>>): number {
  return (Object.entries(weights) as [keyof HeroStats, number][])
    .reduce((sum, [stat, w]) => sum + stats[stat] * w, 0);
}

export function deriveAttributes(stats: HeroStats): CombatAttributes {
  return {
    damage:          weightedSum(stats, WEIGHTS.damage)          * SCALE.damage,
    maxHp:           weightedSum(stats, WEIGHTS.maxHp)           * SCALE.maxHp,
    speed:           weightedSum(stats, WEIGHTS.speed)           * SCALE.speed,
    maxStamina:      weightedSum(stats, WEIGHTS.maxStamina)      * SCALE.maxStamina,
    staminaRecovery: weightedSum(stats, WEIGHTS.staminaRecovery) * SCALE.staminaRecovery,
    defense:         weightedSum(stats, WEIGHTS.defense)         * SCALE.defense,
    critRate:        Math.min(weightedSum(stats, WEIGHTS.critRate) * SCALE.critRate, 0.75),
  };
}

// ─── Hero combat config ───────────────────────────────────────────────────────

const HERO_COMBAT_CONFIG: Record<string, {
  defenseType: 'block' | 'dodge';
  rangePreference: 'melee' | 'ranged';
  movement: 1 | 2;
}> = {
  hercules:   { defenseType: 'block', rangePreference: 'melee',  movement: 1 },
  atalanta:   { defenseType: 'dodge', rangePreference: 'ranged', movement: 2 },
  yoshitsune: { defenseType: 'dodge', rangePreference: 'melee',  movement: 2 },
  mulan:      { defenseType: 'block', rangePreference: 'ranged', movement: 1 },
  cuchulainn: { defenseType: 'block', rangePreference: 'melee',  movement: 2 },
  boudicca:   { defenseType: 'block', rangePreference: 'melee',  movement: 1 },
};

// ─── Hero skills ──────────────────────────────────────────────────────────────
// vulnerability: 0 = no penalty, 1 = moderate, 2 = heavy, 3 = extreme

const HERO_SKILLS: Record<string, SkillDef> = {
  hercules:   { id: 'mighty_blow',   name: 'Mighty Blow',   description: '2× melee strike, leaves you exposed',        staminaCost: 15, range: 'melee',  damageMultiplier: 2.0, vulnerability: 2 },
  atalanta:   { id: 'piercing_shot', name: 'Piercing Shot', description: '1.8× ranged, best at distance',               staminaCost: 12, range: 'ranged', damageMultiplier: 1.8, vulnerability: 1 },
  yoshitsune: { id: 'blade_dance',   name: 'Blade Dance',   description: 'Quick 1.5× strike, stays defensive',          staminaCost:  8, range: 'melee',  damageMultiplier: 1.5, vulnerability: 0 },
  mulan:      { id: 'tactical_shot', name: 'Tactical Shot', description: '1.6× ranged, steady and controlled',          staminaCost: 10, range: 'ranged', damageMultiplier: 1.6, vulnerability: 1 },
  cuchulainn: { id: 'warp_spasm',    name: 'Warp Spasm',    description: '2.5× berserker strike, very exposed after',   staminaCost: 18, range: 'melee',  damageMultiplier: 2.5, vulnerability: 3 },
  boudicca:   { id: 'shield_charge', name: 'Shield Charge', description: '1.4× melee push, stays well-protected',       staminaCost: 10, range: 'melee',  damageMultiplier: 1.4, vulnerability: 0 },
};

export function getHeroSkill(heroId: string): SkillDef | undefined {
  return HERO_SKILLS[heroId];
}

// ─── Fighter construction ─────────────────────────────────────────────────────

export function buildHeroAtLevel(heroId: string, level: number, startPosition: Position = { col: 5, row: 3 }): Fighter {
  const heroDef = HEROES.find(h => h.id === heroId);
  if (!heroDef) throw new Error(`Unknown hero: ${heroId}`);
  const levelUps = Math.max(0, level - 1);
  const stats: HeroStats = {
    strength:     heroDef.statDistribution.strength     * levelUps,
    endurance:    heroDef.statDistribution.endurance    * levelUps,
    intelligence: heroDef.statDistribution.intelligence * levelUps,
    dexterity:    heroDef.statDistribution.dexterity    * levelUps,
    luck:         heroDef.statDistribution.luck         * levelUps,
  };
  const attributes = deriveAttributes(stats);
  const config = HERO_COMBAT_CONFIG[heroId] ?? { defenseType: 'block' as const, rangePreference: 'melee' as const, movement: 1 as const };
  return {
    id: heroId,
    name: heroDef.name,
    side: 'hero',
    stats,
    attributes,
    hp: attributes.maxHp,
    stamina: attributes.maxStamina,
    momentum: 0,
    position: startPosition,
    movement: config.movement,
    defenseType: config.defenseType,
    rangePreference: config.rangePreference,
    staggeredNextTurn: false,
    vulnerability: 0,
  };
}

export function buildTestEnemy(overrides: Partial<Fighter> = {}): Fighter {
  const stats: HeroStats = { strength: 8, endurance: 8, intelligence: 4, dexterity: 4, luck: 4 };
  const attributes = deriveAttributes(stats);
  return {
    id: 'enemy_1',
    name: 'Guard',
    side: 'enemy',
    stats,
    attributes,
    hp: attributes.maxHp,
    stamina: attributes.maxStamina,
    momentum: 0,
    position: { col: 2, row: 3 },
    movement: 1,
    defenseType: 'block',
    rangePreference: 'melee',
    staggeredNextTurn: false,
    vulnerability: 0,
    ...overrides,
  };
}

export function createEncounter(hero: Fighter, enemies: Fighter[]): CombatState {
  return { hero, enemies, round: 0, log: [], isOver: false };
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────

export function dist(a: Position, b: Position): number {
  return Math.sqrt((a.col - b.col) ** 2 + (a.row - b.row) ** 2);
}

function allFighters(state: CombatState): Fighter[] {
  return [state.hero, ...state.enemies];
}

function getLivingFighters(state: CombatState): Fighter[] {
  return allFighters(state).filter(f => f.hp > 0);
}

function getLivingEnemies(state: CombatState): Fighter[] {
  return state.enemies.filter(e => e.hp > 0);
}

// ZoC: each enemy adjacent to fighter (Chebyshev ≤ 1, i.e. all 8 neighbours)
// reduces movement by 1, minimum 1.
export function getMovementAllowance(fighter: Fighter, state: CombatState): number {
  if (fighter.staggeredNextTurn) return 0;
  const opponents = fighter.side === 'hero' ? getLivingEnemies(state) : [state.hero].filter(f => f.hp > 0);
  const adjacentEnemies = opponents.filter(e => {
    const dc = Math.abs(e.position.col - fighter.position.col);
    const dr = Math.abs(e.position.row - fighter.position.row);
    return dc <= 1 && dr <= 1 && !(dc === 0 && dr === 0);
  }).length;
  return Math.max(1, fighter.movement - adjacentEnemies);
}

// All squares reachable via cardinal moves within allowance, not occupied by others.
export function getValidMoves(fighter: Fighter, state: CombatState): Position[] {
  const allowance = getMovementAllowance(fighter, state);
  const occupied = new Set(
    getLivingFighters(state)
      .filter(f => f.id !== fighter.id)
      .map(f => `${f.position.col},${f.position.row}`)
  );

  // BFS with cardinal steps only
  const visited = new Set<string>();
  const result: Position[] = [];
  const queue: Array<{ pos: Position; steps: number }> = [{ pos: fighter.position, steps: 0 }];
  visited.add(`${fighter.position.col},${fighter.position.row}`);

  while (queue.length > 0) {
    const { pos, steps } = queue.shift()!;
    if (steps > 0) result.push(pos); // include current position as "stay" separately
    if (steps >= allowance) continue;
    for (const [dc, dr] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const next: Position = { col: pos.col + dc, row: pos.row + dr };
      const key = `${next.col},${next.row}`;
      if (next.col < 1 || next.col > 5 || next.row < 1 || next.row > 5) continue;
      if (occupied.has(key)) continue;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ pos: next, steps: steps + 1 });
    }
  }

  // Always include staying in place
  result.unshift(fighter.position);
  return result;
}

// ─── Accuracy ─────────────────────────────────────────────────────────────────

const MELEE_MAX_RANGE    = 1.5;
const MELEE_BASE_ACC     = 0.80;
const RANGED_PEAK_ACC    = 0.90;
const RANGED_OPTIMAL     = 3.0;
const RANGED_CLOSE_THRESH = 1.5;  // below this, penalty ramps up
const RANGED_CLOSE_SLOPE  = 0.40; // (peak_at_thresh - base_at_0) / thresh
const RANGED_FAR_RATE     = 0.09; // accuracy lost per unit distance past optimal
const BLOCKER_PENALTY     = 0.15;
const OFF_PREF_PENALTY    = 0.15;

function rangedBaseAccuracy(d: number): number {
  if (d < RANGED_CLOSE_THRESH) {
    return 0.30 + RANGED_CLOSE_SLOPE * (d / RANGED_CLOSE_THRESH);
  }
  if (d <= RANGED_OPTIMAL) {
    return 0.70 + 0.20 * ((d - RANGED_CLOSE_THRESH) / (RANGED_OPTIMAL - RANGED_CLOSE_THRESH));
  }
  return Math.max(0.05, RANGED_PEAK_ACC - RANGED_FAR_RATE * (d - RANGED_OPTIMAL));
}

// Returns number of living fighters whose square center is within 0.5 units of
// the line segment from attacker to target (excluding attacker and target).
function getBlockerCount(attacker: Fighter, target: Fighter, state: CombatState): number {
  const ax = attacker.position.col, ay = attacker.position.row;
  const bx = target.position.col,  by = target.position.row;
  const lenSq = (bx - ax) ** 2 + (by - ay) ** 2;
  if (lenSq === 0) return 0;

  return getLivingFighters(state).filter(f => {
    if (f.id === attacker.id || f.id === target.id) return false;
    const px = f.position.col, py = f.position.row;
    // Project f onto the line segment; check perpendicular distance ≤ 0.5
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lenSq));
    const nearX = ax + t * (bx - ax);
    const nearY = ay + t * (by - ay);
    return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2) <= 0.5;
  }).length;
}

export function calculateAccuracy(
  attacker: Fighter,
  target: Fighter,
  range: AttackRange,
  state: CombatState,
  offPreference = false,
): number {
  const d = dist(attacker.position, target.position);

  if (range === 'melee') {
    if (d > MELEE_MAX_RANGE) return 0;
    const penalty = offPreference ? OFF_PREF_PENALTY : 0;
    return Math.max(0.05, Math.min(0.95, MELEE_BASE_ACC - penalty));
  }

  // Ranged
  const blockers = getBlockerCount(attacker, target, state);
  const base = rangedBaseAccuracy(d);
  const penalty = blockers * BLOCKER_PENALTY + (offPreference ? OFF_PREF_PENALTY : 0);
  return Math.max(0.05, Math.min(0.95, base - penalty));
}

// ─── Internal state helpers ───────────────────────────────────────────────────

function cloneState(state: CombatState): CombatState {
  return {
    ...state,
    hero: { ...state.hero },
    enemies: state.enemies.map(e => ({ ...e })),
    log: [...state.log],
  };
}

function getMutableFighter(id: string, state: CombatState): Fighter | undefined {
  if (state.hero.id === id) return state.hero;
  return state.enemies.find(e => e.id === id);
}

function emit(state: CombatState, event: CombatEvent): void {
  state.log.push(event);
}

// ─── Momentum ─────────────────────────────────────────────────────────────────

const SURGE_THRESHOLD   =  3;
const STAGGER_THRESHOLD = -3;

function applyMomentumDelta(fighter: Fighter, delta: number, state: CombatState): { surged: boolean } {
  const before = fighter.momentum;
  fighter.momentum += delta;
  const detail: CombatEventDetail = { momentumBefore: before, momentumDelta: delta, momentumAfter: fighter.momentum };

  if (fighter.momentum <= STAGGER_THRESHOLD) {
    fighter.momentum = 0;
    fighter.staggeredNextTurn = true;
    emit(state, { type: 'momentum_stagger', fighterId: fighter.id, message: `${fighter.name} is staggered — movement lost next turn.`, detail: { ...detail, momentumAfter: 0 } });
    return { surged: false };
  }
  if (fighter.momentum >= SURGE_THRESHOLD) {
    fighter.momentum -= SURGE_THRESHOLD;
    emit(state, { type: 'momentum_surge', fighterId: fighter.id, message: `${fighter.name} surges! Bonus attack triggered.`, detail: { ...detail, momentumAfter: fighter.momentum } });
    return { surged: true };
  }
  return { surged: false };
}

// ─── Attack resolution ────────────────────────────────────────────────────────

function resolveAttackOnTarget(
  attacker: Fighter,
  target: Fighter,
  skill: SkillDef | undefined,
  state: CombatState,
): { surged: boolean } {
  const range = skill?.range ?? attacker.rangePreference;
  const offPref = skill != null && skill.range !== attacker.rangePreference;
  const accuracy = calculateAccuracy(attacker, target, range, state, offPref);
  const distance = dist(attacker.position, target.position);
  const blockerCount = getBlockerCount(attacker, target, state);

  const accuracyRoll = Math.random();
  if (accuracyRoll >= accuracy) {
    applyMomentumDelta(attacker, -1, state);
    emit(state, {
      type: 'attack_miss', fighterId: attacker.id, targetId: target.id,
      message: `${attacker.name} misses ${target.name}.`,
      detail: { accuracyValue: accuracy, accuracyRoll, distance, blockerCount, offPreference: offPref },
    });
    return { surged: false };
  }

  const critThreshold = attacker.attributes.critRate;
  const critRoll = Math.random();
  const isCrit = critRoll < critThreshold;
  const skillMultiplier = skill?.damageMultiplier ?? 1;
  const critMultiplier = isCrit ? 2 : 1;
  const rawDamage = attacker.attributes.damage * skillMultiplier * critMultiplier;

  emit(state, {
    type: isCrit ? 'attack_crit' : 'attack_hit', fighterId: attacker.id, targetId: target.id,
    message: isCrit ? `${attacker.name} lands a critical hit on ${target.name}!` : `${attacker.name} hits ${target.name}.`,
    detail: { accuracyValue: accuracy, accuracyRoll, distance, blockerCount, offPreference: offPref, critRoll, critThreshold, critMultiplier, skillMultiplier, rawDamage },
  });

  // Defense is always passive — block reduces damage, dodge attempts all-or-nothing.
  // Effective defense is reduced by the target's active vulnerability from their last heavy attack.
  const effectiveDefense = target.attributes.defense * Math.max(0, 1 - 0.15 * target.vulnerability);
  let damageTaken = rawDamage;

  if (target.defenseType === 'block') {
    const blockReduction = effectiveDefense * 0.5;
    damageTaken = Math.max(0, rawDamage - blockReduction);
    emit(state, {
      type: 'block', fighterId: target.id, value: Math.round(blockReduction),
      message: `${target.name} blocks ${Math.round(blockReduction)} damage.`,
      detail: { rawDamage, blockReduction, finalDamage: damageTaken, targetVulnerability: target.vulnerability, effectiveDefense },
    });
  } else {
    const dodgeChance = effectiveDefense / (effectiveDefense + 30);
    const dodgeRoll = Math.random();
    if (dodgeRoll < dodgeChance) {
      applyMomentumDelta(target, 1, state);
      applyMomentumDelta(attacker, -1, state);
      emit(state, {
        type: 'dodge_success', fighterId: target.id,
        message: `${target.name} dodges the attack!`,
        detail: { dodgeChance, dodgeRoll, rawDamage, finalDamage: 0, targetVulnerability: target.vulnerability, effectiveDefense },
      });
      return { surged: false };
    }
    emit(state, {
      type: 'dodge_fail', fighterId: target.id,
      message: `${target.name} fails to dodge.`,
      detail: { dodgeChance, dodgeRoll, rawDamage, targetVulnerability: target.vulnerability, effectiveDefense },
    });
  }

  damageTaken = Math.round(damageTaken);
  target.hp = Math.max(0, target.hp - damageTaken);
  const { surged } = applyMomentumDelta(attacker, 1, state);

  emit(state, {
    type: 'hp_lost', fighterId: target.id, targetId: attacker.id, value: damageTaken,
    message: `${target.name} takes ${damageTaken} damage (${Math.round(target.hp)}/${Math.round(target.attributes.maxHp)} HP).`,
    detail: { rawDamage, finalDamage: damageTaken },
  });

  if (target.hp <= 0) {
    emit(state, { type: 'fighter_defeated', fighterId: target.id, message: `${target.name} is defeated!` });
  }

  return { surged };
}

// ─── Movement resolution ──────────────────────────────────────────────────────

function resolveMove(fighter: Fighter, destination: Position, state: CombatState): void {
  const from = { ...fighter.position };
  if (destination.col === from.col && destination.row === from.row) return;

  const valid = getValidMoves(fighter, state);
  const isValid = valid.some(p => p.col === destination.col && p.row === destination.row);
  if (!isValid) {
    applyMomentumDelta(fighter, -1, state);
    emit(state, { type: 'move_failed', fighterId: fighter.id, message: `${fighter.name}'s move is blocked.`, detail: { fromPosition: from, toPosition: destination } });
    return;
  }

  const d = dist(from, destination);
  fighter.position = destination;
  // Forward (toward opponent) = +1 momentum, backward = -1
  const movingTowardEnemy = fighter.side === 'hero'
    ? destination.col < from.col
    : destination.col > from.col;
  applyMomentumDelta(fighter, movingTowardEnemy ? 1 : -1, state);
  emit(state, { type: 'move', fighterId: fighter.id, value: Math.round(d * 10) / 10, message: `${fighter.name} moves to (${destination.col},${destination.row}).`, detail: { fromPosition: from, toPosition: destination } });
}

// ─── Action resolution ────────────────────────────────────────────────────────

function executeAction(fighter: Fighter, decl: Declaration, state: CombatState): void {
  if (decl.action === 'rest') {
    const burst = Math.max(Math.round(fighter.attributes.maxStamina * 0.3), 5);
    const actual = Math.min(burst, fighter.attributes.maxStamina - fighter.stamina);
    fighter.stamina += actual;
    emit(state, { type: 'rest', fighterId: fighter.id, value: actual, message: `${fighter.name} rests, recovering ${actual} stamina (${Math.round(fighter.stamina)}/${Math.round(fighter.attributes.maxStamina)}).` });
    return;
  }

  const targetId = fighter.side === 'enemy' ? state.hero.id : getLivingEnemies(state)[0]?.id;
  const target = targetId ? getMutableFighter(targetId, state) : undefined;
  if (!target || target.hp <= 0) return;

  const skill = decl.skill;
  const useSkill = skill != null && fighter.stamina >= skill.staminaCost ? skill : undefined;
  if (skill && !useSkill) {
    emit(state, { type: 'attack_miss', fighterId: fighter.id, message: `${fighter.name} lacks stamina for ${skill.name} — basic attack instead.` });
  }
  if (useSkill) fighter.stamina -= useSkill.staminaCost;

  const { surged } = resolveAttackOnTarget(fighter, target, useSkill, state);
  fighter.vulnerability = useSkill?.vulnerability ?? 0;

  if (surged && target.hp > 0) {
    resolveAttackOnTarget(fighter, target, undefined, state);
  }
}

function resolveAction(
  fighter: Fighter,
  decl: Declaration,
  destination: Position,
  state: CombatState,
): void {
  fighter.vulnerability = 0;
  if (decl.actionOrder === 'action-first') {
    executeAction(fighter, decl, state);
    resolveMove(fighter, destination, state);
  } else {
    resolveMove(fighter, destination, state);
    executeAction(fighter, decl, state);
  }
  fighter.staggeredNextTurn = false; // consume stagger — move was already restricted above
}

// ─── Phased turn resolution API ───────────────────────────────────────────────
// Movement is reactive: each fighter chooses their destination when their turn
// arrives (they can see the current board state). The caller drives resolution
// one fighter at a time by calling resolveNextFighter with the chosen destination.

function sortDeclarations(decls: Declaration[], state: CombatState): { sorted: Declaration[]; rngBroken: Set<string> } {
  const rngBroken = new Set<string>();
  const sorted = [...decls].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const fa = getMutableFighter(a.fighterId, state);
    const fb = getMutableFighter(b.fighterId, state);
    const speedDiff = (fb?.attributes.speed ?? 0) - (fa?.attributes.speed ?? 0);
    if (speedDiff !== 0) return speedDiff;
    // Random tiebreaker — mark both fighters
    rngBroken.add(a.fighterId);
    rngBroken.add(b.fighterId);
    return Math.random() - 0.5;
  });
  return { sorted, rngBroken };
}

export function beginTurn(declarations: Declaration[], state: CombatState): TurnPhase {
  const s = cloneState(state);
  s.round += 1;
  emit(s, { type: 'round_start', fighterId: '', message: `── Round ${s.round} ──` });

  for (const f of getLivingFighters(s)) {
    const recovery = Math.floor(f.attributes.staminaRecovery);
    if (recovery > 0 && f.stamina < f.attributes.maxStamina) {
      const actual = Math.min(recovery, f.attributes.maxStamina - f.stamina);
      f.stamina += actual;
      emit(s, { type: 'stamina_recovered', fighterId: f.id, value: actual, message: `${f.name} recovers ${actual} stamina (${Math.round(f.stamina)}/${Math.round(f.attributes.maxStamina)}).` });
    }
  }

  const { sorted: sortedDecls, rngBroken } = sortDeclarations(declarations, s);

  const orderStr = sortedDecls.map((d, i) => {
    const f = getMutableFighter(d.fighterId, s);
    const tieNote = rngBroken.has(d.fighterId) ? ' rng' : '';
    return `${i + 1}. ${f?.name ?? d.fighterId} (P${d.priority} spd${Math.round(f?.attributes.speed ?? 0)}${tieNote}) — ${d.action} ${d.actionOrder}${d.skill ? ` [${d.skill.name}]` : ''}`;
  }).join('  ·  ');
  emit(s, { type: 'round_start', fighterId: '', message: `Order: ${orderStr}` });

  return { sortedDecls, currentIndex: 0, state: s };
}

// Returns new CombatState references safe to pass to React setState.
export function snapshotState(state: CombatState): CombatState {
  return {
    ...state,
    hero: { ...state.hero },
    enemies: state.enemies.map(e => ({ ...e })),
    log: [...state.log],
  };
}

// For action-first: resolves just the attack for the current fighter.
// Returns an updated TurnPhase with actionResolved=true; the caller then asks
// for a move destination before calling resolveNextFighter.
export function resolveActionBeforeMove(phase: TurnPhase): TurnPhase {
  const { sortedDecls, state } = phase;
  let idx = phase.currentIndex;
  while (idx < sortedDecls.length) {
    const f = getMutableFighter(sortedDecls[idx].fighterId, state);
    if (f && f.hp > 0) break;
    idx++;
  }
  if (idx >= sortedDecls.length) return phase;

  const decl = sortedDecls[idx];
  const fighter = getMutableFighter(decl.fighterId, state)!;
  fighter.vulnerability = 0;
  executeAction(fighter, decl, state);

  return { ...phase, currentIndex: idx, actionResolved: true };
}

// Call with the current fighter's chosen destination.
// Returns the next TurnPhase (more fighters to resolve) or a final CombatState (round done).
export function resolveNextFighter(phase: TurnPhase, destination: Position): TurnPhase | CombatState {
  const { sortedDecls, currentIndex, state } = phase;

  // Skip defeated fighters
  let idx = currentIndex;
  while (idx < sortedDecls.length) {
    const f = getMutableFighter(sortedDecls[idx].fighterId, state);
    if (f && f.hp > 0) break;
    idx++;
  }

  if (idx >= sortedDecls.length) return finishRound(state);

  const decl = sortedDecls[idx];
  const fighter = getMutableFighter(decl.fighterId, state)!;

  if (phase.actionResolved) {
    // action-first: attack already fired, just do the move
    resolveMove(fighter, destination, state);
    fighter.staggeredNextTurn = false; // consume stagger after move attempt
  } else {
    resolveAction(fighter, decl, destination, state);
  }

  const nextIdx = idx + 1;
  let nextActive = nextIdx;
  while (nextActive < sortedDecls.length) {
    const f = getMutableFighter(sortedDecls[nextActive].fighterId, state);
    if (f && f.hp > 0) break;
    nextActive++;
  }

  if (nextActive >= sortedDecls.length || state.isOver) return finishRound(state);

  return { ...phase, currentIndex: nextActive, state, actionResolved: false };
}

function finishRound(state: CombatState): CombatState {
  const heroDefeated = state.hero.hp <= 0;
  const allEnemiesDefeated = state.enemies.every(e => e.hp <= 0);
  if ((heroDefeated || allEnemiesDefeated) && !state.isOver) {
    state.isOver = true;
    state.winner = heroDefeated ? 'enemies' : 'hero';
    emit(state, { type: 'encounter_end', fighterId: '', message: heroDefeated ? 'Hero defeated.' : 'Victory! All enemies defeated.' });
  }
  // Deep-clone all nested references so the React Compiler's automatic
  // memoization sees new identities and re-renders fighter cards / log.
  return {
    ...state,
    hero: { ...state.hero },
    enemies: state.enemies.map(e => ({ ...e })),
    log: [...state.log],
  };
}

// ─── AI helpers ───────────────────────────────────────────────────────────────

export function computeAIDestination(fighter: Fighter, state: CombatState): Position {
  const target = fighter.side === 'enemy' ? state.hero : getLivingEnemies(state)[0];
  if (!target) return fighter.position;

  const validMoves = getValidMoves(fighter, state);
  if (validMoves.length === 0) return fighter.position;

  if (fighter.rangePreference === 'melee') {
    // Close the gap
    return validMoves.reduce((best, pos) =>
      dist(pos, target.position) < dist(best, target.position) ? pos : best,
      fighter.position
    );
  } else {
    // Stay near optimal ranged distance
    return validMoves.reduce((best, pos) => {
      const d = dist(pos, target.position);
      const bestD = dist(best, target.position);
      return Math.abs(d - RANGED_OPTIMAL) < Math.abs(bestD - RANGED_OPTIMAL) ? pos : best;
    }, fighter.position);
  }
}

export function buildAllHeroesAtLevel(level: number): Fighter[] {
  return HEROES.map(h => buildHeroAtLevel(h.id, level));
}
