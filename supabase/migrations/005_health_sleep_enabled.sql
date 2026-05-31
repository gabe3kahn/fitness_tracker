alter table health_connections
  add column if not exists sleep_enabled boolean not null default false;
