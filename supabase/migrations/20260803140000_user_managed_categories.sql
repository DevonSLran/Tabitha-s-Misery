-- User-managed categories.
--
-- Three changes:
--   1. A `categories` table so the category list stops being hardcoded in the
--      client (add-rule.html's <select>, getIconForCategory, and
--      mapCategoryToBudgetGroup all read from it now).
--   2. A `category_override` column so a single transaction can be
--      re-categorised regardless of what the merchant_mapping keyword rules
--      guessed.
--   3. int_bca_categorized is finally committed here. It was created outside the
--      migrations and existed only in the live database, one dashboard edit away
--      from changing silently. This is its previous definition plus the override.
--
-- !! Every `create or replace view` below MUST be followed by
-- !! `alter view ... set (security_invoker = on)`. Replacing a view resets its
-- !! options; a view that loses security_invoker runs as its owner and bypasses
-- !! RLS on bca_transactions, exposing every user's rows to anyone holding the
-- !! public anon key. Views reading other views inherit the bypass.
-- !! Run `npm run check:rls` after applying this.

-- 1. Categories -------------------------------------------------------------
create table if not exists categories (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'receipt_long',
  budget_group text not null default 'OTHER',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table categories enable row level security;

drop policy if exists "own rows" on categories;
create policy "own rows" on categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Defaults are seeded by the client on first load (loadCategories in app.js)
-- rather than by a trigger on auth.users, so new signups and existing accounts
-- take the same path.

-- 2. Per-transaction override ------------------------------------------------
alter table bca_transactions add column if not exists category_override text;

-- 3. Views -------------------------------------------------------------------
-- stg gains category_override. New columns must be appended to the end of the
-- select list, otherwise `create or replace view` refuses the change.
create or replace view stg_bca_transactions as
with raw_data as (
  select id, date, description, amount, type, created_at, category_override
  from bca_transactions
  where deleted_at is null
), cleaned as (
  select
    id,
    case
      when date ~ '^\d{4}-\d{2}-\d{2}$'        then date::date
      when date ~ '^\d{1,2}/\d{1,2}/\d{4}$'    then to_date(date, 'DD/MM/YYYY')
      when date ~ '^\d{1,2}/\d{1,2}$'          then to_date(date || '/2026', 'DD/MM/YYYY')
      else null
    end as transaction_date,
    trim(both from description) as description,
    amount,
    type as transaction_type,
    created_at,
    category_override
  from raw_data
)
select id, transaction_date, description, amount, transaction_type, created_at, category_override
from cleaned;

alter view stg_bca_transactions set (security_invoker = on);

-- int: unchanged apart from carrying category_override through and letting it
-- win over the keyword match. Column list and types are identical to before, so
-- dependent views (mart_daily_spending) keep working.
create or replace view int_bca_categorized as
with staging_data as (
  select id, transaction_date, description, amount, transaction_type, created_at, category_override
  from stg_bca_transactions
), mapping as (
  select id, keyword, category, created_at
  from merchant_mapping
), joined_data as (
  select s.id,
     s.transaction_date,
     s.description,
     s.amount,
     s.transaction_type,
     s.category_override,
     m.category,
     row_number() over (partition by s.id order by length(m.keyword) desc) as match_rank
  from staging_data s
    left join mapping m on s.description ilike ('%' || m.keyword || '%')
)
select id,
   transaction_date,
   description,
   amount,
   transaction_type,
   coalesce(category_override, category, 'Uncategorized'::text) as category
from joined_data
where match_rank = 1;

alter view int_bca_categorized set (security_invoker = on);
