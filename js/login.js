/* Sign in / create account. The only page that runs without a session. */
'use strict';

(async function () {
    // ?next= sends you back after signing in (e.g. the OAuth consent page). Only
    // a page of this app is accepted, so the link can't bounce you elsewhere.
    const nextParam = new URLSearchParams(location.search).get('next') || '';
    const next = /^[a-z0-9-]+\.html(\?[^#\\]*)?$/i.test(nextParam) ? nextParam : 'index.html';

    const { data: { session } } = await dbClient.auth.getSession();
    if (session) { location.replace(next); return; }

    let mode = 'signin';
    const email = qs('#auth-email');
    const password = qs('#auth-password');
    const submit = qs('#auth-submit');
    const errorEl = qs('#auth-error');
    const help = qs('#password-help');

    const showError = (html) => {
        errorEl.hidden = !html;
        errorEl.innerHTML = html ? `${icon('error')}<span>${html}</span>` : '';
    };

    function applyMode() {
        const signup = mode === 'signup';
        qsa('[data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
        submit.textContent = signup ? 'Create account' : 'Sign in';
        password.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
        help.hidden = !signup;
        showError('');
    }

    qsa('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; applyMode(); }));
    errorEl.addEventListener('click', (e) => {
        const sw = e.target.closest('[data-switch]');
        if (sw) { mode = sw.dataset.switch; applyMode(); password.focus(); }
    });

    qs('#password-toggle').addEventListener('click', (e) => {
        const show = password.type === 'password';
        password.type = show ? 'text' : 'password';
        e.currentTarget.setAttribute('aria-pressed', String(show));
        e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        e.currentTarget.innerHTML = icon(show ? 'visibility_off' : 'visibility', 'text-[22px]');
    });

    qs('#auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const em = email.value.trim();
        const pw = password.value;
        if (!em || !pw) return showError('Enter your email and password.');
        if (mode === 'signup' && pw.length < 8) return showError('Use at least 8 characters for your password.');

        setBusy(submit, mode === 'signin' ? 'Signing in…' : 'Creating your account…');
        showError('');
        try {
            const { error } = mode === 'signin'
                ? await dbClient.auth.signInWithPassword({ email: em, password: pw })
                : await dbClient.auth.signUp({ email: em, password: pw }); // autoconfirm is on → signUp returns a session
            if (error) throw error;
            location.replace(next);
        } catch (err) {
            clearBusy(submit);
            const msg = String(err && err.message || '');
            if (/already registered|already exists/i.test(msg)) {
                showError('An account with this email already exists. <button type="button" class="banner-link" data-switch="signin">Sign in instead</button>');
            } else if (/invalid login credentials/i.test(msg)) {
                showError("That email and password don't match. Try again, or <button type=\"button\" class=\"banner-link\" data-switch=\"signup\">create an account</button>.");
            } else if (navigator.onLine === false) {
                showError("You're offline. Connect to the internet to sign in.");
            } else {
                showError(esc(msg || 'Something went wrong. Try again.'));
            }
        }
    });

    applyMode();
})();
