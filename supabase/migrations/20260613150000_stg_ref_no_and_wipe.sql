-- stg_bca_transactions and int_bca_categorized are VIEWS over the base table
-- bca_transactions (ref_no lives on that base table, added earlier).
--
-- The original stg view did: to_date(date || '/2026', 'DD/MM/YYYY') — it forced
-- the year to 2026 and only understood "DD/MM". Rewrite it to accept full ISO
-- dates (what the importer and manual Add now store) so any month/year is correct,
-- while still tolerating the old "DD/MM" rows.
create or replace view stg_bca_transactions as
with raw_data as (
  select id, date, description, amount, type, created_at
  from bca_transactions
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

-- DISABLED 2026-08-03. This line was a one-off "clear the test rows" step when
-- this migration was written in June. It is destructive and NOT idempotent: on
-- 2026-08-03 a `supabase db push` against a project whose schema_migrations
-- history was empty re-applied every migration, and this statement destroyed
-- 135 live transactions. There are no backups on this plan.
--
-- The wipe it performed is already done. Re-running it can only ever cause
-- data loss, so it stays commented out. Do not re-enable it.
--
-- delete from bca_transactions;
