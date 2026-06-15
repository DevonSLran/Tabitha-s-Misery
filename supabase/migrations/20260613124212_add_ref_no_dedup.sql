-- Dedup support for the BCA email importer.
-- Each myBCA "Internet Transaction Journal" email carries a unique
-- "Reference No." — store it so the same email never imports twice.

alter table bca_transactions
  add column if not exists ref_no text;

-- Plain (non-partial) unique index. NULLs are distinct by default, so manual /
-- legacy rows (ref_no IS NULL) are unaffected, while it stays compatible with
-- upsert's "ON CONFLICT (ref_no)" inference (a partial index cannot be inferred).
create unique index if not exists bca_transactions_ref_no_key
  on bca_transactions (ref_no);
