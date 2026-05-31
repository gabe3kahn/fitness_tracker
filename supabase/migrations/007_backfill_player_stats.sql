-- Backfill player_stats from historical xp_events.
-- Each active minute of a qualifying workout = 1 SP for the mapped stat.
-- Each solved puzzle = 1 SP for intelligence.
-- Uses DISTINCT ON session_id so multi-row sessions don't double-count.

with workout_sp as (
  select distinct on (session_id)
    user_id,
    case activity_type
      when 'run'                           then 'endurance'
      when 'walk'                          then 'endurance'
      when 'hike'                          then 'endurance'
      when 'swim'                          then 'endurance'
      when 'cycle'                         then 'endurance'
      when 'functionalstrengthtraining'    then 'strength'
      when 'traditionalstrengthtraining'   then 'strength'
      when 'hiit'                          then 'strength'
      when 'yoga'                          then 'dexterity'
      when 'pilates'                       then 'dexterity'
      when 'other'                         then 'dexterity'
      else null
    end as stat,
    raw_value::integer as sp
  from xp_events
  where source = 'activeMinutes'
    and raw_value > 0
    and activity_type is not null
  order by session_id
),
puzzle_sp as (
  select
    user_id,
    'intelligence' as stat,
    count(distinct session_id)::integer as sp
  from xp_events
  where source = 'puzzle'
  group by user_id
),
combined as (
  select user_id, stat, sp from workout_sp where stat is not null
  union all
  select user_id, stat, sp from puzzle_sp
),
totals as (
  select user_id, stat, sum(sp) as total_sp
  from combined
  group by user_id, stat
)
insert into player_stats (user_id, stat, total_sp, updated_at)
select user_id, stat, total_sp, now()
from totals
on conflict (user_id, stat)
do update set
  total_sp   = excluded.total_sp,
  updated_at = now();
