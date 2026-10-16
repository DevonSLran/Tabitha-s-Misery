/* Account: profile, password, connected apps, data export, budget alerts, sign out. */
'use strict';

function renderProfile() {
    const name = displayName();
    qs('#profile-initial').textContent = initialOf(name);
    qs('#profile-name').textContent = name;
    qs('#profile-email').textContent = store.user.email || '';
    qsa('.avatar').forEach(el => { if (el.id !== 'profile-initial' && el.textContent.length <= 1) el.textContent = initialOf(name); });
}

/** Sheet to set a new sign-in password. The session stays signed in. */
function openPasswordSheet() {
    const field = (id, label, autofocus) => `<div>
            <label for="${id}" class="field-label">${label}</label>
            <div class="field-wrap" id="${id}-wrap">
                <input id="${id}" type="password" autocomplete="new-password" aria-describedby="${id}-msg" ${autofocus ? 'autofocus' : ''}>
                <button type="button" class="icon-btn text-muted" data-reveal="${id}" aria-label="Show password" aria-pressed="false">${icon('visibility', 'text-[22px]')}</button>
            </div>
            <span id="${id}-msg" class="field-help">${id === 'pw-new' ? 'At least 8 characters.' : '&nbsp;'}</span>
        </div>`;
    ui.sheet.open({
        label: 'Change password',
        html: `<h2 class="sheet-title">Change password</h2>
            <p class="text-body-s text-text-2 -mt-1.5">You stay signed in here. Use the new password next time you sign in, on another device or in the Claude connector.</p>
            <form id="pw-form" class="flex flex-col gap-3" novalidate>
                ${field('pw-new', 'New password', true)}
                ${field('pw-again', 'Type it again')}
                <button type="submit" class="btn btn-primary btn-lg">Save password</button>
            </form>`,
        onOpen(sheet) {
            const pw = qs('#pw-new', sheet), again = qs('#pw-again', sheet);
            const setMsg = (input, msg, help) => {
                qs(`#${input.id}-wrap`, sheet).setAttribute('aria-invalid', msg ? 'true' : 'false');
                const el = qs(`#${input.id}-msg`, sheet);
                el.className = msg ? 'field-error' : 'field-help';
                el.innerHTML = msg ? `${icon('error', 'text-[18px]')}${esc(msg)}` : (help || '&nbsp;');
            };
            pw.addEventListener('input', () => setMsg(pw, '', 'At least 8 characters.'));
            again.addEventListener('input', () => setMsg(again, ''));
            sheet.addEventListener('click', (e) => {
                const b = e.target.closest('[data-reveal]');
                if (!b) return;
                const input = qs(`#${b.dataset.reveal}`, sheet);
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                b.setAttribute('aria-pressed', String(show));
                b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
                b.innerHTML = icon(show ? 'visibility_off' : 'visibility', 'text-[22px]');
            });
            qs('#pw-form', sheet).addEventListener('submit', async (e) => {
                e.preventDefault();
                if (pw.value.length < 8) { setMsg(pw, 'Use at least 8 characters.'); pw.focus(); return; }
                if (again.value !== pw.value) { setMsg(again, "The two passwords don't match."); again.focus(); return; }
                const btn = qs('[type="submit"]', sheet);
                setBusy(btn, 'Saving…');
                try {
                    const { error } = await dbClient.auth.updateUser({ password: pw.value });
                    if (error) throw error;
                    ui.sheet.close();
                    ui.toast('Password changed', { icon: 'check_circle' });
                } catch (err) {
                    clearBusy(btn);
                    if (/different from the old/i.test(err.message || '')) { setMsg(pw, "That's already your password. Pick a new one."); pw.focus(); return; }
                    ui.error(errorMessage(err, 'change your password'));
                }
            });
        },
    });
}

/** Apps allowed in through the OAuth consent page (e.g. Claude). */
let grants = null;
async function loadGrants() {
    const { data, error } = await dbClient.auth.oauth.listGrants();
    if (error) throw error;
    grants = (Array.isArray(data) ? data : (data && data.grants) || []).map(g => ({
        clientId: (g.client && g.client.id) || g.client_id,
        name: (g.client && (g.client.name || g.client.client_name)) || g.client_name || 'Unnamed app',
        since: g.granted_at || g.created_at || null,
    })).filter(g => g.clientId);
    const status = qs('#grants-status');
    status.textContent = !grants.length ? 'None yet' : grants.map(g => g.name).join(', ');
    return grants;
}

function openGrantsSheet() {
    const list = () => !grants || !grants.length
        ? `<p class="text-body-s text-text-2">No apps have access. When you connect Claude to Tabitha's Misery, it shows up here.</p>`
        : `<div class="list-card">${grants.map(g => `<div class="list-row">
                <span class="flex-1 min-w-0 flex flex-col"><span class="text-[15px] font-medium truncate">${esc(g.name)}</span>${g.since ? `<span class="text-label text-muted">Allowed ${esc(TM.dateLong(String(g.since).slice(0, 10)))}</span>` : ''}</span>
                <button type="button" class="btn btn-secondary !h-9 !text-negative text-body-s" data-revoke="${esc(g.clientId)}">Disconnect</button>
            </div>`).join('')}</div>
            <p class="text-label text-muted">Disconnecting signs the app out. It has to ask you again to get back in.</p>`;
    ui.sheet.open({
        label: 'Connected apps',
        html: `<h2 class="sheet-title">Connected apps</h2><div class="flex flex-col gap-3" data-grants>${list()}</div>`,
        onOpen(sheet) {
            sheet.addEventListener('click', async (e) => {
                const b = e.target.closest('[data-revoke]');
                if (!b) return;
                const g = grants.find(x => x.clientId === b.dataset.revoke);
                const ok = await ui.confirm({ title: `Disconnect ${g.name}?`, body: `${g.name} loses access to your data right away. You can connect it again later.`, confirmLabel: 'Disconnect' });
                if (!ok) return;
                setBusy(b, 'Disconnecting…');
                try {
                    const { error } = await dbClient.auth.oauth.revokeGrant({ clientId: g.clientId });
                    if (error) throw error;
                    await loadGrants();
                    qs('[data-grants]', sheet).innerHTML = list();
                    ui.toast(`Disconnected ${g.name}`, { icon: 'check_circle' });
                } catch (err) { clearBusy(b); ui.error(errorMessage(err, 'disconnect it')); }
            });
        },
    });
}

/** CSV of every transaction, as the categorised view sees them. */
async function exportCsv(btn) {
    const status = qs('#export-status');
    btn.disabled = true;
    status.textContent = 'Preparing the file…';
    try {
        const { data: rows, error } = await dbClient.from('int_bca_categorized').select('*');
        if (error) throw error;
        if (!rows || !rows.length) { ui.toast('Nothing to export yet'); return; }
        const headers = Object.keys(rows[0]);
        const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tabithas_Misery_${todayISO()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        ui.toast(`Exported ${TM.plural(rows.length, 'transaction')}`, { icon: 'check_circle' });
    } catch (e) {
        ui.error(errorMessage(e, 'export'), { action: 'Retry', onAction: () => exportCsv(btn) });
    } finally {
        btn.disabled = false;
        status.textContent = 'CSV file, every month';
    }
}

App.start({
    pushed: { title: 'Account', back: 'index.html', narrow: true, account: true },
    async init() {
        qs('#version').textContent = `Version ${APP_VERSION}`;
        renderProfile();

        // Display name: Save turns on when the value changes.
        const input = qs('#display-name');
        const save = qs('#name-save');
        input.value = displayName();
        input.addEventListener('input', () => { save.disabled = !input.value.trim() || input.value.trim() === displayName(); });
        qs('#name-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const next = input.value.trim();
            if (!next || next === displayName()) return;
            setBusy(save, 'Saving…');
            try {
                const { data, error } = await dbClient.auth.updateUser({ data: { display_name: next } });
                if (error) throw error;
                if (data && data.user) store.user = data.user;
                else store.user = { ...store.user, user_metadata: { ...store.user.user_metadata, display_name: next } };
                clearBusy(save);
                save.disabled = true;
                renderProfile();
                qsa('.sidebar .truncate').forEach(el => { if (el.classList.contains('font-semibold')) el.textContent = next; });
                ui.toast('Name saved', { icon: 'check_circle' });
            } catch (err) { clearBusy(save); ui.error(errorMessage(err, 'save your name')); }
        });

        getSecureItem('gmail_user').then(u => { if (u) qs('#import-status').textContent = `Connected as ${u}`; });
        Promise.all([loadCategories(), loadRules()]).then(() => {
            qs('#rules-status').textContent = `${TM.plural(store.categories.length, 'category', 'categories')} · ${TM.plural(store.rules.length, 'rule')}`;
        }).catch(() => { qs('#rules-status').textContent = 'Your categories and keyword rules'; });

        qs('#password-btn').addEventListener('click', openPasswordSheet);
        loadGrants().catch(() => { qs('#grants-status').textContent = "Couldn't load. Tap to try again."; });
        qs('#grants-btn').addEventListener('click', async () => {
            if (!grants) { try { await loadGrants(); } catch (err) { ui.error(errorMessage(err, 'load your connected apps')); return; } }
            openGrantsSheet();
        });

        const exportBtn = qs('#export-btn');
        exportBtn.addEventListener('click', () => exportCsv(exportBtn));

        // Budget alerts are Android-only (local notifications).
        if (isNative() && localNotifications()) {
            qs('#notif-section').hidden = false;
            const toggle = qs('#notif-toggle');
            toggle.checked = notificationsOn();
            toggle.addEventListener('change', async () => {
                if (toggle.checked) {
                    const granted = await requestNotificationPermission();
                    if (!granted) {
                        toggle.checked = false;
                        ui.error('Notifications are off for this app. Turn them on in Android settings, then try again.');
                        return;
                    }
                }
                setNotificationsOn(toggle.checked);
                ui.toast(toggle.checked ? "Budget alerts on. We'll tell you when one runs over." : 'Budget alerts off');
                if (toggle.checked) Promise.all([loadBudgets(), loadTransactions()]).then(checkSpendingAlerts).catch(() => {});
            });
        }

        qs('#sign-out').addEventListener('click', async () => {
            const ok = await ui.confirm({ title: 'Sign out?', body: 'Your Gmail app password stays on this device.', confirmLabel: 'Sign out', cancelLabel: 'Stay', destructive: false });
            if (!ok) return;
            try { await dbClient.auth.signOut(); } catch (_) { /* signing out locally is enough */ }
            location.replace('login.html');
        });
    },
});
