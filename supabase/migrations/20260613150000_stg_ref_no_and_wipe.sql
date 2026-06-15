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

-- Fresh start: clear the base table (also empties both views, incl. test rows).
delete from bca_transactions;
