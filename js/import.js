/* Import bank emails: connect Gmail, scan a date range, review, import. */
'use strict';

const imp = {
    step: 'connect',          // connect | scan | review | done
    scanning: false,
    user: '', hasPassword: false,
    from: `${shiftMonth(calendarMonth(), -1)}-01`, to: todayISO(), // dates, both included
    results: [],              // [{ ref, date, description, amount, type, alreadyImported, on, open }]
    error: null,              // { kind: 'scan-auth' | 'scan' | 'import' | 'not-connected', message }
    done: null,               // summary after an import
    importing: false,
};

const lastDayOf = (ym) => { const [y, m] = ym.split('-').map(Number); return isoOf(new Date(y, m, 0)); };
const minDate = (a, b) => (a < b ? a : b);

/** "1 Sep to 15 Oct 2026", "3 Oct 2026", "1 Dec 2025 to 15 Jan 2026" */
function rangeLabel() {
    if (imp.from === imp.to) return TM.dateLong(imp.from);
    const a = TM.dateLong(imp.from);
    return `${imp.from.slice(0, 4) === imp.to.slice(0, 4) ? a.replace(/ \d{4}$/, '') : a} to ${TM.dateLong(imp.to)}`;
}

/** Quick ranges for the scan step. Each ends today at the latest. */
function rangePresets() {
    const ym = calendarMonth(), today = todayISO(), prev = shiftMonth(ym, -1); // bank emails follow the calendar
    return [
        { key: 'this', label: 'This month', from: `${ym}-01`, to: today },
        { key: 'last', label: 'Last month', from: `${prev}-01`, to: minDate(lastDayOf(prev), today) },
        { key: 'three', label: 'Last 3 months', from: `${shiftMonth(ym, -2)}-01`, to: today },
    ];
}

async function callImportFn(body) {
    // Send the signed-in user's access token so the function stamps the right owner.
    const { data: { session } } = await dbClient.auth.getSession();
    const token = (session && session.access_token) || SUPABASE_ANON_KEY;
    const res = await fetch(IMPORT_FN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON_KEY,
            'x-import-secret': IMPORT_SECRET,
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return data;
}

function renderSteps() {
    const idx = { connect: 0, scan: 1, review: 2, done: 3 }[imp.step];
    qs('#steps').innerHTML = ['Connect', 'Scan', 'Review'].map((label, i) => {
        const done = i < idx, cur = i === idx;
        return `<li ${cur ? 'aria-current="step"' : ''} class="flex flex-col gap-1.5">
            <span class="h-1 rounded-full ${done ? 'bg-positive' : cur ? 'bg-text' : 'bg-line'}"></span>
            <span class="flex items-center gap-1 text-label ${done ? 'text-positive-text font-medium' : cur ? 'text-text font-semibold' : 'text-muted font-medium'}">${icon(done ? 'check_circle' : cur ? 'radio_button_checked' : 'radio_button_unchecked', 'text-[16px]')}${label}<span class="sr-only">${done ? ', done' : cur ? ', current step' : ''}</span></span>
        </li>`;
    }).join('');
}

function bannerHTML(kind, iconName, title, body, extra = '') {
    return `<div role="alert" class="banner banner--${kind}">${icon(iconName)}<span class="flex-1 flex flex-col gap-1"><strong>${esc(title)}</strong><span>${esc(body)}</span>${extra}</span></div>`;
}

function connectHTML() {
    return `<div class="flex flex-col gap-1">
            <h2 class="font-serif font-normal text-[26px] leading-[30px] md:text-[30px] md:leading-[34px]">Connect Gmail</h2>
            <p class="text-[15px] leading-[22px] text-text-2">BCA emails you a journal for every payment. We read those, and only those.</p>
        </div>
        <form id="connect-form" class="flex flex-col gap-4" novalidate>
            <div>
                <label for="gmail-user" class="field-label">Gmail address</label>
                <input id="gmail-user" type="email" class="field" value="${esc(imp.user)}" placeholder="you@gmail.com" autocomplete="email" inputmode="email" aria-describedby="gmail-user-help gmail-user-error">
                <span id="gmail-user-help" class="field-help">The Gmail that receives BCA's transaction emails.</span>
                <span id="gmail-user-error" class="field-error" hidden></span>
            </div>
            <div>
                <label for="gmail-pass" class="field-label">App password (16 letters)</label>
                <div class="field-wrap" id="gmail-pass-wrap">
                    <input id="gmail-pass" type="password" class="font-mono" autocomplete="off" spellcheck="false" placeholder="${imp.hasPassword ? 'Saved. Type a new one to replace it' : 'abcd efgh ijkl mnop'}" aria-describedby="gmail-pass-error">
                    <button type="button" class="icon-btn text-muted" id="pass-toggle" aria-label="Show password" aria-pressed="false">${icon('visibility', 'text-[22px]')}</button>
                </div>
                <span id="gmail-pass-error" class="field-error" hidden></span>
            </div>
            <details ${imp.hasPassword ? '' : 'open'} class="card-m !rounded-[14px] px-4 py-3.5">
                <summary class="text-body-s font-semibold cursor-pointer">How do I get an app password?</summary>
                <p class="mt-2.5 text-body-s text-text-2">An app password is a separate 16-letter password Google makes just for this app. It isn't your Gmail password. It takes about a minute.</p>
                <ol class="mt-2.5 pl-5 list-decimal text-body-s text-text-2 flex flex-col gap-2">
                    <li>Turn on 2-Step Verification for your Google account, if it isn't on already:
                        ${extLink('https://myaccount.google.com/signinoptions/two-step-verification', 'Open 2-Step Verification')}</li>
                    <li>Open the App passwords page and sign in with the same Gmail that gets your BCA emails:
                        ${extLink('https://myaccount.google.com/apppasswords', 'Open App passwords')}</li>
                    <li>Type a name, like <strong class="font-semibold text-text">Tabitha's Misery</strong>, then tap <strong class="font-semibold text-text">Create</strong>.</li>
                    <li>Google shows 16 letters, like <span class="font-mono text-label">abcd efgh ijkl mnop</span>. Copy them and paste them above. Spaces are fine.</li>
                </ol>
                <div class="mt-3 flex flex-col gap-1.5 text-label text-muted">
                    <span><strong class="font-semibold text-text-2">Lost it?</strong> Google only shows it once. Make a new one on the same page, and delete the old one there.</span>
                    <span><strong class="font-semibold text-text-2">No App passwords page?</strong> 2-Step Verification is still off, or it's a work or school account, or one with Advanced Protection. Those can't make app passwords.</span>
                </div>
            </details>
            <div class="flex gap-2 items-center text-label text-muted">${icon('lock', 'text-[18px]')}Stored on this device only.</div>
            <button type="submit" class="btn btn-primary btn-lg">Save and continue</button>
        </form>`;
}

/** Opens outside the app: a new tab in a browser, the phone's browser in the APK. */
function extLink(href, label) {
    return `<a href="${href}" target="_blank" rel="noopener" class="link flex w-fit items-center gap-0.5 mt-1">${esc(label)}${icon('north_east', 'text-[16px]')}</a>`;
}

function connectedRowHTML() {
    return `<div class="flex items-center gap-3 card-m !rounded-[14px] py-2.5 pr-2 pl-3.5">
        ${icon('check_circle', 'text-[22px] text-positive')}
        <span class="flex-1 min-w-0 flex flex-col"><span class="text-label text-muted">Connected</span><span class="text-[15px] font-medium truncate">${esc(imp.user)}</span></span>
        <button type="button" class="btn-text link text-body-s" data-go="connect">Change</button>
    </div>`;
}

function dateButtonHTML(id, label, value, invalid) {
    return `<div class="flex flex-col min-w-0">
        <label for="${id}-btn" class="field-label">${label}</label>
        <div class="relative">
            <button type="button" id="${id}-btn" class="field-button !px-3" data-date-range="${id}" ${invalid ? 'aria-invalid="true" aria-describedby="range-error"' : ''}><span class="whitespace-nowrap">${esc(TM.dateLong(value))}</span>${icon('calendar_today', 'text-[18px] text-muted')}</button>
            <input type="date" id="${id}" class="picker-input" tabindex="-1" aria-hidden="true" value="${value}" max="${todayISO()}">
        </div>
    </div>`;
}

function scanHTML() {
    const bad = imp.to < imp.from;
    let below = '';
    if (imp.scanning) {
        below = `<div role="status" class="card-m p-4 flex flex-col gap-3">
            <span class="font-serif text-[24px] leading-7">Reading your inbox…</span>
            <span class="text-body-s text-text-2">Looking for BCA journal emails from ${esc(rangeLabel())}. This usually takes 5 to 15 seconds.</span>
            <span class="block h-1.5 rounded-full bg-sunken overflow-hidden"><span class="block h-full w-2/5 rounded-full bg-accent tm-indeterminate"></span></span>
            <span class="text-caption text-muted">Keep the app open. Leaving this screen cancels the scan.</span>
        </div>`;
    } else if (imp.error && imp.error.kind === 'scan-auth') {
        below = bannerHTML('error', 'error', 'Scan failed', "Gmail didn't accept the app password. It may have been revoked.", '<button type="button" class="banner-link text-left" data-go="connect">Update app password</button>');
    } else if (imp.error && imp.error.kind === 'scan') {
        below = bannerHTML('error', navigator.onLine === false ? 'wifi_off' : 'error', 'Scan failed', imp.error.message);
    } else if (imp.error && imp.error.kind === 'not-connected') {
        below = bannerHTML('warning', 'key_off', 'Not connected yet', 'Add your Gmail address and app password before scanning.', '<button type="button" class="banner-link text-left" data-go="connect">Connect Gmail</button>');
    }
    return `${connectedRowHTML()}
        <div class="flex flex-col gap-3.5">
            <div class="flex flex-col gap-1">
                <h2 class="font-serif font-normal text-[26px] leading-[30px] md:text-[30px] md:leading-[34px]">Which dates?</h2>
                <p class="text-body-s text-text-2">Pick a range, or tap From and To to choose the days. Both days are included.</p>
            </div>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Quick ranges">
                ${rangePresets().map(p => `<button type="button" class="chip" data-preset="${p.key}" aria-pressed="${p.from === imp.from && p.to === imp.to}">${esc(p.label)}</button>`).join('')}
            </div>
            <div class="grid grid-cols-2 gap-3">
                ${dateButtonHTML('import-from', 'From', imp.from, false)}
                ${dateButtonHTML('import-to', 'To', imp.to, bad)}
            </div>
            ${bad ? `<div id="range-error" class="field-error -mt-1.5">${icon('error', 'text-[18px]')}“To” can't be earlier than “From”.</div>` : ''}
            <button type="button" class="btn ${imp.error && !imp.scanning ? 'btn-secondary' : 'btn-primary'} btn-lg" data-scan ${bad ? 'disabled' : ''}>${icon('search', 'text-[20px]')}Scan emails</button>
            ${below}
        </div>`;
}

function resultMeta(r) {
    if (r.alreadyImported) return `<span class="text-label">${esc(TM.dateShort(r.date))} · already imported</span>`;
    if (r.type === 'CR') return `<span class="text-label text-muted">${esc(TM.dateShort(r.date))} · income</span>`;
    const rule = ruleFor(r.description);
    return rule
        ? `<span class="text-label text-muted">${esc(TM.dateShort(r.date))} · → ${esc(rule.category)} (rule ${esc(rule.keyword)})</span>`
        : `<span class="text-label text-accent-text">${esc(TM.dateShort(r.date))} · no rule matches</span>`;
}

function resultCardHTML(r, i) {
    const title = TM.splitDescription(r.description).title || 'Untitled';
    const amount = `<span class="tx-amount ${r.type === 'CR' ? 'text-positive' : ''}">${esc(TM.rpSigned(r.amount, r.type))}</span>`;
    if (r.alreadyImported) {
        return `<article class="bg-sunken border border-dashed border-line-strong rounded-m p-3.5 flex gap-3 items-start text-muted">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-xs bg-line shrink-0 mt-0.5">${icon('lock', 'text-[16px]')}</span>
            <span class="flex-1 min-w-0 flex flex-col gap-0.5"><span class="text-title font-semibold">${esc(title)}</span>${resultMeta(r)}</span>
            ${amount.replace('text-positive', '')}
        </article>`;
    }
    return `<article class="bg-surface rounded-m p-3.5 flex flex-col gap-3 ${r.open ? 'border-[1.5px] border-ink' : 'border border-line'}">
        <div class="flex gap-3 items-start">
            <button type="button" role="checkbox" aria-checked="${r.on}" class="mt-0.5" data-toggle="${i}" aria-label="Include ${esc(title)}"><span class="check">${icon('check')}</span></button>
            <span class="flex-1 min-w-0 flex flex-col gap-0.5 items-start">
                <span class="text-title font-semibold">${esc(title)}</span>
                ${resultMeta(r)}
                ${r.open ? '' : `<button type="button" class="h-8 link text-label" data-edit="${i}" aria-expanded="false">Edit details</button>`}
            </span>
            ${amount}
        </div>
        ${r.open ? `<div class="flex flex-col gap-2.5 border-t border-sunken pt-3">
            <div>
                <label for="r${i}-desc" class="field-label !text-caption !text-text-2">Description</label>
                <input id="r${i}-desc" class="field !h-12 font-mono !text-label" value="${esc(r.description)}" data-field="description" data-i="${i}">
            </div>
            <div class="grid grid-cols-2 gap-2.5">
                <div class="min-w-0">
                    <label for="r${i}-date-btn" class="field-label !text-caption !text-text-2">Date</label>
                    <div class="relative">
                        <button type="button" id="r${i}-date-btn" class="field-button !h-12 !px-2.5 !text-[15px]" data-date-pick="${i}"><span class="whitespace-nowrap">${esc(TM.dateLong(r.date))}</span>${icon('calendar_today', 'text-[18px] text-muted')}</button>
                        <input type="date" class="picker-input" tabindex="-1" aria-hidden="true" value="${esc(r.date)}" data-field="date" data-i="${i}">
                    </div>
                </div>
                <div class="min-w-0">
                    <label for="r${i}-amount" class="field-label !text-caption !text-text-2">Amount (Rp)</label>
                    <input id="r${i}-amount" class="field !h-12 !text-[15px] text-right tnum" inputmode="numeric" value="${dots(r.amount)}" data-field="amount" data-i="${i}">
                </div>
            </div>
            <div class="seg seg--s grid-cols-2 !rounded-s" role="radiogroup" aria-label="Type">
                <button type="button" role="radio" aria-checked="${r.type === 'DB'}" data-type="DB" data-i="${i}">Expense</button>
                <button type="button" role="radio" aria-checked="${r.type === 'CR'}" data-type="CR" data-i="${i}">Income</button>
            </div>
            <button type="button" class="btn-text text-text-2 !h-9 text-body-s" data-edit="${i}" aria-expanded="true">${icon('expand_less', 'text-[18px]')}Done editing</button>
        </div>` : ''}
    </article>`;
}

function reviewHTML() {
    const fresh = imp.results.filter(r => !r.alreadyImported);
    const dup = imp.results.length - fresh.length;
    const chosen = fresh.filter(r => r.on).length;
    const head = `<div class="flex justify-between items-center gap-2 text-body-s">
            <span class="text-text-2">${esc(rangeLabel())}</span>
            <button type="button" class="link py-2.5" data-go="scan">Change dates</button>
        </div>`;
    if (!imp.results.length) {
        return `${head}<div class="empty">
            ${icon('move_to_inbox')}
            <h2>Nothing found.</h2>
            <p>No BCA journal emails from ${esc(rangeLabel())}. Try a wider range.</p>
            <div class="empty-actions"><button type="button" class="btn btn-primary" data-go="scan">Change dates</button></div>
        </div>`;
    }
    return `${head}
        <div class="flex flex-col gap-0.5">
            <h2 class="font-serif font-normal text-[26px] leading-[30px] md:text-[30px] md:leading-[34px]">Found ${imp.results.length}</h2>
            <span class="text-[15px] text-text-2">${fresh.length} new, ${dup} already imported</span>
        </div>
        ${fresh.length ? `<div class="flex justify-between items-center">
            <span class="text-label font-semibold text-text-2">${chosen} of ${fresh.length} selected</span>
            <button type="button" class="link text-body-s h-10" data-all>${chosen ? 'Deselect all' : 'Select all'}</button>
        </div>` : ''}
        ${imp.error && imp.error.kind === 'import' ? bannerHTML('error', navigator.onLine === false ? 'wifi_off' : 'error', 'Import failed', 'Nothing was saved. Your selection is kept, so you can try again.', '') : ''}
        ${imp.results.map(resultCardHTML).join('')}
        ${fresh.length ? `<button type="button" class="btn btn-primary btn-lg mt-1" data-import ${chosen ? '' : 'disabled'}>${icon('download', 'text-[20px]')}${chosen ? `Import ${chosen} selected` : 'Import 0 selected'}</button>` : ''}`;
}

function doneHTML() {
    const d = imp.done;
    const where = d.months.length === 1 ? `to ${monthName(d.months[0])}` : `across ${d.months.length} months`;
    const sortedLine = d.expenses ? ` Your rules sorted ${d.ruled === d.expenses ? (d.ruled === 1 ? 'it' : 'all of them') : `${d.ruled} of them`}.` : '';
    const leftLine = d.left ? ` ${d.left} still ${d.left === 1 ? 'needs' : 'need'} a category.` : '';
    return `<div role="status" class="flex flex-col items-center text-center gap-3 px-3 pt-10 pb-2">
        <span class="w-14 h-14 rounded-full bg-positive-soft text-positive grid place-items-center">${icon('check', 'text-[30px]')}</span>
        <h2 class="font-serif font-normal text-[30px] leading-[34px]">${d.imported} imported.</h2>
        <p class="text-[15px] leading-[22px] text-text-2 max-w-[300px] tnum">${esc(TM.rp(d.total))} added ${esc(where)}.${esc(sortedLine)}${esc(leftLine)}${d.skipped ? ` ${d.skipped} were already there.` : ''}</p>
        <div class="flex flex-col gap-2.5 w-full mt-3">
            ${d.left ? `<a href="categories.html#sort" class="btn btn-primary btn-lg">${icon('sell', 'text-[20px]')}Sort the ${d.left} now</a>` : ''}
            <a href="activity.html" class="btn ${d.left ? 'btn-secondary' : 'btn-primary'} btn-lg" data-see="${d.months[d.months.length - 1]}">See them in Activity</a>
            <button type="button" class="btn-text link text-body-s" data-go="scan">Scan other dates</button>
        </div>
    </div>`;
}

function render() {
    renderSteps();
    const host = qs('#import-content');
    host.innerHTML = imp.step === 'connect' ? connectHTML() : imp.step === 'scan' ? scanHTML() : imp.step === 'review' ? reviewHTML() : doneHTML();
    if (imp.step === 'connect') bindConnect();
    qsa('[data-field="amount"]', host).forEach(input => bindAmountInput(input, (v) => { imp.results[input.dataset.i].amount = v; }));
}

function bindConnect() {
    const userIn = qs('#gmail-user');
    const passIn = qs('#gmail-pass');
    const userErr = qs('#gmail-user-error');
    const passErr = qs('#gmail-pass-error');
    const setErr = (input, el, msg, wrap) => {
        (wrap || input).setAttribute('aria-invalid', msg ? 'true' : 'false');
        el.hidden = !msg;
        el.innerHTML = msg ? `${icon('error', 'text-[18px]')}${esc(msg)}` : '';
    };
    userIn.addEventListener('input', () => setErr(userIn, userErr, ''));
    passIn.addEventListener('input', () => setErr(passIn, passErr, '', qs('#gmail-pass-wrap')));
    qs('#pass-toggle').addEventListener('click', (e) => {
        const show = passIn.type === 'password';
        passIn.type = show ? 'text' : 'password';
        e.currentTarget.setAttribute('aria-pressed', String(show));
        e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        e.currentTarget.innerHTML = icon(show ? 'visibility_off' : 'visibility', 'text-[22px]');
    });
    qs('#connect-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = userIn.value.trim();
        const pass = passIn.value.replace(/\s+/g, '');
        let bad = false;
        if (!/^\S+@\S+\.\S+$/.test(user)) { setErr(userIn, userErr, 'Enter your Gmail address'); bad = true; }
        if (pass || !imp.hasPassword) {
            if (!/^[a-zA-Z]{16}$/.test(pass)) {
                setErr(passIn, passErr, pass ? `App passwords are 16 letters. This one has ${pass.replace(/[^a-zA-Z]/g, '').length}.` : 'Paste the 16-letter app password', qs('#gmail-pass-wrap'));
                bad = true;
            }
        }
        if (bad) return;
        await setSecureItem('gmail_user', user);
        if (pass) await setSecureItem('gmail_app_password', pass);
        imp.user = user;
        imp.hasPassword = true;
        imp.error = null;
        imp.step = 'scan';
        render();
    });
}

async function scan() {
    const user = imp.user || (await getSecureItem('gmail_user')) || '';
    const pass = ((await getSecureItem('gmail_app_password')) || '').replace(/\s+/g, '');
    if (!user || !pass) { imp.error = { kind: 'not-connected' }; render(); return; }
    imp.scanning = true;
    imp.error = null;
    render();
    const btn = qs('[data-scan]');
    setBusy(btn, 'Scanning…');
    try {
        // The function searches whole months; keep only the days picked.
        const data = await callImportFn({ action: 'scan', from: imp.from.slice(0, 7), to: imp.to.slice(0, 7), gmailUser: user, gmailPassword: pass });
        imp.results = (data.transactions || []).filter(t => t.date >= imp.from && t.date <= imp.to).map(t => ({ ...t, amount: Number(t.amount) || 0, on: !t.alreadyImported, open: false }));
        imp.step = 'review';
    } catch (e) {
        imp.error = e.status === 401 && /gmail/i.test(e.message)
            ? { kind: 'scan-auth' }
            : { kind: 'scan', message: navigator.onLine === false || e instanceof TypeError ? "Couldn't reach the server. Check your connection and try again." : e.message };
    } finally {
        imp.scanning = false;
        render();
    }
}

async function importSelected(btn) {
    const chosen = imp.results.filter(r => !r.alreadyImported && r.on);
    if (!chosen.length) return;
    setBusy(btn, 'Importing…');
    imp.error = null;
    try {
        const data = await callImportFn({ action: 'import', transactions: chosen.map(r => ({ ref: r.ref, date: r.date, description: r.description, amount: r.amount, type: r.type })) });
        const expenses = chosen.filter(r => r.type !== 'CR');
        const ruled = expenses.filter(r => ruleFor(r.description)).length;
        imp.done = {
            imported: data.imported != null ? data.imported : chosen.length,
            skipped: data.skipped || 0,
            total: sumAmounts(chosen),
            months: [...new Set(chosen.map(r => txMonth({ transaction_date: r.date })))].sort(), // budget months, for Activity
            expenses: expenses.length, ruled, left: expenses.length - ruled,
        };
        chosen.forEach(r => { r.alreadyImported = true; r.on = false; r.open = false; });
        imp.step = 'done';
        render();
        // Alert if this import pushed a budget over its limit.
        Promise.all([loadBudgets(), loadTransactions()]).then(checkSpendingAlerts).catch(() => {});
    } catch (e) {
        imp.error = { kind: 'import', message: e.message };
        render();
        const retry = qs('[data-import]');
        if (retry) retry.focus();
    }
}

App.start({
    pushed: { title: 'Import bank emails', back: 'index.html', narrow: true },
    async init() {
        const [user, pass] = await Promise.all([getSecureItem('gmail_user'), getSecureItem('gmail_app_password'), loadCategories(), loadRules()]);
        imp.user = user || '';
        imp.hasPassword = !!pass;
        imp.step = imp.user && imp.hasPassword ? 'scan' : 'connect';
        qs('#main').removeAttribute('aria-busy');
        render();

        const host = qs('#import-content');
        host.addEventListener('click', (e) => {
            const go = e.target.closest('[data-go]');
            if (go) { imp.step = go.dataset.go; imp.error = null; render(); return; }
            const rp = e.target.closest('[data-date-range]');
            if (rp) { openPicker(qs(`#${rp.dataset.dateRange}`)); return; }
            const pr = e.target.closest('[data-preset]');
            if (pr) { const p = rangePresets().find(x => x.key === pr.dataset.preset); imp.from = p.from; imp.to = p.to; imp.error = null; render(); qs(`[data-preset="${p.key}"]`)?.focus(); return; }
            if (e.target.closest('[data-scan]')) { scan(); return; }
            const tg = e.target.closest('[data-toggle]');
            if (tg) { const r = imp.results[tg.dataset.toggle]; r.on = !r.on; render(); return; }
            const ed = e.target.closest('[data-edit]');
            if (ed) { const r = imp.results[ed.dataset.edit]; r.open = !r.open; render(); qs(`#r${ed.dataset.edit}-desc`)?.focus(); return; }
            const ty = e.target.closest('[data-type]');
            if (ty) { imp.results[ty.dataset.i].type = ty.dataset.type; render(); return; }
            const dp = e.target.closest('[data-date-pick]');
            if (dp) { openPicker(qs(`[data-field="date"][data-i="${dp.dataset.datePick}"]`)); return; }
            if (e.target.closest('[data-all]')) {
                const fresh = imp.results.filter(r => !r.alreadyImported);
                const target = !fresh.some(r => r.on);
                fresh.forEach(r => { r.on = target; });
                render();
                return;
            }
            const imb = e.target.closest('[data-import]');
            if (imb) { importSelected(imb); return; }
            const see = e.target.closest('[data-see]');
            if (see) Month.set(see.dataset.see);
        });
        host.addEventListener('change', (e) => {
            const t = e.target;
            if (t.id === 'import-from' && t.value) { imp.from = t.value; imp.error = null; render(); }
            if (t.id === 'import-to' && t.value) { imp.to = t.value; imp.error = null; render(); }
            if (t.dataset.field === 'date' && t.value) { imp.results[t.dataset.i].date = t.value; render(); }
        });
        host.addEventListener('input', (e) => {
            const t = e.target;
            if (t.dataset.field === 'description') imp.results[t.dataset.i].description = t.value;
        });
        // Refresh titles and rule previews once the description field is left.
        host.addEventListener('focusout', (e) => { if (e.target.dataset && e.target.dataset.field === 'description') setTimeout(() => { if (!host.contains(document.activeElement) || !document.activeElement.dataset.field) render(); }, 0); });
    },
});
