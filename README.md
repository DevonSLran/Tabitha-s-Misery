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
