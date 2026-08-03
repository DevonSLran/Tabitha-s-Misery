# Tabitha's Misery

A personal finance dashboard for tracking and categorizing BCA bank account
transactions. Built as a web app and packaged as an Android app via
[Capacitor](https://capacitorjs.com/).

## Features

- **Dashboard** (`index.html`) – overview of balances, spending, and recent activity.
- **Activity** (`activity.html`) – browse transaction history by month.
- **Budget** (`budget.html`) – track spending against budget categories.
- **Categories** (`view-category.html`) – view transactions grouped by category, with rule-based auto-categorization (`add-rule.html`).
- **Add Transaction** (`add-transaction.html`) – manually log a transaction.
- **Email Import** (`import.html`) – scan a Gmail inbox for BCA "Internet Transaction Journal" emails, preview parsed transactions, and import the ones you select.
- **Account** (`account.html`) – user/account settings, including an API key manager for market data.
- **Auth** (`login.html`) – sign in via Supabase.

## Roadmap

### Built

- [x] Dashboard with monthly spending chart and category breakdown
- [x] Activity list, grouped by day and navigable by month
- [x] Budgets per category group, with limits that can change month to month
- [x] Rule-based auto-categorisation from merchant keywords
- [x] Gmail import of BCA transaction emails, deduplicated by reference number
- [x] Manual transaction entry
- [x] Budget-overrun notifications (Android local notifications)
- [x] CSV export
- [x] Email/password auth with per-user row-level security
- [x] Offline-capable — all libraries bundled, no CDN calls
- [x] Signed Android release published to GitHub Releases

### Planned

- [ ] **Delete a transaction** — remove a bad import or mistyped entry from the
      Activity list. Soft-deleted so the importer still recognises the
      reference number and doesn't re-add it on the next scan.
- [ ] **User-managed categories** — create, rename, delete and pick icons for
      your own categories instead of the fixed list; re-categorise an individual
      transaction; view, edit and delete existing keyword rules.
- [ ] **Real display name** — show the name set in Account throughout the app
      instead of the "Alex Morgan" placeholder.

### Ideas

- [ ] Search and filter in Activity
- [ ] Undo for deleted transactions
- [ ] Recurring/subscription detection

## Tech Stack

- **Frontend**: Plain HTML/JS pages styled with Tailwind CSS, using [Supabase](https://supabase.com/) (`supabase-js`) for auth and data.
- **Mobile**: [Capacitor](https://capacitorjs.com/) wraps the web app for Android (`android/`), with plugins for secure storage, local notifications, status bar, and app lifecycle.
- **Backend**: Supabase project (`supabase/`) with:
  - Postgres migrations defining tables, RLS policies, and the `int_bca_categorized` view for auto-categorized transactions.
  - An edge function, `import-bca-emails`, that connects to Gmail via IMAP, parses BCA transaction emails, and inserts new transactions (deduplicated by reference number).

## Project Structure

```
.
├── *.html              # App pages (dashboard, activity, budget, etc.)
├── app.js              # Shared frontend logic and Supabase client
├── bottombar.html / sidebar.html  # Shared navigation partials
├── capacitor.config.json          # Capacitor app configuration
├── android/             # Generated Android (Capacitor) project
├── www/                 # Build output copied into the Android app (generated, gitignored)
└── supabase/
    ├── config.toml
    ├── migrations/      # SQL migrations (schema, RLS, dedup logic)
    └── functions/
        └── import-bca-emails/  # Edge function for importing BCA emails
```

## Development

### Web app

Open the HTML files directly in a browser, or serve the directory with any
static file server. `app.js` initializes the Supabase client and powers all
pages.

### Android app

```bash
npm install
npm run sync          # copy web assets into www/ and sync with the Android project
npm run open          # open the project in Android Studio
npm run build:android # build the Android app
```

### Supabase

The `supabase/` directory contains the database schema (migrations) and the
`import-bca-emails` edge function. Use the [Supabase CLI](https://supabase.com/docs/guides/cli)
to apply migrations and deploy functions to your project.

> **Redefining a view? Restate `security_invoker`.**
> `create or replace view` resets view options to their defaults. A view that
> loses `security_invoker = on` runs with its owner's privileges and bypasses
> RLS on the tables beneath it — exposing every user's rows to anyone holding
> the anon key, which is public by design (it ships in this repo and inside the
> APK). Views built on other views inherit the bypass, so setting the option on
> the outer view alone does not help.
>
> Every migration that redefines a view must end with:
> ```sql
> alter view <name> set (security_invoker = on);
> ```
> Then run `npm run check:rls` — it asserts that every table and view returns
> nothing to an unauthenticated caller, and exits non-zero if any leaks.

### Tests

```bash
npm test            # parser unit tests + RLS guard
npm run check:rls   # RLS guard on its own (hits the live project)
```

## Deploying

### Web

The web app is served from GitHub Pages at
<https://devonslran.github.io/Tabitha-s-Misery/>, built from `main` at the repo
root. Pushing to `main` redeploys it; no build step runs.

Third-party libraries are vendored in `vendor/` rather than loaded from a CDN,
so the app works without a network after first load.

### Releasing the Android app

**One-time setup.** Generate a signing keystore. Keep it outside the repo:

```bash
mkdir -p ~/.android-keystores
keytool -genkeypair -v \
  -keystore ~/.android-keystores/tabitha-release.jks \
  -alias tabitha \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype PKCS12
```

Then copy `android/keystore.properties.example` to
`android/keystore.properties` and fill in the passwords you just chose. Both the
`.jks` and `keystore.properties` are gitignored.

> **Back the `.jks` up somewhere off this machine.** It cannot be regenerated.
> Without it, Android treats a rebuilt app as a different app — existing users
> can't update, they'd have to uninstall and lose local state. Anyone who
> obtains it can publish updates as you.

**Each release:**

1. Bump `versionCode` (and usually `versionName`) in `android/app/build.gradle`.
   Android refuses to install an update whose `versionCode` isn't higher.
2. Build:
   ```bash
   npm run build:apk   # → android/app/build/outputs/apk/release/app-release.apk
   ```
   This runs `npm run sync` first, so the Android assets pick up any web changes.
   Use `npm run build:aab` instead if publishing to the Play Store.
3. Verify it's signed with your key, not the debug key:
   ```bash
   ~/Android/Sdk/build-tools/37.0.0/apksigner verify --print-certs \
     android/app/build/outputs/apk/release/app-release.apk
   ```
   The certificate must show your details — **not** `CN=Android Debug`.
4. Publish:
   ```bash
   gh release create v1.0 \
     android/app/build/outputs/apk/release/app-release.apk \
     --title "v1.0" --notes "First release"
   ```

Installing an APK from outside the Play Store requires enabling "install from
unknown sources" on the device.
