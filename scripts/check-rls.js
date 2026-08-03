// Guard against RLS regressions: every table and view must return NOTHING to an
// unauthenticated caller holding the public anon key.
//
// Run with:  node scripts/check-rls.js
//
// This exists because `create or replace view` silently resets view options,
// including security_invoker. A view that loses it runs with its owner's
// privileges and bypasses RLS on the underlying table — which once exposed every
// transaction in this project to anyone with the anon key (it ships in the repo
// and inside the Android APK, so it is public by design). Views that read from
// another view inherit the bypass, so setting security_invoker on the outer view
// is not enough.
//
// Run this after ANY migration that touches a view.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');

// Read the credentials from app.js so there's only one place to update them.
const url = appJs.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const key = appJs.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
if (!url || !key) {
  console.error('Could not read SUPABASE_URL / SUPABASE_ANON_KEY from app.js');
  process.exit(1);
}

const RELATIONS = [
  'bca_transactions',
  'stg_bca_transactions',
  'int_bca_categorized',
  'mart_daily_spending',
  'merchant_mapping',
  'budgets',
  'categories',
];

let failures = 0;

for (const rel of RELATIONS) {
  const res = await fetch(`${url}/rest/v1/${rel}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
  });

  // A missing relation is not a leak — report it and move on.
  if (res.status === 404 || res.status === 400) {
    console.log(`  --  ${rel} (not present, skipped)`);
    continue;
  }

  // Trust the body over the header: content-range reports "*" when the server
  // declines an exact count, which would otherwise read as zero and pass.
  const rows = await res.json().catch(() => []);
  const seen = Array.isArray(rows) ? rows.length : 0;
  const totalRaw = (res.headers.get('content-range') || '*/0').split('/')[1];
  const total = totalRaw === '*' ? seen : (Number(totalRaw) || 0);
  const leaked = Math.max(seen, total);

  if (leaked === 0) {
    console.log(`  ok  ${rel} — no rows visible anonymously`);
  } else {
    failures++;
    console.log(`FAIL  ${rel} — ${leaked} ROW(S) EXPOSED to anonymous callers`);
  }
}

console.log(failures === 0 ? '\nALL SAFE' : `\n${failures} RELATION(S) EXPOSED`);
process.exit(failures === 0 ? 0 : 1);
