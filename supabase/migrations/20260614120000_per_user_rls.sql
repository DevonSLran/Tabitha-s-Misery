-- ============ Phase 2: per-user data isolation (RLS) ============
-- bca_transactions and merchant_mapping become per-user; stg/int views are
-- recreated with security_invoker so base-table RLS applies to the caller.
-- A per-user budgets table replaces the old localStorage budgets.

-- 1) Owner columns (nullable first so existing rows don't break NOT NULL)
alter table bca_transactions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table merchant_mapping  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) Backfill existing rows to your account.
--    >>> Replace the email below if you signed up with a different one. <<<
update bca_transactions set user_id = (select id from auth.users where email = 'devonsamuel20@gmail.com') where user_id is null;
update merchant_mapping  set user_id = (select id from auth.users where email = 'devonsamuel20@gmail.com') where user_id is null;

-- 3) Future authed inserts default to the caller
alter table bca_transactions alter column user_id set default auth.uid();
alter table merchant_mapping  alter column user_id set default auth.uid();

-- 4) RLS + per-user policies (no anon policy => public anon key is locked out)
alter table bca_transactions enable row level security;
alter table merchant_mapping  enable row level security;
drop policy if exists "own rows" on bca_transactions;
drop policy if exists "own rows" on merchant_mapping;
create policy "own rows" on bca_transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on merchant_mapping  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5) Per-user budgets table (replaces localStorage)
create table if not exists budgets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grp text not null,
  amount bigint not null,
  start_month text not null,
  end_month text not null,
  created_at timestamptz default now(),
  unique (user_id, grp)
);
alter table budgets enable row level security;
drop policy if exists "own rows" on budgets;
create policy "own rows" on budgets for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 6) Make the views enforce the caller's RLS (no drop needed — avoids the
--    mart_daily_spending dependency). Default views run as owner and bypass RLS;
--    security_invoker makes base-table RLS apply to the querying user.
alter view stg_bca_transactions set (security_invoker = on);
alter view int_bca_categorized set (security_invoker = on);
alter view mart_daily_spending  set (security_invoker = on);
