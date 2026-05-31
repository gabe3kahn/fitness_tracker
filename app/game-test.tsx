import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import {
  buildHeroAtLevel, buildTestEnemy, createEncounter,
  beginTurn, resolveNextFighter, resolveActionBeforeMove, computeAIDestination,
  getHeroSkill, getValidMoves, calculateAccuracy, dist, snapshotState,
} from '../services/game/engine';
import { HEROES } from '../constants/heroes';
import type {
  CombatState, Declaration, ActionType, ActionOrder,
  Fighter, Position, TurnPhase, SkillDef, CombatEventDetail,
} from '../services/game/types';

// ─── UI state machine ─────────────────────────────────────────────────────────

type UIPhase =
  | { kind: 'setup' }
  | { kind: 'declaring' }
  | { kind: 'player-moving'; phase: TurnPhase; validMoves: Position[]; showAccuracy: boolean }
  | { kind: 'done' };

type HeroDecl = {
  priority: number;
  action: ActionType;
  actionOrder: ActionOrder;
  useSkill: boolean;
};

const DEFAULT_DECL: HeroDecl = {
  priority: 2,
  action: 'attack',
  actionOrder: 'move-first',
  useSkill: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomWeightedRow(): number {
  const r = Math.random();
  if (r < 0.50) return 3;
  if (r < 0.70) return 2;
  if (r < 0.90) return 4;
  if (r < 0.95) return 1;
  return 5;
}

function makeEncounter(heroId: string): CombatState {
  const hero = buildHeroAtLevel(heroId, 5);
  // Enemy col: melee = 2, ranged = 1. Row weighted toward center, hidden until first commit.
  const enemy = buildTestEnemy({ position: { col: 2, row: randomWeightedRow() } });
  return createEncounter(hero, [enemy]);
}

function aiDeclaration(enemy: Fighter): Declaration {
  return {
    fighterId: enemy.id,
    priority: Math.ceil(Math.random() * 3),
    action: 'attack',
    actionOrder: 'move-first',
  };
}

// Advance through AI fighters until we hit the player or the round ends.
function advanceAI(phase: TurnPhase): TurnPhase | CombatState {
  let current: TurnPhase | CombatState = phase;
  while (true) {
    if (!('currentIndex' in current)) return current; // CombatState = done
    const p = current as TurnPhase;
    if (p.currentIndex >= p.sortedDecls.length) return resolveNextFighter(p, p.state.hero.position); // triggers finishRound
    const decl = p.sortedDecls[p.currentIndex];
    const fighter = decl.fighterId === p.state.hero.id ? p.state.hero
      : p.state.enemies.find(e => e.id === decl.fighterId);
    if (!fighter || fighter.hp <= 0) {
      // skip dead fighter — pass dummy destination
      current = resolveNextFighter(p, fighter?.position ?? { col: 1, row: 1 });
      continue;
    }
    if (fighter.side === 'hero') return p; // player's turn — pause
    // AI fighter: compute destination and auto-resolve
    const dest = computeAIDestination(fighter, p.state);
    current = resolveNextFighter(p, dest);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, marginRight: 4, marginBottom: 4,
        backgroundColor: active ? '#F59E0B' : '#1E1E35',
        borderWidth: 1, borderColor: active ? '#F59E0B' : '#2A2A45',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: active ? '#09090F' : '#9CA3AF', fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DeclRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: '#4B5563', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>
    </View>
  );
}

function StatBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, current / max));
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ color: '#6B7280', fontSize: 9 }}>{label}</Text>
        <Text style={{ color: '#6B7280', fontSize: 9 }}>{Math.round(current)}/{Math.round(max)}</Text>
      </View>
      <View style={{ height: 4, backgroundColor: '#1E1E35', borderRadius: 2 }}>
        <View style={{ width: `${pct * 100}%` as any, height: 4, backgroundColor: color, borderRadius: 2 }} />
      </View>
    </View>
  );
}

function FighterCard({ fighter, label }: { fighter: Fighter; label: string }) {
  const hpColor = fighter.hp / fighter.attributes.maxHp > 0.5 ? '#4ADE80'
    : fighter.hp / fighter.attributes.maxHp > 0.25 ? '#FBBF24' : '#EF4444';
  const momColor = fighter.momentum > 0 ? '#4ADE80' : fighter.momentum < 0 ? '#EF4444' : '#6B7280';
  return (
    <View style={{ flex: 1, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6, flexWrap: 'wrap' }}>
        <Text style={{ color: '#D1D5DB', fontSize: 12, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: '#6B7280', fontSize: 10 }}>({fighter.position.col},{fighter.position.row})</Text>
        <Text style={{ color: momColor, fontSize: 10, fontWeight: '700' }}>
          mom {fighter.momentum > 0 ? '+' : ''}{Math.round(fighter.momentum)}
        </Text>
        {fighter.vulnerability > 0 && (
          <Text style={{ color: '#FB923C', fontSize: 10, fontWeight: '700' }}>vuln {fighter.vulnerability}</Text>
        )}
        {fighter.staggeredNextTurn && <Text style={{ color: '#F97316', fontSize: 10 }}>STAGGERED</Text>}
        {fighter.hp <= 0 && <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>DEFEATED</Text>}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatBar label="HP" current={fighter.hp} max={fighter.attributes.maxHp} color={hpColor} />
        <StatBar label="ST" current={fighter.stamina} max={fighter.attributes.maxStamina} color="#60A5FA" />
      </View>
    </View>
  );
}

// ─── Event log ────────────────────────────────────────────────────────────────

const EVENT_COLOR: Record<string, string> = {
  round_start:       '#374151',
  attack_hit:        '#4ADE80',
  attack_crit:       '#F59E0B',
  attack_miss:       '#EF4444',
  block:             '#60A5FA',
  dodge_success:     '#A78BFA',
  dodge_fail:        '#9CA3AF',
  hp_lost:           '#F87171',
  fighter_defeated:  '#EF4444',
  momentum_surge:    '#FBBF24',
  momentum_stagger:  '#F97316',
  rest:              '#6EE7B7',
  stamina_recovered: '#1F2937',
  move:              '#6B7280',
  move_failed:       '#7F1D1D',
  encounter_end:     '#F59E0B',
};

function fmt(n: number | undefined, digits = 2): string {
  return n === undefined ? '?' : n.toFixed(digits);
}

function formatDetail(type: string, d: CombatEventDetail): string {
  const parts: string[] = [];
  if (d.distance !== undefined) parts.push(`dist=${fmt(d.distance, 1)}`);
  if (d.blockerCount !== undefined && d.blockerCount > 0) parts.push(`cover=${d.blockerCount}`);
  if (d.offPreference) parts.push('off-pref');
  if (d.accuracyValue !== undefined) parts.push(`acc=${fmt(d.accuracyValue)} roll=${fmt(d.accuracyRoll)}`);
  if (d.skillMultiplier !== undefined && d.skillMultiplier !== 1) parts.push(`skill×${fmt(d.skillMultiplier, 1)}`);
  if (d.critThreshold !== undefined) parts.push(`crit=${fmt(d.critRoll)} vs ${fmt(d.critThreshold)}${d.critMultiplier === 2 ? ' ✓' : ''}`);
  if (d.targetVulnerability !== undefined && d.targetVulnerability > 0) parts.push(`vuln=${d.targetVulnerability}`);
  if (d.rawDamage !== undefined) parts.push(`raw=${fmt(d.rawDamage, 1)}`);
  if (d.blockReduction !== undefined) parts.push(`block-${fmt(d.blockReduction, 1)}→${fmt(d.finalDamage, 1)}`);
  if (d.dodgeChance !== undefined) parts.push(`dodge=${fmt(d.dodgeChance)} roll=${fmt(d.dodgeRoll)}${type === 'dodge_success' ? ' ✓' : ' ✗'}`);
  if (d.momentumDelta !== undefined) parts.push(`mom ${d.momentumBefore}${d.momentumDelta! >= 0 ? '+' : ''}${d.momentumDelta}→${d.momentumAfter}`);
  if (d.fromPosition && d.toPosition) parts.push(`(${d.fromPosition.col},${d.fromPosition.row})→(${d.toPosition.col},${d.toPosition.row})`);
  return parts.join('  ');
}

function downloadLog(log: CombatState['log'], round: number): void {
  const lines = log.map((ev, i) => {
    const base = `[${String(i).padStart(3, '0')}] ${ev.type.padEnd(18)} | ${ev.message}`;
    const det = ev.detail ? `\n      ${JSON.stringify(ev.detail)}` : '';
    return base + det;
  });
  const text = `Arete Combat Log — Round ${round}\n${'─'.repeat(60)}\n${lines.join('\n')}\n`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `combat-log-r${round}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ─── 5×5 Grid ─────────────────────────────────────────────────────────────────

function Grid({
  state,
  setupMode,
  onSetupClick,
  hideEnemy,
  validMoves,
  onSelectMove,
  heroSkill,
  heroDecl,
  showAccuracy,
}: {
  state: CombatState;
  setupMode: boolean;
  onSetupClick: ((pos: Position) => void) | null;
  hideEnemy: boolean;
  validMoves: Position[] | null;
  onSelectMove: ((pos: Position) => void) | null;
  heroSkill: SkillDef | undefined;
  heroDecl: HeroDecl;
  showAccuracy: boolean;
}) {
  const { hero, enemies } = state;
  const enemy = enemies[0];

  const accFromPos = (pos: Position): number | null => {
    if (!showAccuracy || !enemy || enemy.hp <= 0) return null;
    const range = heroDecl.useSkill && heroSkill ? heroSkill.range : hero.rangePreference;
    const tempHero = { ...hero, position: pos };
    return calculateAccuracy(tempHero, enemy, range, { ...state, hero: tempHero });
  };

  const occupants: Record<string, { label: string; color: string }[]> = {};
  const visibleFighters = [hero, ...enemies].filter(f =>
    f.hp > 0 && !(hideEnemy && f.side === 'enemy')
  );
  visibleFighters.forEach(f => {
    const key = `${f.position.col},${f.position.row}`;
    if (!occupants[key]) occupants[key] = [];
    occupants[key].push({ label: f.side === 'hero' ? 'H' : 'E', color: f.side === 'hero' ? '#F59E0B' : '#EF4444' });
  });

  const isValidMove = (pos: Position) =>
    validMoves?.some(p => p.col === pos.col && p.row === pos.row) ?? false;

  const isSetupTarget = (pos: Position) =>
    setupMode && pos.col >= 4;

  return (
    <View style={{ backgroundColor: '#12121E', borderRadius: 14, borderWidth: 1, borderColor: '#1E1E35', padding: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 18 }}>
        {[1,2,3,4,5].map(col => (
          <View key={col} style={{ width: 52, alignItems: 'center' }}>
            <Text style={{ color: col <= 2 ? '#EF444440' : col >= 4 ? '#F59E0B40' : '#FFFFFF20', fontSize: 8 }}>{col}</Text>
          </View>
        ))}
      </View>
      {[1,2,3,4,5].map(row => (
        <View key={row} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
          <Text style={{ color: '#2A2A45', fontSize: 8, width: 16 }}>{row}</Text>
          {[1,2,3,4,5].map(col => {
            const pos: Position = { col, row };
            const key = `${col},${row}`;
            const occ = occupants[key] ?? [];
            const canMove = isValidMove(pos);
            const canSetup = isSetupTarget(pos);
            const acc = canMove && onSelectMove ? accFromPos(pos) : null;
            const accColor = acc == null ? null
              : acc >= 0.75 ? '#4ADE80' : acc >= 0.55 ? '#FBBF24' : '#EF4444';
            const isEnemyHome = col <= 2;
            const isHeroHome = col >= 4;
            const interactive = canMove || canSetup;
            return (
              <TouchableOpacity
                key={col}
                onPress={() => {
                  if (canMove) onSelectMove?.(pos);
                  else if (canSetup) onSetupClick?.(pos);
                }}
                disabled={!interactive}
                style={{
                  width: 50, height: 50, borderRadius: 10, marginRight: 2,
                  backgroundColor: canSetup ? '#0D1A2E' : canMove ? '#1A2A1A' : '#09090F',
                  borderWidth: interactive ? 2 : 1,
                  borderColor: canSetup ? '#60A5FA80'
                    : canMove ? (accColor ?? '#4ADE80')
                    : isEnemyHome ? '#EF444420'
                    : isHeroHome ? '#F59E0B20'
                    : '#1E1E35',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {occ.length > 0
                  ? occ.map((o, i) => (
                      <Text key={i} style={{ color: o.color, fontSize: 16, fontWeight: '800', lineHeight: 18 }}>{o.label}</Text>
                    ))
                  : canMove && acc != null
                    ? <Text style={{ color: accColor ?? '#6B7280', fontSize: 11, fontWeight: '700' }}>{Math.round(acc * 100)}%</Text>
                    : canSetup
                      ? <Text style={{ color: '#60A5FA60', fontSize: 11 }}>H?</Text>
                      : <Text style={{ color: '#1E1E35', fontSize: 14 }}>·</Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, justifyContent: 'center' }}>
        <Text style={{ color: '#EF444440', fontSize: 9 }}>← enemy home (cols 1-2)</Text>
        <Text style={{ color: '#F59E0B40', fontSize: 9 }}>hero home (cols 4-5) →</Text>
        {setupMode && <Text style={{ color: '#60A5FA60', fontSize: 9 }}>blue = click to start here</Text>}
        {onSelectMove && showAccuracy && <Text style={{ color: '#4ADE8060', fontSize: 9 }}>green/yellow/red = accuracy</Text>}
        {onSelectMove && !showAccuracy && <Text style={{ color: '#60A5FA60', fontSize: 9 }}>attack resolved — pick move</Text>}
      </View>
    </View>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function GameTestContent() {
  const [heroId, setHeroId] = useState('hercules');
  const [state, setState] = useState<CombatState>(() => makeEncounter('hercules'));
  const [decl, setDecl] = useState<HeroDecl>(DEFAULT_DECL);
  const [uiPhase, setUIPhase] = useState<UIPhase>({ kind: 'setup' });
  const logRef = useRef<ScrollView>(null);

  // Auto-scroll log on state change
  useEffect(() => {
    setTimeout(() => logRef.current?.scrollToEnd({ animated: true }), 50);
  }, [state.log.length]);

  function switchHero(id: string) {
    setHeroId(id);
    setState(makeEncounter(id));
    setDecl(DEFAULT_DECL);
    setUIPhase({ kind: 'setup' });
  }

  function reset() {
    setState(makeEncounter(heroId));
    setDecl(DEFAULT_DECL);
    setUIPhase({ kind: 'setup' });
  }

  function handleSetupClick(pos: Position) {
    setState(s => ({ ...s, hero: { ...s.hero, position: pos } }));
    // stay in setup — player confirms via button
  }

  function confirmPosition() {
    setUIPhase({ kind: 'declaring' });
  }

  function commit() {
    if (state.isOver || uiPhase.kind !== 'declaring') return;
    const heroSkill = getHeroSkill(heroId);
    const heroDeclaration: Declaration = {
      fighterId: state.hero.id,
      priority: decl.priority,
      action: decl.action,
      actionOrder: decl.actionOrder,
      skill: decl.useSkill && heroSkill ? heroSkill : undefined,
    };
    const enemyDeclarations = state.enemies
      .filter(e => e.hp > 0)
      .map(e => aiDeclaration(e));

    const phase = beginTurn([heroDeclaration, ...enemyDeclarations], state);
    const advanced = advanceAI(phase);

    if (!('currentIndex' in advanced)) {
      // Round finished without player turn (player was defeated before they moved?)
      setState(advanced as CombatState);
      setUIPhase({ kind: 'done' });
      return;
    }

    let nextPhase = advanced as TurnPhase;
    const heroDecl = nextPhase.sortedDecls[nextPhase.currentIndex];
    if (heroDecl?.actionOrder === 'action-first') {
      // Resolve attack immediately, then ask player for move with no accuracy overlay
      nextPhase = resolveActionBeforeMove(nextPhase);
    }
    const validMoves = getValidMoves(nextPhase.state.hero, nextPhase.state);
    setState(snapshotState(nextPhase.state));
    setUIPhase({ kind: 'player-moving', phase: nextPhase, validMoves, showAccuracy: heroDecl?.actionOrder !== 'action-first' });
  }

  function handleMoveSelect(pos: Position) {
    if (uiPhase.kind !== 'player-moving') return;
    const result = resolveNextFighter(uiPhase.phase, pos);

    if (!('currentIndex' in result)) {
      setState(result as CombatState);
      setUIPhase((result as CombatState).isOver ? { kind: 'done' } : { kind: 'declaring' });
      setDecl(DEFAULT_DECL);
      return;
    }

    // More fighters after player — advance remaining AI
    const advanced = advanceAI(result as TurnPhase);
    if (!('currentIndex' in advanced)) {
      const finalState = advanced as CombatState;
      setState(finalState);
      setUIPhase(finalState.isOver ? { kind: 'done' } : { kind: 'declaring' });
      setDecl(DEFAULT_DECL);
    } else {
      // Another player-mover (shouldn't happen in 1v1 but handles multi-hero)
      const nextPhase = advanced as TurnPhase;
      setState(snapshotState(nextPhase.state));
      const validMoves = getValidMoves(nextPhase.state.hero, nextPhase.state);
      setUIPhase({ kind: 'player-moving', phase: nextPhase, validMoves, showAccuracy: true });
    }
  }

  const { hero, enemies } = state;
  const enemy = enemies[0];
  const heroSkill = getHeroSkill(heroId);
  const isSetup = uiPhase.kind === 'setup';
  const isMoving = uiPhase.kind === 'player-moving';
  const isDone = uiPhase.kind === 'done' || state.isOver;
  const totalFighters = 1 + enemies.filter(e => e.hp > 0).length;

  const movLabel = decl.actionOrder === 'move-first' ? 'move → act' : 'act → move';
  const declSummary = `P${decl.priority} · ${decl.action} · ${movLabel}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#09090F', padding: 16 }}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Combat Test</Text>
        <Text style={{ color: '#374151', fontSize: 12 }}>Round {state.round}</Text>
        {isDone && (
          <Text style={{ color: state.winner === 'hero' ? '#4ADE80' : '#EF4444', fontSize: 12, fontWeight: '700' }}>
            {state.winner === 'hero' ? '— Victory' : '— Defeated'}
          </Text>
        )}
        {isSetup && <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: '600' }}>Pick starting position (cols 4–5)</Text>}
        {isMoving && <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: '600' }}>Choose destination →</Text>}
        <View style={{ flex: 1 }} />
        {state.log.length > 0 && (
          <TouchableOpacity
            onPress={() => downloadLog(state.log, state.round)}
            style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#0D1A2E', borderWidth: 1, borderColor: '#1A3A60', marginRight: 6 }}
          >
            <Text style={{ color: '#60A5FA', fontSize: 11, fontWeight: '600' }}>⬇ Log</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={reset}
          style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#1A1010', borderWidth: 1, borderColor: '#3A1010' }}
        >
          <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600' }}>↺ Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Hero picker */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {HEROES.map(h => (
          <TouchableOpacity
            key={h.id}
            onPress={() => switchHero(h.id)}
            disabled={isMoving}
            style={{
              paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6,
              backgroundColor: heroId === h.id ? '#292210' : '#12121E',
              borderWidth: 1, borderColor: heroId === h.id ? '#F59E0B60' : '#1E1E35',
              opacity: isMoving ? 0.5 : 1,
            }}
          >
            <Text style={{ color: heroId === h.id ? '#F59E0B' : '#6B7280', fontSize: 11, fontWeight: '600' }}>
              {h.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fighter stats */}
      <View style={{ backgroundColor: '#12121E', borderRadius: 12, borderWidth: 1, borderColor: '#1E1E35', padding: 10, flexDirection: 'row', marginBottom: 12 }}>
        <FighterCard fighter={hero} label={`${hero.name} (${hero.defenseType}/${hero.rangePreference}/mv${hero.movement})`} />
        <View style={{ width: 1, backgroundColor: '#1E1E35' }} />
        <FighterCard fighter={enemy} label={`${enemy.name} (${enemy.defenseType}/${enemy.rangePreference}/mv${enemy.movement})`} />
      </View>

      {/* Grid + declaration + log */}
      <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>

        {/* Left: grid + declaration */}
        <ScrollView style={{ width: 310 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>

          {/* Grid */}
          <Grid
            state={state}
            setupMode={isSetup}
            onSetupClick={isSetup ? handleSetupClick : null}
            hideEnemy={isSetup}
            validMoves={isMoving ? uiPhase.validMoves : null}
            onSelectMove={isMoving ? handleMoveSelect : null}
            heroSkill={heroSkill}
            heroDecl={decl}
            showAccuracy={isMoving ? uiPhase.showAccuracy : false}
          />

          {/* Declaration panel */}
          <View style={{ backgroundColor: '#12121E', borderRadius: 14, borderWidth: 1, borderColor: '#1E1E35', padding: 14 }}>
            {/* Archetype badges */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#1A1A2E' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>{hero.rangePreference === 'melee' ? '⚔ Melee' : '🏹 Ranged'}</Text>
              </View>
              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#1A1A2E' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>{hero.defenseType === 'block' ? '🛡 Block' : '💨 Dodge'}</Text>
              </View>
              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: '#1A1A2E' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>mv {hero.movement}</Text>
              </View>
            </View>

            <Text style={{ color: '#6B7280', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
              {isSetup ? 'Pick start position first' : isMoving ? 'Click grid to move' : 'Declare Turn'}
            </Text>

            <DeclRow label="Priority">
              {Array.from({ length: totalFighters }, (_, i) => i + 1).map(n => (
                <Chip key={n} label={String(n)} active={decl.priority === n} disabled={isMoving || isSetup} onPress={() => setDecl(d => ({ ...d, priority: n }))} />
              ))}
            </DeclRow>

            <DeclRow label="Action">
              {(['attack', 'rest'] as ActionType[]).map(a => (
                <Chip key={a}
                  label={a === 'attack' ? '⚔ Attack' : '💤 Rest'}
                  active={decl.action === a} disabled={isMoving || isSetup}
                  onPress={() => setDecl(d => ({ ...d, action: a }))}
                />
              ))}
            </DeclRow>

            <DeclRow label="Order">
              <Chip label="Move → Act" active={decl.actionOrder === 'move-first'} disabled={isMoving || isSetup} onPress={() => setDecl(d => ({ ...d, actionOrder: 'move-first' }))} />
              <Chip label="Act → Move" active={decl.actionOrder === 'action-first'} disabled={isMoving || isSetup} onPress={() => setDecl(d => ({ ...d, actionOrder: 'action-first' }))} />
            </DeclRow>

            {heroSkill && (
              <DeclRow label="Skill">
                <Chip label={`Basic (${hero.rangePreference})`} active={!decl.useSkill} disabled={isMoving || isSetup} onPress={() => setDecl(d => ({ ...d, useSkill: false }))} />
                <Chip label={`${heroSkill.name} · ${heroSkill.staminaCost}ST · vuln${heroSkill.vulnerability}`} active={decl.useSkill} disabled={isMoving || isSetup} onPress={() => setDecl(d => ({ ...d, useSkill: true }))} />
                {decl.useSkill && (
                  <Text style={{ color: '#6B7280', fontSize: 10, marginTop: 2, width: '100%' }}>{heroSkill.description}</Text>
                )}
              </DeclRow>
            )}

            <Text style={{ color: '#374151', fontSize: 10, marginBottom: 10 }}>{declSummary}</Text>

            <TouchableOpacity
              onPress={isDone ? reset : isSetup ? confirmPosition : commit}
              disabled={isMoving}
              style={{
                borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                backgroundColor: isDone ? '#0D2010' : isMoving ? '#1A1A2E' : '#F59E0B',
                opacity: isMoving ? 0.4 : 1,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: isDone ? '#4ADE80' : isMoving ? '#374151' : '#09090F' }}>
                {isDone ? '↺ New Encounter' : isMoving ? 'Waiting for move…' : isSetup ? 'Confirm Position →' : 'Commit →'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Combat log */}
        <ScrollView
          ref={logRef}
          style={{ flex: 1, backgroundColor: '#12121E', borderRadius: 14, borderWidth: 1, borderColor: '#1E1E35' }}
          contentContainerStyle={{ padding: 14 }}
        >
          {state.log.length === 0 && (
            <Text style={{ color: '#2A2A45', fontSize: 12 }}>Declare your turn and hit Commit to begin.</Text>
          )}
          {state.log.map((ev, i) => (
            <View key={i} style={{ marginBottom: ev.type === 'round_start' ? 6 : 1, marginTop: ev.type === 'round_start' ? 10 : 0 }}>
              <Text style={{
                color: EVENT_COLOR[ev.type] ?? '#6B7280',
                fontSize: 11,
                fontWeight: ev.type === 'round_start' || ev.type === 'encounter_end' ? '700' : '400',
                opacity: ev.type === 'stamina_recovered' ? 0.4 : 1,
              }}>
                {ev.message}
              </Text>
              {ev.detail && formatDetail(ev.type, ev.detail) && (
                <Text style={{ color: '#374151', fontSize: 9, marginTop: 1, fontFamily: 'monospace' }}>
                  {formatDetail(ev.type, ev.detail)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

      </View>
    </View>
  );
}

// ─── Route export ─────────────────────────────────────────────────────────────

export default function GameTestScreen() {
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090F', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6B7280', fontSize: 14 }}>Combat test UI — open in browser</Text>
      </View>
    );
  }
  return <GameTestContent />;
}
