# Tabitha's Misery

A personal finance dashboard for tracking and categorizing BCA bank account
transactions. Built as a web app and packaged as an Android app via
[Capacitor](https://capacitorjs.com/).

## Features

- **Dashboard** (`index.html`) – overview of balances, spending, and recent activity.
- **Activity** (`activity.html`) – browse and search transaction history.
- **Budget** (`budget.html`) – track spending against budget categories.
- **Categories** (`view-category.html`) – view transactions grouped by category, with rule-based auto-categorization (`add-rule.html`).
- **Add Transaction** (`add-transaction.html`) – manually log a transaction.
- **Email Import** (`import.html`) – scan a Gmail inbox for BCA "Internet Transaction Journal" emails, preview parsed transactions, and import the ones you select.
- **Account** (`account.html`) – user/account settings, including an API key manager for market data.
- **Auth** (`login.html`) – sign in via Supabase.

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
