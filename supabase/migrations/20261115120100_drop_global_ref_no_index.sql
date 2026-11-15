-- Step 2 of 2: drop the global ref_no uniqueness.
--
-- Run only after 20261115120000_ref_no_unique_per_user.sql AND after
-- import-bca-emails is deployed with onConflict "user_id,ref_no". The old
-- function targets ON CONFLICT (ref_no), which errors once this index is gone.

drop index if exists bca_transactions_ref_no_key;
