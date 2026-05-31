# Game Mode — Development Roadmap

## Combat System ✅
Full combat spec written at `docs/combat-spec.md`. Key decisions:
- 1D line, 5 positions, positional accuracy model (melee best at 0–1, ranged best at 2)
- Simultaneous sealed declaration: priority bid + action + action-order + movement + target
- Momentum track (−3 stagger / +3 surge bonus attack), per encounter
- Stats → attributes via weighted formulas (see spec for weights)
- Block vs Dodge as hero default defense archetypes
- Hero stats derived from fitness level-ups (`statDistribution × (level − 1)`)

## Combat Engine ✅
Pure TypeScript combat engine written — no React/Phaser dependencies:
- `services/game/types.ts` — all types
- `services/game/engine.ts` — `resolveTurn()`, `deriveAttributes()`, `buildHeroAtLevel()`, `buildAllHeroesAtLevel()`, `buildTestEnemy()`, `createEncounter()`

Test profiles: call `buildAllHeroesAtLevel(5)` for six differentiated level-5 hero builds.

## Next: Web Test UI (Expo web target)
Add a `/game-test` route (web only) that renders:
- 5-position line with colored dots
- Turn declaration panel (priority, action, movement, target)
- Combat log
- Stat panel showing fighter state
Uses the existing Expo web config (`app.json` `"output": "static"`). No new repo needed.

---

---

## Phase 0 — Spike (1 week)
**Goal:** Validate the architecture works before any real investment.

### Build
- [ ] Phaser.js installed and rendering inside an Expo WebView screen
- [ ] React Native → Phaser bridge: pass hero level, weekly XP, active stats via `postMessage`
- [ ] Phaser → React Native bridge: post run result back, trigger XP award in app
- [ ] One boss battle scene using Kenney.nl placeholder art
- [ ] Boss HP driven by real fitness data from the current week
- [ ] Full Supabase round-trip: game result writes to DB, app reflects it

### Test
- [ ] WebView feels native on iOS (no jank, correct safe area, keyboard/gesture conflicts)
- [ ] Phaser renders at acceptable frame rate on a mid-range iPhone
- [ ] Bridge latency is acceptable (data in < 200ms)
- [ ] Full loop playable: work out → open game → fight boss → result saved

### Go / No-Go
If the WebView feels like a browser or the loop doesn't feel motivating, stop and reassess the architecture before Phase 1.

---

## Phase 1 — Game Foundation (3–4 weeks)
**Goal:** Persistent, resumable game state with a working map and encounter engine.

### Supabase Schema
- [ ] `game_runs` — active and completed runs (hero, start date, status, seed)
- [ ] `run_state` — current node, resources, HP, active relics, deck
- [ ] `encounter_log` — history of outcomes per node per run
- [ ] `relics` — catalog and per-run ownership
- [ ] `cards` / `abilities` — catalog tied to hero skills

### Game Engine (Phaser)
- [ ] Map scene: node graph renderer with path selection
- [ ] Encounter state machine: combat / event / rest / elite / boss node types
- [ ] Combat scene: action selection, resolution, enemy response
- [ ] Run persistence: save/resume mid-run via Supabase
- [ ] Run completion: win/loss flow back to React Native

### Fitness Bridge
- [ ] Weekly fitness data → run resources formula (user-defined in concept)
- [ ] Stat values (strength, endurance, etc.) → combat modifiers
- [ ] Hero level → starting deck / HP
- [ ] Sleep multiplier integration if applicable

### Test
- [ ] Can start, pause, and resume a run across app sessions
- [ ] Encounter outcomes are deterministic given the same inputs
- [ ] Fitness data flows correctly into run resources (verify with known workout data)
- [ ] RLS prevents users from reading each other's run state

---

## Phase 2 — Content Systems (4–6 weeks)
**Goal:** Enough variety to make runs feel meaningfully different.

### Enemies
- [ ] Enemy catalog: 8–12 base enemy types with stats and simple AI patterns
- [ ] Elite variants with modifiers
- [ ] 2–3 boss designs with distinct mechanics
- [ ] Scaling formula per run depth / hero level

### Encounters
- [ ] Event catalog: 15–20 narrative events with branching outcomes
- [ ] Rest node: HP recovery / card upgrade mechanic
- [ ] Shop node: spend run currency on relics / card removals
- [ ] Fitness-gated events (e.g. high endurance unlocks an option)

### Relics
- [ ] 20–30 relics with passive effects
- [ ] Relic synergy system
- [ ] Unlock/discovery flow

### Cards / Abilities
- [ ] Starter deck per hero class
- [ ] 30–50 card catalog (attacks, skills, powers)
- [ ] Card upgrade system at rest nodes
- [ ] Hero skill unlocks (from leveling) add cards to the pool

### Balance
- [ ] Spreadsheet-driven balance: all enemy/card/relic values in config, not hardcoded
- [ ] Playtesting log format so tuning can be tracked

---

## Phase 3 — Art Integration (parallel with Phase 2)
**Goal:** Replace placeholders without engine changes.

### Pipeline
- [ ] Agree on art style (pixel art vs. illustrated) and lock reference sheet
- [ ] Asset naming convention and atlas format documented
- [ ] Phaser asset loader accepts hot-swappable atlas — no code changes to swap art

### Assets (in priority order)
- [ ] Hero portraits (one per hero class) — Midjourney
- [ ] Enemy sprites (idle + attack frames) — purchased pack or Midjourney + Spine/Aseprite
- [ ] Boss sprites — higher detail, Midjourney + animation
- [ ] Map node icons and backgrounds
- [ ] Card frame and UI chrome
- [ ] Relic icons

### Animation
- [ ] Decide: Spine (skeletal) vs. Aseprite (frame-by-frame pixel)
- [ ] If Spine: install Phaser Spine plugin, validate on device
- [ ] If Aseprite: export spritesheets, validate atlas loading in Phaser

---

## Phase 4 — Polish (2–3 weeks)
- [ ] Screen transitions (React Native → WebView feels intentional, not abrupt)
- [ ] Combat feedback: hit flash, damage numbers, screen shake
- [ ] Sound effects (royalty-free library — Freesound, Kenney audio packs)
- [ ] Background music loop per zone
- [ ] Loading states and error handling for slow connections
- [ ] Offline handling (can you play a run without connectivity?)

---

## Phase 5 — Launch Prep
- [ ] Balance pass with real user data (requires at least 2–3 testers)
- [ ] XP calibration pass (see `project_herofit_xp_calibration.md`) — do this before any external users
- [ ] Performance profile on oldest supported iPhone
- [ ] EAS build with game assets (watch bundle size — Phaser + assets can get large)
- [ ] Analytics: track run start, run complete, node type distribution, drop-off points

---

## Open Questions (resolve before Phase 1)
- Roguelike (fresh run each time) vs. campaign (persistent progress)?
- If roguelike: do hero levels/stats persist across runs, or reset?
- Multiplayer / co-op runs in scope or explicitly out of scope?
- Does losing a run have a fitness consequence, or just a game consequence?
