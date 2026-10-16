/* Supabase client for the connector, signed in as you.
 *
 * Uses the same public anon key as the app (read from js/app.js, like
 * scripts/check-rls.js), plus your own session, so RLS limits it to your rows.
 * Only the session is stored (never your password), in a file only you can read.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(join(root, 'js', 'app.js'), 'utf8');
export const SUPABASE_URL = appJs.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const SUPABASE_ANON_KEY = appJs.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)?.[1];
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Could not read SUPABASE_URL / SUPABASE_ANON_KEY from js/app.js');

// js/format.js is a plain browser script that sets globalThis.TM.
createRequire(import.meta.url)(join(root, 'js', 'format.js'));
export const TM = globalThis.TM;

const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
export const SESSION_FILE = process.env.TM_SESSION_FILE || join(configHome, 'tabithas-misery', 'mcp-session.json');

function readStore() {
    try { return JSON.parse(readFileSync(SESSION_FILE, 'utf8')); } catch { return {}; }
}
function writeStore(obj) {
    mkdirSync(dirname(SESSION_FILE), { recursive: true, mode: 0o700 });
    writeFileSync(SESSION_FILE, JSON.stringify(obj), { mode: 0o600 });
    chmodSync(SESSION_FILE, 0o600);
}

// supabase-js storage adapter backed by the session file. Refresh tokens
// rotate, so every refresh writes the new session back.
const fileStorage = {
    getItem: (k) => readStore()[k] ?? null,
    setItem: (k, v) => { const s = readStore(); s[k] = v; writeStore(s); },
    removeItem: (k) => { const s = readStore(); delete s[k]; Object.keys(s).length ? writeStore(s) : clearSession(); },
};

export function clearSession() {
    if (existsSync(SESSION_FILE)) rmSync(SESSION_FILE);
}

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: fileStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export class NotSignedIn extends Error {
    constructor() { super('Not signed in. Run `npm --prefix mcp run login` in the bca-finance-app folder first.'); this.name = 'NotSignedIn'; }
}

/** The signed-in user, refreshing the session if needed. Throws NotSignedIn. */
export async function currentUser() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new NotSignedIn();
    return session.user;
}
