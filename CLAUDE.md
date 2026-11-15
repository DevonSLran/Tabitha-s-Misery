# CLAUDE.md

Personal finance app for BCA bank transactions ("Tabitha's Misery"). Plain
HTML/JS + Tailwind on Supabase, wrapped for Android with Capacitor. See
README.md for features, release steps and signing. The design spec lives in
`design-kit/handoff/HANDOFF.md` (tokens, components, copy, per-screen rules).

## Commands

```bash
npm run build:css    # src/app.css → css/app.css (Tailwind CLI). Commit the output.
npm run watch:css    # same, on every change
npm test             # parser + connector core tests + RLS guard (hits the live project)
npm run sync:fn      # copy js/format.js into supabase/functions/_shared/tm/ (after changing it)
npm run check:rls    # RLS guard only: every table/view must return nothing to the anon key
npm run sync         # build:css, copy pages + css/ js/ fonts/ vendor/ into www/, cap sync android
npm run build:apk    # sync + signed release APK
bash scripts/fetch-fonts.sh   # re-download self-hosted fonts (after adding an icon)
```

GitHub Pages serves `main` from the repo root with **no build step**, so
`css/app.css` is committed and a push to `main` is a production deploy. Run
`npm run build:css` after touching any class in HTML, `js/` or `src/app.css`.

## Architecture

- **Every signed-in page** loads `vendor/supabase.min.js`, `js/format.js`,
  `js/app.js`, then its own script (`js/home.js`, `js/activity.js`, …) which
  calls `App.start({ tab | pushed, fab, init })`. `App.start` runs the auth
  gate, renders the chrome (header, bottom nav, sidebar, FAB, toast host) and
  then `init()`. `login.html` is the only page without a session (`js/login.js`).
- **`js/app.js` is shared runtime**: Supabase client, `store` + `load*()`,
  the shared month (`Month`, sessionStorage), `mountMonth()`, `ui.toast` /
  `ui.sheet` / `ui.confirm`, and the sheets used on several pages
  (transaction details, category picker, rule editor). Page-only UI lives in
  the page script.
- **`js/format.js` (`TM.*`)** formats every amount and date and splits bank
  strings into merchant + "via". Don't hand-format money or dates.
- **No `alert` / `confirm` / `prompt`.** Use `ui.toast`, `ui.sheet`,
  `ui.confirm`. Single-transaction deletes write the soft delete at once and
  offer Undo (restores `deleted_at = null`); `ui.confirm` is only for things
  undo can't fix.
- **Styling**: colours only from `css/tokens.css` via the Tailwind config
  (`bg-surface`, `text-muted`, `bg-ink text-on-ink`…; the default palette is
  removed). Dark mode is the same tokens under `prefers-color-scheme`. Shared
  components are `@layer components` classes in `src/app.css` (`.btn`,
  `.field`, `.chip`, `.tile`, `.tx-row`, `.sheet`, `.tab-bar`…).
  - Class names built at runtime (`pill--${key}`) are invisible to the
    Tailwind scanner — add them to `safelist` in `tailwind.config.js` or
    write them out literally.
  - Component class names must not collide with generated utilities. The
    config has custom spacing keys `nav`, `gutter`, `safe-t`, `safe-b`, so
    e.g. `.bottom-nav` silently became `bottom: var(--nav-h)` and lifted the
    nav off the screen.
- **Fonts and icons are self-hosted** in `fonts/` (offline APK).
  Material Symbols is a **subset**: an icon not listed in
  `scripts/fetch-fonts.sh` renders as its name in text. Add it there and to
  `ICON_SET` in `js/app.js`, then re-run the script.
- **Native-only code** is guarded with `isNative()` (secure storage, local
  notifications, Android back button). Keep a browser fallback.
- **Claude connectors.** The tools are in `supabase/functions/_shared/tm/`
  (`tools.mjs` + `core.mjs`, no imports, run on Node and Deno). Two servers
  use them:
  - `mcp/` is a local stdio server for Claude Code / Desktop, signed in with a
    session file. It has its own `package.json` and is never copied to `www/`.
  - `supabase/functions/mcp/` is the remote one for claude.ai, deployed with
    `--no-verify-jwt`. Sign-in is Supabase Auth's OAuth server with
    `oauth-consent.html` as the consent page.

  Both act as the user (anon key + the user's token), so RLS applies; never
  use the service-role key.
  - `core.mjs` mirrors `js/app.js` (`groupOf`, `activeLimit`, `ruleFor`,
    `budgetSummary`, constants) and the budget range in `js/budget.js`.
    **Change both together.** `core.test.mjs` checks the constants and that
    `_shared/tm/format.js` equals `js/format.js` (`npm run sync:fn`).
  - Write tools keep the app's payloads (positive `amount`, `type` DB/CR, soft
    deletes, the category rename/delete cascade).
- Charts are plain HTML/CSS (day bars, conic-gradient doughnut); there is no
  chart library.

## Data model (Supabase)

- `bca_transactions` (base table) → `stg_bca_transactions` (view) →
  `int_bca_categorized` (view, joins `merchant_mapping` keyword rules and
  `category_override`) → `mart_daily_spending`. **Reads go through
  `int_bca_categorized`; writes go to `bca_transactions`.** After a rule
  change, re-read the view rather than re-categorising in JS.
- Deletes are soft (`deleted_at`). The row must stay so the email importer still
  sees its `ref_no` and doesn't re-import it. The views filter deleted rows.
  `ref_no` is null for hand-added rows (that's how "Source" is shown).
- Other tables: `merchant_mapping` (keyword → category rules), `categories`
  (user-managed), `user_settings`, `budgets` (one row per budget group; `start_month` /
  `end_month`, with `9999-12` meaning "no end" because the column is NOT
  NULL). All have per-user RLS (`user_id = auth.uid()`).
- `user_settings` (one row per user, optional): `month_start_day` 1-28. A
  month key `YYYY-MM` means the month that starts on that day ("2026-11" with
  the 15th = 15 Nov to 14 Dec). Use `txMonth`, `thisMonth`, `monthProgress`,
  `monthTitle` and `TM.period*`, never `transaction_date.slice(0, 7)`.
  `calendarMonth()` is only for things that follow the bank (email import
  ranges). No row = the 1st. Mirrored in `core.mjs` (`periodOf`, `periodBounds`).
- Uncategorized expenses count toward no budget. Income has no category.
- Renaming/deleting a category also rewrites `merchant_mapping.category` and
  `bca_transactions.category_override` client-side (`js/rules.js`).
- Edge function `supabase/functions/import-bca-emails/` (Deno): `scan` reads
  Gmail over IMAP and parses with `parser.ts`; `import` inserts the rows the
  user selected, deduped per user by the unique `(user_id, ref_no)` index. Parser changes need a
  case in `parser.test.ts`.

## Rules for database changes

- **Never run `supabase config push`.** `supabase/config.toml` only lists the
  functions; pushing it would reset the live project's auth settings (Site URL,
  OAuth server). Change project settings in the dashboard.
- **Never run `supabase db push` without `--dry-run` first.** If the dry run
  lists more than the migration you just wrote, stop. The remote migration
  history is incomplete, and `20260613150000_stg_ref_no_and_wipe.sql` ends in
  `delete from bca_transactions;`. A blind push has already wiped live data
  once, and there are no backups. Prefer pasting a single reviewed migration
  into the Supabase SQL editor.
- **Every `create or replace view` must be followed by
  `alter view <name> set (security_invoker = on);`** Replacing a view resets
  its options, and without it the view bypasses RLS and leaks every user's rows
  to the public anon key. Run `npm run check:rls` afterwards.
- Changing a view's columns: `create or replace view` only allows appending
  columns at the end, so keep the existing select list order.

## UI rule

The mobile tab bar (`.tab-bar`) is fixed at z-index 40 and `--nav-h` tall.
Nothing actionable may sit in a fixed bar under it. The FAB and toasts float
16px above it (z 30 / 35); sheets (z 50) and dialogs (z 60) sit above it.
Pushed pages hide the tab bar and keep their main button in normal flow.

## Releasing

Bump `versionCode` (must increase) and `versionName` in
`android/app/build.gradle`, and `APP_VERSION` in `js/app.js`. Full steps are in
README.md.
