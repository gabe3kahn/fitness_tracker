-- Replace player_stats with event-sourced hero_stat_events.
-- hero_id = '_global' for player-wide events (lucky day luck).
-- All other stat events are tied to a specific hero.

drop table if exists player_stats;

create table hero_stat_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  hero_id     text        not null,
  stat        text        not null,
  sp          integer     not null check (sp > 0),
  source      text        not null,  -- 'workout', 'level_up', 'puzzle', 'lucky_day'
  session_id  text        not null,
  event_date  date        not null,
  created_at  timestamptz not null default now(),

  unique (user_id, hero_id, stat, session_id)
);

create index hero_stat_events_lookup on hero_stat_events (user_id, hero_id, stat);

alter table hero_stat_events enable row level security;

create policy "Users can read their own stat events"
  on hero_stat_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own stat events"
  on hero_stat_events for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own stat events"
  on hero_stat_events for delete
  using (auth.uid() = user_id);
