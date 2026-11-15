-- Step 1 of 2: make the importer's dedup per user.
--
-- bca_transactions_ref_no_key is unique on ref_no across ALL users, and the
-- import function accepts any ref string from the client and skips conflicts
-- silently. So one user could insert another user's future BCA reference
-- number and that user's real import would be dropped.
--
-- This adds the per-user index the function's upsert now targets
-- (onConflict "user_id,ref_no"). It is safe to build while the old index
-- exists: the global index already rules out duplicate (user_id, ref_no)
-- pairs. NULL ref_no (hand-added rows) stays unconstrained as before.
--
-- Rollout order:
--   1. run this file
--   2. deploy import-bca-emails
--   3. run 20261115120100_drop_global_ref_no_index.sql
-- Between 2 and 3 a cross-user ref collision makes that import batch fail
-- with a unique violation instead of being skipped; keep the gap short.

create unique index if not exists bca_transactions_user_ref_no_key
  on bca_transactions (user_id, ref_no);
