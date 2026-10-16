/* Sign the connector in as you (once), or out with --logout.
 *
 *   npm --prefix mcp run login
 *   npm --prefix mcp run logout
 *
 * Your password goes to Supabase only; what's saved is the session, in a file
 * only your user can read.
 */
import { createInterface } from 'node:readline';
import { db, clearSession, SESSION_FILE } from './db.mjs';

async function main() {
    if (process.argv.includes('--logout')) {
        await db.auth.signOut({ scope: 'local' }).catch(() => {});
        clearSession();
        console.log('Signed out. The connector can no longer reach your data.');
        return;
    }

    const email = process.env.TM_EMAIL || await ask('Email: ');
    const password = process.env.TM_PASSWORD || await ask('Password: ', { hidden: true });
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { console.error(`Couldn't sign in: ${error.message}`); process.exitCode = 1; return; }
    const name = data.user.user_metadata?.display_name || data.user.email;
    console.log(`Signed in as ${name}. Session saved to ${SESSION_FILE}.`);
}

function ask(question, { hidden = false } = {}) {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        if (hidden) {
            // Echo nothing while the password is typed.
            rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(question); };
        }
        rl.question(question, (answer) => {
            rl.close();
            if (hidden) process.stdout.write('\n');
            resolve(answer);
        });
    });
}

main().finally(() => { db.auth.stopAutoRefresh(); });
