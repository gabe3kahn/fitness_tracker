create table if not exists luck_checks (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references profiles(id) on delete cascade,
  checked_on date        not null,
  won        boolean     not null,
  created_at timestamptz not null default now()
);

alter table luck_checks enable row level security;

create policy "Users can read own luck checks"
  on luck_checks for select
  using (auth.uid() = user_id);

create policy "Users can insert own luck checks"
  on luck_checks for insert
  with check (auth.uid() = user_id);
