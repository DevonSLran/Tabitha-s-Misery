-- Per-user settings, starting with the day budget months start on.
--
-- month_start_day 1 = calendar months (the old behaviour). 15 = each month runs
-- from the 15th to the 14th of the next month, to match when money comes in.
-- Capped at 28 so every month has that day.
--
-- The client reads it with maybeSingle(): no row means the 1st, so existing
-- users need no backfill. It writes with upsert on user_id (js/app.js
-- saveMonthStartDay, connector set_month_start_day).
--
-- No views change here. Still run `npm run check:rls` after applying: the anon
-- key must read nothing from this table.

create table if not exists user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  month_start_day smallint not null default 1 check (month_start_day between 1 and 28),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

drop policy if exists "own rows" on user_settings;
create policy "own rows" on user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
