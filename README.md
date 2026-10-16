# Tabitha's Misery

A personal finance dashboard for tracking and categorizing BCA bank account
transactions. Built as a web app and packaged as an Android app via
[Capacitor](https://capacitorjs.com/).

## Features

Four tabs, plus pages pushed from them:

- **Home** (`index.html`) – what the month has cost so far: total spent with a
  comparison to the same day last month, budget status, income and net, a
  day-by-day chart and the top categories.
- **Activity** (`activity.html`) – every transaction in the month, grouped by
  day, with search (merchant or amount) and filters (spent, income, unsorted,
  one category). Tap a row for details, to change its category, make a rule,
  edit or delete (with undo). A table with hover actions on desktop.
- **Budget** (`budget.html`) – monthly limits per budget group, with a "today"
  tick on every bar, what's left per day, and groups that have spending but no
  limit.
- **Rules** (`categories.html`) – sort this month's uncategorized expenses,
  manage keyword rules (with a live preview of what a keyword matches), and
  manage categories.
- **Add / edit transaction** (`add-transaction.html`, `?id=…` to edit) – with a
  calculator for splitting bills.
- **Spending by category** (`view-category.html`).
- **Import bank emails** (`import.html`) – connect Gmail, pick months, review and
  edit what was found, import the ones you select.
- **Account** (`account.html`) – display name, CSV export, budget alerts
  (Android), sign out.
- **Sign in** (`login.html`).

Light and dark themes follow the device setting.

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
- [x] **Delete a transaction** — remove a bad import or mistyped entry from the
      Activity list. Soft-deleted so the importer still recognises the
      reference number and doesn't re-add it on the next scan.
- [x] **Edit a transaction** — change the description, amount, date or
      expense/income type from Activity. Reuses the Add Transaction form in edit
      mode (`add-transaction.html?id=…`).
- [x] **Real display name** — shows the name set in Account throughout the app
      instead of the "Alex Morgan" placeholder.
- [x] **User-managed categories** — create, rename, delete and pick icons for
      your own categories instead of the fixed list; re-categorise an individual
      transaction from Activity; view, edit and delete keyword rules. Categories
      and rules share one Categorization page (`categories.html`).

- [x] **Redesign** — new visual identity (light + dark), a Rules tab for
      sorting uncategorized spending, search and filters in Activity, undo
      after deleting, rules created straight from a transaction, and no
      browser pop-ups. Spec in `design-kit/handoff/HANDOFF.md`.

### Next: Claude can use the app

- [x] **Phase 1 — local connector.** Claude Code and Claude Desktop can read
      and change your data through an MCP server that runs on your laptop,
      signed in as you. See [Use with Claude](#use-with-claude).
- [ ] **Phase 2 — remote connector.** The same tools as a Supabase edge
      function (`supabase/functions/mcp`) with OAuth sign-in, so it works in
      the Claude phone app and on claude.ai.
- [ ] **Phase 3 — ideas.** Recurring/subscription detection (and a tool for
      Claude to surface it); Gmail import from the connector.

## Tech Stack

- **Frontend**: plain HTML pages and small per-page scripts, styled with
  Tailwind CSS (built with the Tailwind CLI from `src/app.css`; colours come
  from the design tokens in `css/tokens.css`). [Supabase](https://supabase.com/)
  (`supabase-js`) for auth and data. Fonts (Instrument Serif, IBM Plex Sans and
  Mono, Material Symbols Rounded) are self-hosted so the app works offline.
- **Mobile**: [Capacitor](https://capacitorjs.com/) wraps the web app for Android (`android/`), with plugins for secure storage, local notifications, status bar, and app lifecycle.
- **Backend**: Supabase project (`supabase/`) with:
  - Postgres migrations defining tables, RLS policies, and the `int_bca_categorized` view for auto-categorized transactions.
  - An edge function, `import-bca-emails`, that connects to Gmail via IMAP, parses BCA transaction emails, and inserts new transactions (deduplicated by reference number).

## Project Structure

```
.
├── *.html              # One file per page (thin shells: labels + skeletons)
├── js/
│   ├── app.js          # Shared runtime: Supabase, data, chrome, toasts/sheets/dialogs
│   ├── format.js       # Money, date and bank-string formatting (TM.*)
│   └── <page>.js       # One script per page (home.js, activity.js, …)
├── src/app.css         # Tailwind input + shared component classes
├── css/
│   ├── app.css         # Tailwind build output (committed — Pages has no build step)
│   ├── tokens.css      # Colour, shadow and layout tokens, light + dark
│   └── fonts.css       # @font-face for the files in fonts/
├── fonts/              # Self-hosted woff2 (scripts/fetch-fonts.sh)
├── vendor/             # supabase-js, bundled for offline use
├── mcp/                # Local MCP connector for Claude Code/Desktop (own package.json)
├── design-kit/         # Redesign brief and the Claude Design handoff
├── capacitor.config.json
├── android/            # Generated Android (Capacitor) project
├── www/                # Build output copied into the Android app (generated, gitignored)
└── supabase/
    ├── config.toml
    ├── migrations/      # SQL migrations (schema, RLS, dedup logic)
    └── functions/
        ├── import-bca-emails/  # Edge function for importing BCA emails
        ├── mcp/                # Remote MCP connector for claude.ai (OAuth)
        └── _shared/tm/         # Connector tools + logic, shared with mcp/ (local)
```

## Development

### Web app

```bash
npm install
npm run watch:css     # rebuild css/app.css as you edit
python3 -m http.server 8000   # or any static file server
```

Open <http://localhost:8000/>. Commit `css/app.css` along with your changes.
If you use a new Material Symbols icon, add it to `scripts/fetch-fonts.sh`
(and `ICON_SET` in `js/app.js`) and run `bash scripts/fetch-fonts.sh`.

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
npm test            # parser unit tests + connector unit tests + RLS guard
npm run check:rls   # RLS guard on its own (hits the live project)
```

## Use with Claude

`mcp/` is an [MCP](https://modelcontextprotocol.io) server that lets Claude
Code and Claude Desktop read and change your data: month summaries, finding
transactions, adding/editing/deleting them, filing them under categories, and
managing rules, categories and budgets. It runs on your laptop and signs in as
you with the app's public anon key, so row-level security limits it to your
own rows, exactly like the phone app. Gmail import isn't available from it.

**Set up once:**

```bash
npm --prefix mcp install
npm --prefix mcp run login     # your app email + password; run it in a real terminal
```

Only the session is saved, never the password, in
`~/.config/tabithas-misery/mcp-session.json` (readable only by you).
`npm --prefix mcp run logout` removes it.

**Claude Code:** `.mcp.json` registers the server as `tabitha`. Start
`claude` in this folder, approve the project server when asked, and check
`/mcp`.

**Claude Desktop:** add this to `~/.config/Claude/claude_desktop_config.json`
(on macOS: `~/Library/Application Support/Claude/`), using absolute paths
(`which node` prints yours), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "tabitha": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/bca-finance-app/mcp/server.mjs"]
    }
  }
}
```

**Changes need your OK.** Claude is told to describe every change and wait for
your yes, and Claude Code / Claude Desktop also ask before each tool call. Allow
the read tools (`month_summary`, `list_*`, `get_transaction`) freely, but
don't add the write tools to an allow list, and pick "Allow once" for them in
Claude Desktop. Every write returns how to undo it; deleted transactions are
soft-deleted and `restore_transaction` brings them back.

### In claude.ai and the Claude phone app

The same tools run online as the `mcp` edge function, signed in through
Supabase Auth's OAuth server. Add it once in claude.ai (web): **Settings →
Connectors → Add custom connector**, URL
`https://oyexlcmrrhdvsqfbjoif.supabase.co/functions/v1/mcp`. Claude sends you to
`oauth-consent.html` on the web app: sign in, check it's you, and **Allow**. The
connector then also shows up in the Claude phone app. Revoke it any time in the
app under **Account → Connected apps**.

Project setup this needs (Supabase dashboard, once): **Authentication → OAuth
Server** on, with **Allow Dynamic OAuth Apps** on and **Authorization Path**
`/oauth-consent.html`; **Authentication → URL Configuration → Site URL**
`https://devonslran.github.io/Tabitha-s-Misery`. Deploy the function with
`npx supabase@2.118.0 functions deploy mcp --no-verify-jwt --project-ref oyexlcmrrhdvsqfbjoif`.
Never `supabase config push`: the local `config.toml` would reset the live auth
settings.

The tools live in `supabase/functions/_shared/tm/` and are shared by both
connectors. `core.mjs` there mirrors the app's summary and budget logic, and
`core.test.mjs` checks it (and that `format.js` there is an exact copy of
`js/format.js`; refresh it with `npm run sync:fn`).

## Deploying

### Web

The web app is served from GitHub Pages at
<https://devonslran.github.io/Tabitha-s-Misery/>, built from `main` at the repo
root. Pushing to `main` redeploys it; no build step runs.

Third-party libraries and fonts are bundled (`vendor/`, `fonts/`) rather than
loaded from a CDN, so the app works without a network after first load.

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
