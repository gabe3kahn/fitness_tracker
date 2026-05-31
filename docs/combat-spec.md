# Arete Combat System Spec

## Overview

Turn-based positional combat on a 1D line. Hero and enemies declare actions simultaneously each round. Positioning, timing (priority bidding), and resource management (stamina, momentum) determine outcomes. All stats are derived from the hero's real-world fitness data.

---

## The Line

Five numbered positions. Lower = enemy side, higher = hero side.

```
[ 1 ] [ 2 ] [ 3 ] [ 4 ] [ 5 ]
 Enemy         Center        Hero
 backline  Enemy  (contested)  Hero  Hero
           front              near  far
```

Rules:
- Enemies can share a position with each other freely
- The hero **cannot enter an enemy-occupied position**, except position 3 (center). Attempting to do so is a failed move (−1 momentum)
- Backward (retreat) movement is never blocked for either side
- Position 3 (center) is contested — both sides can occupy it simultaneously; it is the only position where this is true for opposing sides
- Enemies behind a blocker can still be targeted by ranged attacks, but with reduced accuracy (see Accuracy)

---

## Starting Positions

| Character | Default start | Notes |
|---|---|---|
| Hero | Position 4 or 5 | Chosen as **stance** at start of each encounter |
| Standard enemy | Position 1 or 2 | Set per enemy in encounter design |
| Aggressive enemy | Position 3 (center) | Some enemy types begin in center |

The hero cannot start at center. Stance selection (position 4 vs 5) is the hero's only pre-combat decision.

---

## Turn Structure

Each round, every character simultaneously declares a **sealed** set of choices. All choices resolve together.

### Declaration

| Field | Options |
|---|---|
| **Priority** | Integer bid — lower goes first |
| **Action** | Attack / Defend / Rest |
| **Action order** | Action-first or Move-first |
| **Movement** | Forward (−1 position) / Backward (+1 position) / Stay |
| **Target** | Required when multiple enemies present |
| **Skill** | Optional — replaces basic attack; costs stamina |

### Resolution Order

1. All declarations sealed simultaneously
2. Characters resolve in ascending priority order (1 = first)
3. **Ties**: higher Speed resolves first. If Speed also ties, hero wins.
4. If a character's declared movement destination is occupied when their turn resolves, the **move fails** — the character stays in place but their action still executes from the original position

---

## Movement

- **Forward**: move 1 position toward the enemy side
- **Backward**: move 1 position away from enemy side
- **Stay**: no movement
- Moving forward: **+1 momentum**
- Moving backward: **−1 momentum**
- A failed move: **−1 momentum** (you committed, it didn't land)

**Action order** within a turn:
- *Move-first*: reposition, then execute action from new position
- *Action-first*: execute action from current position, then reposition

---

## Actions

### Attack
Execute a basic attack or skill against the target.
- Basic attack: no stamina cost; uses hero's default attack type (melee or ranged per skill)
- Skill: costs stamina; may be melee or ranged, may have additional effects
- Accuracy and damage are affected by distance (see Accuracy and Damage)
- Landing a hit: **+1 momentum**
- Missing: **−1 momentum**

### Defend
Assume a defensive posture this turn. Each hero has a default defense type:

| Type | Effect | Heroes (examples) |
|---|---|---|
| **Block** | Flat damage reduction this turn, scaled by Defense | Hercules, Cúchulainn |
| **Dodge** | All-or-nothing — either take 0 damage or full damage, probability scaled by Defense | Atalanta, Yoshitsune |

- A successful Dodge (incoming attack misses): **+1 momentum** — slipping a strike builds rhythm
- Defending does **not** trigger momentum loss if the incoming attack misses (Block or Dodge)
- Additional defense skills (Parry, Counter, etc.) unlock through progression

### Rest
Sacrifice your action to recover stamina.
- Recovers a larger stamina burst than the per-turn auto-recovery
- May recover a small amount of HP (TBD — tunable)
- No momentum change

---

## Accuracy

Accuracy is a probability of landing a hit. Base accuracy is modified by **distance**, **attack type**, and **cover**.

### Distance

Distance = `|attacker_position − target_position|` (0–4)

**Melee attacks**
| Distance | Accuracy modifier |
|---|---|
| 0 | +20% |
| 1 | Base |
| 2 | −25% |
| 3 | −50% |
| 4 | −75% |

**Ranged attacks**
| Distance | Accuracy modifier |
|---|---|
| 0 | Not allowed (minimum distance: 1) |
| 1 | −20% |
| 2 | Base (peak) |
| 3 | −15% |
| 4 | −35% |

*All modifiers are tunable. These are starting values for the test build.*

### Cover (Blockers)

Each enemy between the attacker and target applies a flat **−15% accuracy** penalty to ranged attacks passing through them. Melee attacks are unaffected by cover — you can't hit someone behind a blocker with melee; you have to go through them first.

---

## Damage

On a hit:

```
damage = base_damage × skill_multiplier × crit_multiplier
```

- `base_damage`: derived from hero's Damage attribute (see Stats)
- `skill_multiplier`: 1.0 for basic attack; defined per skill (e.g. 1.5× for a heavy strike)
- `crit_multiplier`: 2.0× on a critical hit; crit chance from Crit Rate attribute

Damage is reduced by the defender's active defense (Block reduction or Dodge miss chance) before being applied to HP.

---

## Momentum

Momentum tracks combat rhythm. It is a signed integer, per encounter, reset to 0 at encounter end.

### Changes per action
| Event | Momentum |
|---|---|
| Landing a hit | +1 |
| Missing | −1 |
| Moving forward | +1 |
| Moving backward | −1 |
| Failed move | −1 |
| Successful Dodge | +1 |
| Failed Dodge | ±0 |
| Block (any outcome) | ±0 |

### Thresholds

**+3 (Surge):** Immediately trigger one bonus attack against the current target. Momentum drops by 3 after the bonus attack resolves. Can chain if subsequent hits and movement keep building momentum.

**−3 (Staggered):** Next turn, the hero loses their movement action (action still available). Momentum resets to 0 on the stagger trigger.

---

## Stamina

Stamina is the resource pool for skills.

| Attribute | Derived from |
|---|---|
| Max Stamina | Strength + Endurance (weighted sum) |
| Recovery per turn | Intelligence (flat amount, applied at start of each turn automatically) |

- Skills declare a stamina cost — hero must have sufficient stamina to use them
- If stamina is insufficient, the hero falls back to a basic attack (no skill)
- Rest action provides a larger recovery burst on top of auto-recovery

---

## Stats and Attributes

### Hero stats (visible to player)
Strength · Endurance · Intelligence · Dexterity · Luck

### Combat attributes (derived, not shown to player)

Max Stamina and Stamina Recovery are treated as two half-weight attributes (each worth 0.5) for balance purposes. All others are full-weight (1.0).

| Attribute | Weight | Primary | % | Secondary | % | Tertiary | % |
|---|---|---|---|---|---|---|---|
| **Damage** | 1.0 | Strength | 65 | Intelligence | 35 | — | — |
| **Health** | 1.0 | Endurance | 55 | Strength | 45 | — | — |
| **Speed** | 1.0 | Dexterity | 65 | Endurance | 35 | — | — |
| **Max Stamina** | 0.5 | Endurance | 70 | Strength | 30 | — | — |
| **Stamina Recovery** | 0.5 | Intelligence | 100 | — | — | — | — |
| **Defense** | 1.0 | Intelligence | 40 | Dexterity | 30 | Luck | 30 |
| **Crit Rate** | 1.0 | Luck | 70 | Dexterity | 30 | — | — |

**Stat totals** (sum of weighted contributions — for balance reference):

| Stat | Total |
|---|---|
| Strength | 1.25 |
| Endurance | 1.25 |
| Intelligence | 1.25 |
| Dexterity | 1.25 |
| Luck | 1.00 |

All percentages are starting values — tunable in the balance config. The total column is the invariant to preserve when rebalancing.

### Stat derivation from fitness

Hero stats are derived from the hero's current level and the stat point distribution earned through fitness activities. Each hero has a primary and secondary stat emphasis (defined in `constants/heroes.ts`) that shapes how workout XP maps to stat growth. The exact level→stat formula lives in the fitness system and is referenced here as a black box — combat reads the final stat values, not the raw fitness data.

---

## Hero Archetypes

Each hero has two combat defaults baked into their profile:

| Property | Options | Notes |
|---|---|---|
| **Default defense** | Block or Dodge | Determines base Defend behavior |
| **Range preference** | Melee or Ranged | The other type applies a penalty (flat accuracy debuff — TBD) |

Example assignments (tunable):

| Hero | Default defense | Range preference |
|---|---|---|
| Hercules | Block | Melee (ranged penalty) |
| Atalanta | Dodge | Ranged (melee penalty) |
| Boudicca | Block | Melee |
| Yoshitsune | Dodge | Melee |
| Mulan | Block | Ranged |
| Cúchulainn | Block | Melee |

---

## Multiple Enemies

- Up to 3 enemies per encounter (1v1 built first)
- All enemies share the same 1D line as the hero
- Each enemy has an independent position and declares independently each round
- Target must be declared by the hero when more than one enemy is present
- Enemy priority bids are independent — enemies can contest priority with each other and with the hero

---

## Open / Tunable

The following values are intentionally not locked — set initial values in the test build and adjust from playtesting:

- Stat-to-attribute weighting coefficients
- Base accuracy values
- Cover penalty per blocker (currently −15%)
- Momentum surge threshold (currently +3) and stagger threshold (currently −3)
- Stamina recovery rate per intelligence point
- Rest action recovery amount
- Range penalty for off-preference attack type
- Crit multiplier (currently 2.0×)
