/* OAuth consent: Supabase Auth sends an app that wants access (Claude) here
 * with ?authorization_id=…. Sign in if needed, show who's asking and what it
 * can do, then approve or deny and follow the redirect Auth hands back.
 * Runs without App.start (no chrome), like login.html. */
'use strict';

(async function () {
    const host = qs('#consent');
    const id = new URLSearchParams(location.search).get('authorization_id');

    const done = (html) => { host.removeAttribute('aria-busy'); host.innerHTML = html; };
    const problem = (title, body) => done(`<div role="alert" class="banner banner--error">${icon('error')}<span class="flex-1 flex flex-col gap-1"><strong>${esc(title)}</strong><span>${esc(body)}</span></span></div>
        <p class="text-body-s text-text-2">Go back to the app that sent you here (like Claude) and connect again.</p>
        <a href="index.html" class="btn btn-secondary btn-lg">Open Tabitha's Misery</a>`);

    if (!id) { problem('This link is missing its request', "There's no sign-in request to answer."); return; }

    const { data: { session } } = await dbClient.auth.getSession();
    if (!session) {
        location.replace(`login.html?next=${encodeURIComponent(`oauth-consent.html?authorization_id=${id}`)}`);
        return;
    }

    let details;
    try {
        const { data, error } = await dbClient.auth.oauth.getAuthorizationDetails(id);
        if (error) throw error;
        details = data;
    } catch (e) {
        const msg = String(e && e.message || '');
        if (navigator.onLine === false) problem("You're offline", 'Connect to the internet and reload this page.');
        else if (/not.?found|expired|invalid/i.test(msg)) problem('This request has expired', 'Sign-in requests only last a few minutes.');
        else problem("Couldn't load this request", msg || 'Try again.');
        return;
    }

    // Already allowed before: Auth answers with where to go, not a new question.
    if (details && !details.authorization_id && details.redirect_url) {
        done(`<p class="text-body text-text-2" role="status">Already allowed. Taking you back…</p>`);
        location.replace(details.redirect_url);
        return;
    }

    const client = (details && details.client) || {};
    const name = client.name || 'An app';
    let returnHost = '';
    try { returnHost = new URL(details.redirect_uri).host; } catch (_) { /* shown without it */ }
    const email = (details.user && details.user.email) || session.user.email || '';
    // Anyone can register an app (dynamic registration is on), so only a return
    // address on Claude's own domains counts as Claude, whatever the name says.
    const isClaude = /(^|\.)claude\.(ai|com)$/i.test(returnHost);
    const posesAsClaude = !isClaude && /claude|anthropic/i.test(name);

    const can = [
        ['visibility', 'See your transactions, categories, rules and budgets'],
        ['edit', `Add, edit and delete transactions, and change categories, rules and budgets.${isClaude ? ' Claude is told to ask you before each change.' : ''}`],
        ['lock', "It can't see your Gmail, your app password or your sign-in password."],
    ];

    done(`<section class="card p-5 flex flex-col gap-4" aria-labelledby="consent-title">
            <div class="flex flex-col gap-1">
                <h1 id="consent-title" class="font-serif font-normal text-[28px] leading-[32px]">Allow ${esc(name)} to use your account?</h1>
                <p class="text-body-s text-text-2">Signed in as <strong class="font-semibold text-text">${esc(email)}</strong>.
                    <button type="button" class="link" data-switch-account>Not you?</button></p>
            </div>
            <span class="divider"></span>
            <ul class="flex flex-col gap-3">
                ${can.map(([ic, text]) => `<li class="flex gap-3 items-start text-body-s text-text-2">${icon(ic, 'text-[20px] text-muted mt-px')}<span>${esc(text)}</span></li>`).join('')}
            </ul>
            ${returnHost ? `<p class="text-label text-muted">After you choose, you go back to <span class="font-mono">${esc(returnHost)}</span>.</p>` : ''}
            ${isClaude ? '' : `<div role="alert" class="banner banner--warning">${icon('warning')}<span class="flex-1 flex flex-col gap-1">
                <strong>${posesAsClaude ? `This isn't the real Claude` : `This isn't Claude`}</strong>
                <span>${posesAsClaude ? `It calls itself ${esc(name)}, but` : 'This app'} would send you back to ${returnHost ? esc(returnHost) : 'an unknown address'}, not claude.ai. Don't allow it unless you set it up yourself just now.</span></span></div>`}
            <div id="consent-error" role="alert" class="banner banner--error" hidden></div>
            <div class="flex flex-col gap-2.5">
                <button type="button" class="btn ${isClaude ? 'btn-primary' : 'btn-secondary'} btn-lg" data-answer="approve">Allow</button>
                <button type="button" class="btn ${isClaude ? 'btn-secondary' : 'btn-primary'} btn-lg" data-answer="deny">Don't allow</button>
            </div>
        </section>
        <p class="text-label text-muted">You can disconnect it any time in the app: Account → Connected apps.</p>`);

    host.addEventListener('click', async (e) => {
        if (e.target.closest('[data-switch-account]')) {
            try { await dbClient.auth.signOut({ scope: 'local' }); } catch (_) { /* local sign-out is enough */ }
            location.replace(`login.html?next=${encodeURIComponent(`oauth-consent.html?authorization_id=${id}`)}`);
            return;
        }
        const btn = e.target.closest('[data-answer]');
        if (!btn) return;
        const approve = btn.dataset.answer === 'approve';
        qsa('[data-answer]', host).forEach(b => { b.disabled = true; });
        setBusy(btn, approve ? 'Allowing…' : 'Saying no…');
        const errEl = qs('#consent-error');
        errEl.hidden = true;
        try {
            const opts = { skipBrowserRedirect: true };
            const { data, error } = approve
                ? await dbClient.auth.oauth.approveAuthorization(id, opts)
                : await dbClient.auth.oauth.denyAuthorization(id, opts);
            if (error) throw error;
            if (!data || !data.redirect_url) throw new Error('No redirect came back.');
            done(`<p class="text-body text-text-2" role="status">${approve ? `Allowed. Taking you back to ${esc(name)}…` : `Not allowed. Taking you back to ${esc(name)}…`}</p>`);
            location.assign(data.redirect_url);
        } catch (err) {
            clearBusy(btn);
            qsa('[data-answer]', host).forEach(b => { b.disabled = false; });
            errEl.hidden = false;
            errEl.innerHTML = `${icon('error')}<span>${esc(errorMessage(err, approve ? 'allow access' : 'send your answer'))}</span>`;
        }
    });
})();
