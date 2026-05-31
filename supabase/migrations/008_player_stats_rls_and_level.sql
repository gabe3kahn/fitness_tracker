-- Add RLS policies so authenticated users can read/write their own stats.
-- Also add a stored level column so we don't recompute on every read.

alter table player_stats add column if not exists level integer not null default 1;

alter table player_stats enable row level security;

create policy "Users can read own player stats"
  on player_stats for select
  using (auth.uid() = user_id);

create policy "Users can insert own player stats"
  on player_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own player stats"
  on player_stats for update
  using (auth.uid() = user_id);

-- Helper that mirrors the TypeScript levelFromTotalSp() exactly.
-- spToNextLevel(l) = 20 * ceil(sqrt(l))
create or replace function stat_level_from_sp(total_sp integer) returns integer as $$
declare
  lvl      integer := 1;
  consumed integer := 0;
begin
  loop
    exit when consumed + (20 * ceil(sqrt(lvl::numeric))::integer) > total_sp;
    consumed := consumed + (20 * ceil(sqrt(lvl::numeric))::integer);
    lvl      := lvl + 1;
  end loop;
  return lvl;
end;
$$ language plpgsql immutable;

-- Backfill level for any rows already written (e.g. from migration 007).
update player_stats set level = stat_level_from_sp(total_sp);
