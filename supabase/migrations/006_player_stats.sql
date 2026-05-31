create table if not exists player_stats (
  user_id     uuid        not null references profiles(id) on delete cascade,
  stat        text        not null,
  total_sp    integer     not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, stat)
);

alter table profiles
  add column if not exists last_luck_check date;
