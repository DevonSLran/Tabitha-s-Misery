-- Soft delete for transactions.
--
-- Why not a plain DELETE: the email importer builds its dedup set from
--   select ref_no from bca_transactions
-- (supabase/functions/import-bca-emails/index.ts). Hard-deleting a row removes
-- its ref_no from that set, so the next Gmail scan re-imports the transaction
-- and the deletion silently undoes itself. Keeping the row with deleted_at set
-- means the importer still recognises the ref_no and skips it, while every view
-- hides it from the app.
alter table bca_transactions add column if not exists deleted_at timestamptz;

-- Most queries only ever want live rows for one user.
create index if not exists bca_transactions_active_idx
  on bca_transactions (user_id) where deleted_at is null;

-- Re-declare stg with the deleted rows filtered out. Identical to the previous
-- definition (20260613150000) apart from the where clause in raw_data.
-- int_bca_categorized is built on top of this view, so it inherits the filter
-- and needs no change of its own.
create or replace view stg_bca_transactions as
with raw_data as (
  select id, date, description, amount, type, created_at
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
    created_at
  from raw_data
)
select id, transaction_date, description, amount, transaction_type, created_at
from cleaned;

-- CRITICAL: create or replace view resets view options to their defaults, so
-- security_invoker must be restated every time this view is redefined. Without
-- it the view runs with its owner's privileges and bypasses RLS on
-- bca_transactions — which leaks every user's transactions to anyone holding the
-- (public) anon key, including through int_bca_categorized and
-- mart_daily_spending, which read from this view. Setting it on those two is
-- not enough; the bypass happens here.
alter view stg_bca_transactions set (security_invoker = on);
