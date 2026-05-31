# Arete

A dark fantasy RPG fitness tracker for iOS. Log workouts, earn XP, level up your hero, and complete quests — powered by real activity data from Apple Health.

## Concept

Choose a mythological hero (Hercules, Atalanta, and four others). Your hero earns XP from real workouts synced via Apple HealthKit. XP unlocks tiers (Novice → Apprentice → Champion → Legend → Mythic), levels, and hero-specific skills. Daily streaks and quests add structure to keep you consistent.

## Tech stack

- **React Native / Expo SDK 54** with file-based routing (expo-router)
- **NativeWind** (Tailwind CSS for React Native)
- **Supabase** (Postgres + Row Level Security) — auth, user data, XP events
- **@tanstack/react-query** — data fetching and cache
- **@kayzmann/expo-healthkit** — Apple HealthKit integration (workouts, steps, calories, distance)
- **EAS Build** — cloud iOS builds (required for HealthKit native module)

## Running the app

> **Expo Go will not work.** The app uses a native HealthKit module that requires a custom dev client.

### First time setup

```bash
npm install
```

### Build the dev client (iOS, EAS cloud build)

```bash
eas build --platform ios --profile development
```

Install the resulting `.ipa` on your iPhone via the EAS link, then:

```bash
npx expo start --dev-client
```

Scan the QR code with the Camera app (not Expo Go).

### EAS config

- **Bundle ID:** `com.gabrielkahn.herofit`
- **EAS Project ID:** `b3478ac5-b55b-4f7c-8646-f75aa00ac320`
- **Apple Developer Team:** Gabriel Kahn (Individual) — `SWL4K9UNJW`

## Project structure

```
app/
  (tabs)/         # Main tab screens: dashboard, quests, hero
  hero-select.tsx # Hero selection carousel (shown on first launch)
assets/
  heroes/         # Hero art PNGs, organised by hero/tier
    hercules/     # hercules_{novice,apprentice,champion,legend,mythic}.png
    atalanta/     # atalanta_{novice,apprentice,champion,legend,mythic}.png
constants/
  heroes.ts       # Hero definitions, tier ranges, stat keys
  hero-images.ts  # Static require() lookup: getHeroImage(heroId, tier)
  xp-config.ts    # XP thresholds per level
  ui.ts           # Class colours, tier labels, emoji fallbacks
hooks/
  useHealthSync.ts    # HealthKit sync on app open (5-min cooldown, 30-day backfill)
  useHeroProgression.ts
  useQuests.ts        # Live quest progress from xp_events aggregation
services/
  xp-engine.ts        # awardXp() — XP calculation, streak logic, DB writes
  health/healthkit.ts # HealthKit wrappers: permissions, workouts, today's stats
  supabase.ts
stores/
  user-store.ts
supabase/
  migrations/         # SQL migrations (apply in order to Supabase dashboard)
```

## Hero art

6 heroes × 5 tiers = 30 images total. Generated via Claude image generation.

| Hero | Art status |
|------|-----------|
| Hercules | Done |
| Atalanta | Done |
| Minamoto no Yoshitsune | Pending |
| Mulan | Pending |
| Cú Chulainn | Pending |
| Boudicca | Pending |

Image filename convention: `assets/heroes/{heroId}/{heroId}_{tier}.png`  
Tier names: `novice`, `apprentice`, `champion`, `legend`, `mythic`

## Data model (key tables)

| Table | Purpose |
|-------|---------|
| `user_heroes` | Active hero per user, level, XP, streak |
| `xp_events` | One row per XP award; source of truth for quest progress |
| `health_connections` | Sync cursor (`last_sync_at`) per platform |

## Pending features

- Calendar / history heatmap view
- Additional activity types (cycle, strength, HIIT, yoga)
- Boss quest cumulative progress tracking
- Hero art for remaining 4 heroes
- Garmin / Fitbit / Strava integrations (Phase 2)
