-- Rolling 30-day average pace per user per activity type.
-- Updated on every health sync for all heroes (not just Cú Chulainn).
-- Used for Gáe Bulg skill bonus and potentially FE pace display.
create table if not exists user_pace_averages (
  user_id       uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,  -- 'run', 'cycle', 'swim'
  avg_pace_min_per_km numeric(6,3) not null,
  sample_count  int not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, activity_type)
);

alter table user_pace_averages enable row level security;

create policy "Users can read own pace averages"
  on user_pace_averages for select
  using (auth.uid() = user_id);

create policy "Users can upsert own pace averages"
  on user_pace_averages for all
  using (auth.uid() = user_id);
