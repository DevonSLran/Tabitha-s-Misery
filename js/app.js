/* Tabitha's Misery — shared runtime.
 *
 * Loaded on every page after vendor/supabase.min.js and js/format.js. Each page
 * then loads its own script (js/home.js, js/activity.js, …), which calls
 * App.start({ tab | pushed, init }). This file owns:
 *   - the Supabase client, auth gate and data loading (`store`)
 *   - the shared month (sessionStorage) and month switcher
 *   - page chrome: header, bottom nav, sidebar, floating Add button
 *   - the UI kit: ui.toast, ui.sheet, ui.confirm (no alert/confirm/prompt)
 *   - sheets used on more than one page: transaction details, category
 *     picker, rule editor
 */
'use strict';

// --- CONFIG ---
// The anon key is public by design (it ships in the APK). RLS is what protects
// the data — see scripts/check-rls.js.
const SUPABASE_URL = 'https://oyexlcmrrhdvsqfbjoif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95ZXhsY21ycmhkdnNxZmJqb2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODg1NDEsImV4cCI6MjA5MTk2NDU0MX0.25ET5EiQGGyF5WpoM2nv0zYLdrg7x9WimMP9PU77r0Y';
const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const IMPORT_FN_URL = `${SUPABASE_URL}/functions/v1/import-bca-emails`;
// Shared secret sent as x-import-secret; the function rejects callers without it
// once IMPORT_SHARED_SECRET is set in the function's env.
const IMPORT_SECRET = 'n6XUP3iN4vljR31iaZytgQN_1AyvchAw';

// Keep in step with versionName in android/app/build.gradle.
const APP_VERSION = '1.2';

const UNCATEGORIZED = 'Uncategorized';
// budgets.end_month is NOT NULL; this sentinel means "no end".
const NO_END = '9999-12';

// The six fixed budget groups. Each user category counts toward one of them.
const BUDGET_GROUPS = {
    FOOD:          { label: 'Food & Dining',     icon: 'restaurant',     cat: 'food' },
    TRANSPORT:     { label: 'Transport',         icon: 'directions_car', cat: 'transport' },
    ENTERTAINMENT: { label: 'Entertainment',     icon: 'movie',          cat: 'entertainment' },
    SHOPPING:      { label: 'Shopping',          icon: 'local_mall',     cat: 'shopping' },
    BILLS:         { label: 'Bills & Utilities', icon: 'receipt_long',   cat: 'bills' },
    OTHER:         { label: 'Other',             icon: 'category',       cat: null },
};
const GROUP_KEYS = Object.keys(BUDGET_GROUPS);

// Category colours cycle through these by sort_order (see css/tokens.css).
const CAT_TOKENS = ['food', 'transport', 'health', 'utilities', 'entertainment', 'shopping', 'bills'];
// The icons offered when creating a category.
const CATEGORY_ICONS = ['restaurant', 'directions_car', 'favorite', 'bolt', 'movie', 'local_mall', 'receipt_long', 'shopping_cart', 'home', 'school', 'pets', 'flight'];
// Every icon in the bundled (subset) font — see scripts/fetch-fonts.sh. Category
// icons outside this set fall back to `category` instead of rendering as text.
const ICON_SET = new Set('account_balance_wallet add arrow_back arrow_forward backspace bolt calculate calendar_today category check check_circle chevron_left chevron_right close delete directions_car donut_large download edit error expand_less expand_more favorite flight home info key_off label_off link local_mall lock logout mail more_horiz move_to_inbox movie north_east notifications payments pets radio_button_checked radio_button_unchecked receipt_long refresh remove restaurant rule school search sell sentiment_calm shopping_cart south_east south_west sync undo visibility visibility_off warning wifi_off'.split(' '));

// Seeded on a user's first load so new signups and existing accounts take the
// same path — no trigger on auth.users.
const DEFAULT_CATEGORIES = [
    { name: 'Food & Dining',     icon: 'restaurant',     budget_group: 'FOOD',          sort_order: 1 },
    { name: 'Transportation',    icon: 'directions_car', budget_group: 'TRANSPORT',     sort_order: 2 },
    { name: 'Health & Wellness', icon: 'favorite',       budget_group: 'OTHER',         sort_order: 3 },
    { name: 'Utilities',         icon: 'bolt',           budget_group: 'BILLS',         sort_order: 4 },
    { name: 'Entertainment',     icon: 'movie',          budget_group: 'ENTERTAINMENT', sort_order: 5 },
    { name: 'Shopping',          icon: 'local_mall',     budget_group: 'SHOPPING',      sort_order: 6 },
    { name: 'Bills',             icon: 'receipt_long',   budget_group: 'BILLS',         sort_order: 7 },
];

// --- SMALL HELPERS ---
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const icon = (name, cls = '') => `<span class="ms ${cls}" aria-hidden="true">${esc(name)}</span>`;
const safeIcon = (name) => (ICON_SET.has(name) ? name : 'category');

/** 1250000 -> "1.250.000" (no "Rp"), for amount inputs. */
const dots = (n) => String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** "1.250.000" / "Rp 1,250,000" -> 1250000 */
const parseAmount = (s) => parseInt(String(s || '').replace(/\D/g, ''), 10) || 0;

const pad2 = (n) => String(n).padStart(2, '0');
const ymOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const isoOf = (d) => `${ymOf(d)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());
function shiftMonth(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    return ymOf(new Date(y, m - 1 + n, 1));
}

// --- MONTH START DAY ---
// A budget month can start on any day 1-28 (user_settings.month_start_day),
// e.g. the 15th to match when money comes in. A month key "YYYY-MM" then means
// the month that starts on that day: "2026-11" with the 15th is 15 Nov - 14 Dec.
// Cached in localStorage so the first paint already uses it; loadSettings()
// refreshes it. core.mjs mirrors this for the connector.
const START_DAY_KEY = 'tm.monthStartDay';
function monthStartDay() {
    if (store.startDay) return store.startDay;
    try { return TM.startDay(localStorage.getItem(START_DAY_KEY)); } catch (_) { return 1; }
}
function rememberStartDay(day) {
    store.startDay = TM.startDay(day);
    try { localStorage.setItem(START_DAY_KEY, String(store.startDay)); } catch (_) { /* private mode */ }
}

/** The calendar month today is in. Use for things that follow the bank, like email import ranges. */
const calendarMonth = () => ymOf(new Date());
/** The budget month today counts toward. */
const thisMonth = () => TM.periodOf(todayISO(), monthStartDay());
/** "October", or "15 Oct – 14 Nov" when months start later than the 1st. */
const monthName = (ym) => TM.periodName(ym, monthStartDay());
/** "October 2026", or "15 Oct – 14 Nov 2026". */
const monthTitle = (ym) => TM.periodLabel(ym, monthStartDay());
const monthAbbr = (ym) => TM.monthShort(ym).split(' ')[0]; // "Oct" (calendar)
const monthProgress = (ym) => TM.monthProgress(ym, null, monthStartDay());
const monthBounds = (ym) => TM.periodBounds(ym, monthStartDay());
/** 1-based day of month `ym` that a transaction falls on. */
const dayInMonth = (t, ym) => TM.periodDayIndex(t.transaction_date, ym, monthStartDay()) + 1;

const isIncome = (t) => t.transaction_type === 'CR';
const isUnsorted = (t) => !isIncome(t) && (!t.category || t.category === UNCATEGORIZED);
const txMonth = (t) => TM.periodOf(t.transaction_date, monthStartDay());
const sumAmounts = (list) => list.reduce((s, t) => s + Number(t.amount || 0), 0);
const titleOf = (t) => TM.splitDescription(t.description).title || 'Untitled';

function isNative() { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }

// --- DATA ---
const store = { user: null, categories: [], rules: [], budgets: {}, txns: [], startDay: null };

function displayName(user = store.user) {
    if (!user) return '';
    const meta = user.user_metadata && user.user_metadata.display_name;
    return meta || (user.email || '').split('@')[0];
}
const initialOf = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase();

async function loadCategories() {
    const { data, error } = await dbClient.from('categories')
        .select('id, name, icon, budget_group, sort_order').order('sort_order');
    if (error) throw error;
    if (data.length) { store.categories = data; return data; }
    // First load for this user — seed the defaults.
    const { data: seeded, error: seedErr } = await dbClient.from('categories')
        .insert(DEFAULT_CATEGORIES).select('id, name, icon, budget_group, sort_order');
    if (seedErr) throw seedErr;
    store.categories = seeded || [];
    return store.categories;
}

async function loadRules() {
    const { data, error } = await dbClient.from('merchant_mapping').select('id, keyword, category').order('keyword');
    if (error) throw error;
    store.rules = data || [];
    return store.rules;
}

async function loadBudgets() {
    const { data, error } = await dbClient.from('budgets').select('grp, amount, start_month, end_month');
    if (error) throw error;
    const map = {};
    (data || []).forEach(r => { map[r.grp] = { amount: Number(r.amount), start: r.start_month, end: r.end_month || r.start_month }; });
    store.budgets = map;
    return map;
}

/** The user's settings row. A missing row (or the table not created yet) means months start on the 1st. */
async function loadSettings() {
    const { data, error } = await dbClient.from('user_settings').select('month_start_day').maybeSingle();
    if (error) {
        console.warn('Settings unavailable, using the cached month start day:', error.message);
        return monthStartDay();
    }
    rememberStartDay(data ? data.month_start_day : 1);
    return store.startDay;
}

async function saveMonthStartDay(day) {
    const d = TM.startDay(day);
    const { error } = await dbClient.from('user_settings').upsert({ month_start_day: d }, { onConflict: 'user_id' });
    if (error) throw error;
    rememberStartDay(d);
    Month.set(thisMonth()); // the old month key may now mean different dates
    return d;
}

async function loadTransactions() {
    const { data, error } = await dbClient.from('int_bca_categorized')
        .select('id, transaction_date, description, amount, transaction_type, category');
    if (error) throw error;
    store.txns = (data || [])
        .filter(t => t.transaction_date)
        .map(t => ({ ...t, amount: Number(t.amount) || 0 }))
        .sort((a, b) => (b.transaction_date.localeCompare(a.transaction_date)) || (Number(b.id) - Number(a.id)));
    return store.txns;
}

const findCategory = (name) => store.categories.find(c => c.name === name) || null;

/** Icon + colour token for a category name. Uncategorized is "none" (dashed). */
function categoryVisual(name) {
    if (!name || name === UNCATEGORIZED) return { icon: 'label_off', none: true };
    const c = findCategory(name);
    if (!c) return { icon: 'category', token: 'bills' };
    const i = Math.max(0, (Number(c.sort_order) || 1) - 1) % CAT_TOKENS.length;
    return { icon: safeIcon(c.icon), token: CAT_TOKENS[i] };
}

/** Category tile. size: '' | 'tile--s' | 'tile--xs' | 'tile--lg' */
function tileHTML(name, size = '') {
    const v = categoryVisual(name);
    if (v.none) return `<span class="tile cat-tile--none ${size}">${icon('label_off')}</span>`;
    return `<span class="tile cat-tile ${size}" style="--cat: var(--cat-${v.token})">${icon(v.icon)}</span>`;
}
function txTileHTML(t, size = '') {
    if (isIncome(t)) return `<span class="tile tile--income ${size}">${icon('south_west')}</span>`;
    return tileHTML(t.category, size);
}
function groupTileHTML(group, size = '') {
    const g = BUDGET_GROUPS[group];
    if (!g || !g.cat) return `<span class="tile tile--group-none ${size}">${icon('category')}</span>`;
    return `<span class="tile cat-tile ${size}" style="--cat: var(--cat-${g.cat})">${icon(g.icon)}</span>`;
}

/** The budget group a category counts toward. Uncategorized counts toward none. */
function groupOf(categoryName) {
    if (!categoryName || categoryName === UNCATEGORIZED) return null;
    const c = findCategory(categoryName);
    return c && BUDGET_GROUPS[c.budget_group] ? c.budget_group : 'OTHER';
}
const categoriesInGroup = (group) => store.categories.filter(c => (BUDGET_GROUPS[c.budget_group] ? c.budget_group : 'OTHER') === group);

/** The monthly limit that applies to `group` in month `ym`, or 0. */
function activeLimit(group, ym) {
    const b = store.budgets[group];
    if (!b) return 0;
    return ym >= b.start && ym <= b.end ? b.amount : 0;
}

/** The rule that would categorise `description`: longest matching keyword wins. */
function ruleFor(description) {
    const d = String(description || '').toUpperCase();
    let best = null;
    store.rules.forEach(r => {
        const k = String(r.keyword || '').toUpperCase();
        if (k && d.includes(k) && (!best || k.length > best.keyword.length)) best = { ...r, keyword: k };
    });
    return best;
}
const ruleByKeyword = (kw) => store.rules.find(r => String(r.keyword).toUpperCase() === String(kw).toUpperCase()) || null;

const expensesIn = (ym) => store.txns.filter(t => txMonth(t) === ym && !isIncome(t));
const incomeIn = (ym) => store.txns.filter(t => txMonth(t) === ym && isIncome(t));
const unsortedIn = (ym) => expensesIn(ym).filter(isUnsorted);

/** Per-group spending and limits for one month. */
function budgetSummary(ym) {
    const spentBy = {};
    expensesIn(ym).forEach(t => {
        const g = groupOf(t.category);
        if (g) spentBy[g] = (spentBy[g] || 0) + t.amount;
    });
    const groups = GROUP_KEYS.map(key => ({ key, ...BUDGET_GROUPS[key], spent: spentBy[key] || 0, limit: activeLimit(key, ym) }));
    const budgeted = groups.filter(g => g.limit > 0);
    return {
        groups, budgeted,
        unbudgeted: groups.filter(g => !g.limit && g.spent > 0),
        spent: budgeted.reduce((s, g) => s + g.spent, 0),
        limit: budgeted.reduce((s, g) => s + g.limit, 0),
    };
}

// --- WRITES ---
async function softDeleteTransaction(id) {
    // Soft delete keeps the row, so the importer's ref_no dedup still
    // recognises it and won't re-add it on the next scan.
    const { error } = await dbClient.from('bca_transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
}
async function restoreTransaction(id) {
    const { error } = await dbClient.from('bca_transactions').update({ deleted_at: null }).eq('id', id);
    if (error) throw error;
}
/** category_override wins over the keyword rules in int_bca_categorized. null = let rules decide. */
async function setCategoryOverride(id, category) {
    const { error } = await dbClient.from('bca_transactions').update({ category_override: category }).eq('id', id);
    if (error) throw error;
}
async function saveRule({ id, keyword, category }) {
    const row = { keyword: String(keyword).toUpperCase().trim(), category };
    const q = id ? dbClient.from('merchant_mapping').update(row).eq('id', id).select('id, keyword, category')
                 : dbClient.from('merchant_mapping').insert([row]).select('id, keyword, category');
    const { data, error } = await q;
    if (error) throw error;
    const saved = data && data[0] ? data[0] : { id, ...row };
    store.rules = store.rules.filter(r => String(r.id) !== String(saved.id)).concat(saved)
        .sort((a, b) => a.keyword.localeCompare(b.keyword));
    return saved;
}
async function deleteRule(id) {
    const { error } = await dbClient.from('merchant_mapping').delete().eq('id', id);
    if (error) throw error;
    store.rules = store.rules.filter(r => String(r.id) !== String(id));
}

/** Re-read transactions after a rule change: the view does the re-categorising. */
async function refreshAfterRuleChange() {
    try { await loadTransactions(); } catch (e) { console.error('Refresh failed:', e); }
}

// --- SECURE STORAGE ---
// The native @aparajita/capacitor-secure-storage bridge exposes only the
// low-level internal* methods. Its get()/set() wrappers live in the plugin's JS
// layer, which this no-bundler app never loads — so we call the native methods
// directly, matching the wrapper's key prefix + JSON encoding.
const SECURE_PREFIX = 'capacitor-storage_';
async function getSecureItem(key) {
    if (isNative()) {
        const ss = Capacitor.Plugins.SecureStorage;
        try {
            if (typeof ss.get === 'function') return await ss.get(key);
            const { data } = await ss.internalGetItem({ prefixedKey: SECURE_PREFIX + key, sync: false });
            return data == null ? null : JSON.parse(data);
        } catch (_) { return null; }
    }
    try { return localStorage.getItem(key); } catch (_) { return null; }
}
async function setSecureItem(key, value) {
    if (isNative()) {
        const ss = Capacitor.Plugins.SecureStorage;
        if (typeof ss.set === 'function') { await ss.set(key, value); return; }
        await ss.internalSetItem({ prefixedKey: SECURE_PREFIX + key, data: JSON.stringify(value), sync: false, access: 0 });
        return;
    }
    try { localStorage.setItem(key, value); } catch (_) { /* private mode */ }
}

// --- BUDGET ALERTS (Android local notifications) ---
const NOTIF_KEY = 'precision-notifications'; // kept from v1 so the setting survives
const notificationsOn = () => { try { return localStorage.getItem(NOTIF_KEY) === 'on'; } catch (_) { return false; } };
function setNotificationsOn(on) { try { localStorage.setItem(NOTIF_KEY, on ? 'on' : 'off'); } catch (_) { /* ignore */ } }
const localNotifications = () => (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) || null;

async function requestNotificationPermission() {
    const LN = localNotifications();
    if (!LN) return false;
    try { return (await LN.requestPermissions()).display === 'granted'; } catch (_) { return false; }
}

/** Fire a local notification for any budget group over its limit this month (once per group per month). */
async function checkSpendingAlerts() {
    const LN = localNotifications();
    if (!LN || !notificationsOn()) return;
    try { if ((await LN.checkPermissions()).display !== 'granted') return; } catch (_) { return; }
    const ym = thisMonth();
    const over = budgetSummary(ym).budgeted.filter(g => g.spent > g.limit);
    const key = `precision-notified-${ym}`;
    let notified = [];
    try { notified = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { /* ignore */ }
    const toFire = over.filter(g => !notified.includes(g.key));
    if (!toFire.length) return;
    try {
        await LN.schedule({ notifications: toFire.map((g, i) => ({
            id: (Date.now() % 1000000) + i,
            title: `${g.label} is over budget`,
            body: `${TM.rp(g.spent)} of ${TM.rp(g.limit)} this month. ${TM.rp(g.spent - g.limit)} over.`,
            schedule: { at: new Date(Date.now() + 800) },
        })) });
        localStorage.setItem(key, JSON.stringify(notified.concat(toFire.map(g => g.key))));
    } catch (e) { console.error('Notify error:', e); }
}

// --- SHARED MONTH ---
// Home, Activity, Budget and Spending show the same month.
const Month = {
    KEY: 'tm.month',
    get() {
        try {
            const v = sessionStorage.getItem(this.KEY);
            if (/^\d{4}-\d{2}$/.test(v || '') && v <= thisMonth()) return v;
        } catch (_) { /* storage blocked */ }
        return thisMonth();
    },
    set(ym) { try { sessionStorage.setItem(this.KEY, ym); } catch (_) { /* ignore */ } },
};

function monthSwitcherHTML(ym, caption) {
    const current = ym === thisMonth();
    const prev = shiftMonth(ym, -1), next = shiftMonth(ym, 1);
    const sub = current
        ? `<span class="text-caption text-muted tnum">${esc(caption || '')}</span>`
        : `<button type="button" class="link-small px-1.5 py-0.5" data-month-today>Back to this month</button>`;
    return `<div class="flex items-center justify-between gap-2">
        <button type="button" class="icon-btn icon-btn--outline" data-month-step="-1" aria-label="${esc(monthTitle(prev))}">${icon('chevron_left', 'text-[22px]')}</button>
        <div class="flex flex-col items-center min-w-0">
            <h2 class="font-serif font-normal text-[21px] leading-6 whitespace-nowrap" aria-live="polite">${esc(monthTitle(ym))}</h2>${sub}
        </div>
        <button type="button" class="icon-btn icon-btn--outline" data-month-step="1" ${current ? 'disabled aria-label="Next month (none yet)"' : `aria-label="${esc(monthTitle(next))}"`}>${icon('chevron_right', 'text-[22px]')}</button>
    </div>`;
}
function monthPillHTML(ym) {
    const current = ym === thisMonth();
    return `<div class="flex items-center gap-1 bg-surface border border-line rounded-full p-1">
            <button type="button" class="icon-btn w-10 h-10" data-month-step="-1" aria-label="${esc(monthTitle(shiftMonth(ym, -1)))}">${icon('chevron_left', 'text-[22px]')}</button>
            <span class="font-serif text-[22px] px-2 whitespace-nowrap">${esc(monthTitle(ym))}</span>
            <button type="button" class="icon-btn w-10 h-10" data-month-step="1" ${current ? 'disabled aria-label="Next month (none yet)"' : `aria-label="${esc(monthTitle(shiftMonth(ym, 1)))}"`}>${icon('chevron_right', 'text-[22px]')}</button>
        </div>${current ? '' : '<button type="button" class="link-small px-1" data-month-today>Back to this month</button>'}`;
}

/** Renders every [data-month-host] ("switcher" or "pill") and calls onChange(ym) on navigation. */
function mountMonth(onChange, captionFor) {
    const render = () => {
        const ym = Month.get();
        qsa('[data-month-host]').forEach(el => {
            el.innerHTML = el.dataset.monthHost === 'pill' ? monthPillHTML(ym) : monthSwitcherHTML(ym, captionFor ? captionFor(ym) : defaultMonthCaption(ym));
        });
    };
    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-month-step], [data-month-today]');
        if (!b || b.disabled) return;
        const ym = b.hasAttribute('data-month-today') ? thisMonth() : shiftMonth(Month.get(), Number(b.dataset.monthStep));
        if (ym > thisMonth()) return;
        Month.set(ym);
        render();
        onChange(ym);
    });
    render();
    return render;
}
function defaultMonthCaption(ym) {
    const p = monthProgress(ym);
    return p.day ? `Day ${p.day} of ${p.days}` : '';
}

// --- CHROME (header, nav, sidebar, FAB) ---
const TABS = [
    { key: 'home',     label: 'Home',     icon: 'home',         href: 'index.html' },
    { key: 'activity', label: 'Activity', icon: 'receipt_long', href: 'activity.html' },
    { key: 'budget',   label: 'Budget',   icon: 'donut_large',  href: 'budget.html' },
    { key: 'rules',    label: 'Rules',    icon: 'rule',         href: 'categories.html' },
];
const WORDMARK = `Tabitha's <em>Misery</em>`;

function renderChrome({ tab, pushed, fab }) {
    const body = document.body;
    body.classList.add('shell');
    if (fab) body.classList.add('has-fab');
    if (pushed) body.classList.add('no-nav');
    const name = displayName();

    const sidebar = `<aside class="sidebar" aria-label="Sidebar">
        <a href="index.html" class="wordmark !h-auto !px-3 !pb-6 !text-[28px] !leading-[30px] hover:!bg-transparent">${WORDMARK}</a>
        <nav aria-label="Main" class="flex flex-col gap-1">
            ${TABS.map(t => `<a href="${t.href}" ${t.key === tab ? 'aria-current="page"' : ''}>${icon(t.icon, t.key === tab ? 'ms--fill' : '')}${t.label}${t.key === 'rules' ? '<span class="sidebar-badge tnum" data-rules-badge hidden></span>' : ''}</a>`).join('')}
        </nav>
        <div class="h-px bg-line my-3"></div>
        <a href="import.html">${icon('move_to_inbox')}Import emails</a>
        <a href="account.html" class="!mt-auto !h-14 !px-2" ${pushed && pushed.account ? 'aria-current="page"' : ''}>
            <span class="avatar !w-9 !h-9 !text-[15px]" aria-hidden="true">${esc(initialOf(name))}</span>
            <span class="flex flex-col min-w-0"><span class="text-body-s font-semibold truncate">${esc(name)}</span><span class="text-caption opacity-80">Account</span></span>
        </a>
    </aside>`;

    const header = pushed
        ? `<header class="pushed-header ${pushed.narrow ? 'page--narrow-header' : ''}">
               <a href="${esc(pushed.back || 'index.html')}" class="icon-btn" data-back aria-label="Back">${icon('arrow_back', 'text-[22px]')}</a>
               <h1 class="text-[17px] font-semibold truncate">${esc(pushed.title)}</h1>
           </header>`
        : `<header class="app-header">
               <a href="index.html" class="wordmark text-[23px]" aria-label="Tabitha's Misery, home">${WORDMARK}</a>
               <span class="flex gap-2">
                   <a href="import.html" class="icon-btn icon-btn--tonal" aria-label="Import bank emails">${icon('move_to_inbox', 'text-[20px]')}</a>
                   <a href="account.html" class="avatar" aria-label="Account">${esc(initialOf(name))}</a>
               </span>
           </header>`;
    body.insertAdjacentHTML('afterbegin', sidebar + header);

    let tail = '<div class="toast-host" id="toast-host"></div>';
    if (tab) {
        tail += `<nav class="tab-bar" aria-label="Main">${TABS.map(t => {
            const on = t.key === tab;
            return `<a href="${t.href}" ${on ? 'aria-current="page"' : ''}><span class="nav-pill">${icon(t.icon, on ? 'ms--fill' : '')}${t.key === 'rules' ? '<span class="count-badge" data-rules-badge hidden></span>' : ''}</span>${t.label}</a>`;
        }).join('')}</nav>`;
    }
    if (fab) tail += `<a href="add-transaction.html" class="fab">${icon('add')}Add</a>`;
    body.insertAdjacentHTML('beforeend', tail);

    // Back goes back when we came from inside the app (keeps scroll and month),
    // otherwise to the page's natural parent.
    qsa('[data-back]').forEach(a => a.addEventListener('click', (e) => {
        if (document.referrer && document.referrer.startsWith(location.origin) && history.length > 1) {
            e.preventDefault();
            history.back();
        }
    }));
}

/** Rules badge = this month's uncategorized expenses (income never counts). */
function updateRulesBadge() {
    const n = unsortedIn(thisMonth()).length;
    qsa('[data-rules-badge]').forEach(el => {
        el.hidden = n === 0;
        el.textContent = el.classList.contains('sidebar-badge') ? `${n} to sort` : String(n);
        el.setAttribute('aria-label', `${n} to sort`);
    });
}

// --- UI KIT ---
const ui = {};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not(.picker-input), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    const items = qsa(FOCUSABLE, container).filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

let toastTimer = null;
/** One toast at a time; newest replaces. 3 s, or 6 s with an action. */
ui.toast = function (message, { action, onAction, tone, icon: iconName, duration } = {}) {
    const host = qs('#toast-host') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast-host', className: 'toast-host' }));
    const error = tone === 'error';
    host.innerHTML = `<div class="toast ${error ? 'toast--error' : ''}" role="${error ? 'alert' : 'status'}">
        ${iconName ? icon(iconName) : ''}<span class="toast-msg">${esc(message)}</span>
        ${action ? `<button type="button" class="toast-action">${esc(action)}</button>` : ''}</div>`;
    const btn = qs('.toast-action', host);
    if (btn) btn.addEventListener('click', () => { host.innerHTML = ''; clearTimeout(toastTimer); if (onAction) onAction(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { host.innerHTML = ''; }, duration || (action ? 6000 : 3000));
};
ui.error = (message, opts = {}) => ui.toast(message, { tone: 'error', icon: navigator.onLine === false ? 'wifi_off' : 'error', ...opts });

/** Readable message for a failed request. */
function errorMessage(e, doing) {
    if (navigator.onLine === false) return `Couldn't ${doing}. You're offline.`;
    return `Couldn't ${doing}. ${e && e.message ? e.message.replace(/\.$/, '') + '.' : 'Try again.'}`;
}

// Bottom sheet: scrim tap, Escape, Android back and save all close it.
let sheetState = null;
ui.sheet = {
    open({ label, html, onOpen, onClose }) {
        ui.sheet.close(true);
        const trigger = document.activeElement;
        const scrim = document.createElement('div');
        scrim.className = 'scrim';
        const sheet = document.createElement('div');
        sheet.className = 'sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-label', label || 'Details');
        sheet.tabIndex = -1;
        sheet.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div>${html}`;
        document.body.append(scrim, sheet);
        document.body.style.overflow = 'hidden';
        const onKey = (e) => { if (e.key === 'Escape') ui.sheet.close(); else trapFocus(sheet, e); };
        sheet.addEventListener('keydown', onKey);
        scrim.addEventListener('click', () => ui.sheet.close());
        sheetState = { scrim, sheet, trigger, onClose };
        requestAnimationFrame(() => {
            scrim.classList.add('is-open');
            sheet.classList.add('is-open');
            const first = qs('[autofocus]', sheet);
            (first || sheet).focus({ preventScroll: true });
        });
        if (onOpen) onOpen(sheet);
        return sheet;
    },
    close(immediate) {
        if (!sheetState) return;
        const { scrim, sheet, trigger, onClose } = sheetState;
        sheetState = null;
        scrim.classList.remove('is-open');
        sheet.classList.remove('is-open');
        const remove = () => { scrim.remove(); sheet.remove(); };
        if (immediate) remove(); else setTimeout(remove, 230);
        document.body.style.overflow = '';
        if (trigger && trigger.isConnected && !immediate) trigger.focus({ preventScroll: true });
        if (onClose) onClose();
    },
    isOpen: () => !!sheetState,
};

let dialogState = null;
/** Confirm dialog, only for things undo can't fix. Resolves true/false. */
ui.confirm = function ({ title, body, confirmLabel = 'Delete', cancelLabel = 'Keep it', destructive = true }) {
    return new Promise((resolve) => {
        const trigger = document.activeElement;
        const scrim = document.createElement('div');
        scrim.className = 'scrim dialog-scrim';
        const dlg = document.createElement('div');
        dlg.className = 'dialog';
        dlg.setAttribute('role', 'alertdialog');
        dlg.setAttribute('aria-modal', 'true');
        dlg.setAttribute('aria-labelledby', 'dialog-title');
        dlg.setAttribute('aria-describedby', 'dialog-body');
        dlg.innerHTML = `<h2 id="dialog-title" class="text-[18px] leading-6 font-semibold">${esc(title)}</h2>
            <p id="dialog-body" class="text-body-s text-text-2">${esc(body)}</p>
            <div class="flex flex-wrap gap-2 justify-end mt-1.5">
                <button type="button" class="btn btn-secondary h-11" data-dialog="no">${esc(cancelLabel)}</button>
                <button type="button" class="btn ${destructive ? 'btn-destructive' : 'btn-primary'} h-11" data-dialog="yes">${esc(confirmLabel)}</button>
            </div>`;
        document.body.append(scrim, dlg);
        const done = (answer) => {
            dialogState = null;
            scrim.remove(); dlg.remove();
            if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
            resolve(answer);
        };
        dialogState = { close: () => done(false) };
        dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-dialog]'); if (b) done(b.dataset.dialog === 'yes'); });
        dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(false); else trapFocus(dlg, e); });
        scrim.addEventListener('click', () => done(false));
        requestAnimationFrame(() => { scrim.classList.add('is-open'); dlg.classList.add('is-open'); qs('[data-dialog="no"]', dlg).focus(); });
    });
};

/** Button loading state: spinner + verb, keeps its width. */
function setBusy(btn, label) {
    if (!btn || btn.getAttribute('aria-busy') === 'true') return;
    btn.dataset.idleHtml = btn.innerHTML;
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(label)}`;
}
function clearBusy(btn) {
    if (!btn || btn.getAttribute('aria-busy') !== 'true') return;
    btn.innerHTML = btn.dataset.idleHtml;
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
    btn.style.minWidth = '';
}

/** Live "1.250.000" formatting for amount inputs; caret stays at the end. */
function bindAmountInput(input, onChange) {
    input.addEventListener('input', () => {
        const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
        input.value = digits ? dots(digits) : '';
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) { /* not focusable */ }
        if (onChange) onChange(parseAmount(input.value));
    });
}

/** Opens the native picker of a hidden <input type="date|month">. */
function openPicker(input) {
    try { if (typeof input.showPicker === 'function') { input.showPicker(); return; } } catch (_) { /* fall through */ }
    input.focus();
    input.click();
}

// One-shot message carried across a page navigation (e.g. "Added" after a save).
const Flash = {
    KEY: 'tm.flash',
    set(data) { try { sessionStorage.setItem(this.KEY, JSON.stringify(data)); } catch (_) { /* ignore */ } },
    take() {
        try {
            const v = sessionStorage.getItem(this.KEY);
            sessionStorage.removeItem(this.KEY);
            return v ? JSON.parse(v) : null;
        } catch (_) { return null; }
    },
};

/** Undo toast for a deleted transaction. Soft delete is written at once; Undo restores it. */
function undoDeleteToast(txn, onRestored) {
    ui.toast(`Deleted ${titleOf(txn)}`, {
        action: 'Undo',
        onAction: async () => {
            try {
                await restoreTransaction(txn.id);
                if (!store.txns.some(t => String(t.id) === String(txn.id))) store.txns.push(txn);
                store.txns.sort((a, b) => (b.transaction_date.localeCompare(a.transaction_date)) || (Number(b.id) - Number(a.id)));
                ui.toast(`Restored ${titleOf(txn)}`);
                if (onRestored) onRestored();
            } catch (e) { ui.error(errorMessage(e, 'restore it')); }
        },
    });
}

// --- SHARED SHEETS ---

/** Transaction details: category, bank text, source, and the actions. */
function openTransactionSheet(txn, { onChange } = {}) {
    const { title } = TM.splitDescription(txn.description);
    const income = isIncome(txn);
    const unsorted = isUnsorted(txn);
    const cat = txn.category || UNCATEGORIZED;
    const catRow = income ? '' : `<dt class="text-muted">Category</dt>
        <dd class="m-0 flex items-center gap-1.5 font-semibold ${unsorted ? 'text-accent-text' : ''}">${unsorted ? icon('label_off', 'text-[18px]') : ''}${esc(cat)}</dd>`;
    const html = `
        <div class="flex gap-3.5 items-center">
            ${txTileHTML(txn, 'tile--lg')}
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <h2 class="sheet-title">${esc(title)}</h2>
                <span class="text-label text-muted">${esc(TM.dateLong(txn.transaction_date))} · ${income ? 'Income' : 'Expense'}</span>
            </div>
            <span class="font-serif text-[26px] whitespace-nowrap tnum ${income ? 'text-positive' : ''}">${esc(TM.rpSigned(txn.amount, txn.transaction_type))}</span>
        </div>
        <dl class="m-0 grid gap-x-3 gap-y-2.5 text-body-s" style="grid-template-columns: 96px minmax(0, 1fr)">
            ${catRow}
            <dt class="text-muted">Bank text</dt><dd class="m-0 font-mono text-label" style="overflow-wrap:anywhere">${esc(txn.description)}</dd>
            <dt class="text-muted">Source</dt><dd class="m-0" data-source>…</dd>
        </dl>
        ${income ? '' : `<button type="button" class="btn btn-primary btn-lg" data-act="pick">${icon('sell', 'text-[22px]')}${unsorted ? 'Pick a category' : 'Change category'}</button>`}
        <div class="grid ${income ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5">
            <a href="add-transaction.html?id=${encodeURIComponent(txn.id)}" class="btn btn-secondary">${icon('edit', 'text-[20px]')}Edit</a>
            ${income ? '' : `<button type="button" class="btn btn-secondary" data-act="rule">${icon('rule', 'text-[20px]')}Make a rule</button>`}
        </div>
        <button type="button" class="btn-text-destructive" data-act="delete">${icon('delete', 'text-[20px]')}Delete transaction</button>`;

    ui.sheet.open({
        label: `${title} details`, html,
        onOpen(sheet) {
            dbClient.from('bca_transactions').select('ref_no').eq('id', txn.id).maybeSingle().then(({ data }) => {
                const el = qs('[data-source]', sheet);
                if (el) el.textContent = data && data.ref_no ? 'Imported from BCA email' : 'Added by hand';
            }, () => { const el = qs('[data-source]', sheet); if (el) el.textContent = '—'; });

            sheet.addEventListener('click', async (e) => {
                const b = e.target.closest('[data-act]');
                if (!b) return;
                if (b.dataset.act === 'pick') openCategoryPicker(txn, { onSaved: onChange });
                if (b.dataset.act === 'rule') openRuleSheet({ keyword: TM.suggestKeyword(txn.description), category: unsorted ? null : cat, onSaved: onChange });
                if (b.dataset.act === 'delete') {
                    setBusy(b, 'Deleting…');
                    try {
                        await softDeleteTransaction(txn.id);
                        store.txns = store.txns.filter(t => String(t.id) !== String(txn.id));
                        ui.sheet.close();
                        if (onChange) onChange();
                        undoDeleteToast(txn, onChange);
                    } catch (err) { clearBusy(b); ui.error(errorMessage(err, 'delete it')); }
                }
            });
        },
    });
}

/** How many other uncategorized expenses a keyword would sort. */
function sortableBy(keyword, exceptId) {
    const k = String(keyword || '').toUpperCase().trim();
    if (!k) return 0;
    return store.txns.filter(t => isUnsorted(t) && String(t.id) !== String(exceptId) && String(t.description).toUpperCase().includes(k)).length;
}

/** Category picker for one transaction, with an optional "Always file KEYWORD here" rule. */
function openCategoryPicker(txn, { onSaved } = {}) {
    const unsorted = isUnsorted(txn);
    let selected = unsorted ? null : txn.category;
    let keyword = TM.suggestKeyword(txn.description);
    const { title } = TM.splitDescription(txn.description);

    const catButtons = store.categories.map(c => {
        const v = categoryVisual(c.name);
        return `<button type="button" class="flex items-center gap-2 h-12 rounded-s border border-line bg-surface px-2.5 text-body-s text-left aria-pressed:border-ink aria-pressed:bg-bg aria-pressed:font-semibold" data-cat="${esc(c.name)}" aria-pressed="${c.name === selected}">
            <span class="ms text-[20px]" aria-hidden="true" style="color: var(--cat-${v.token})">${esc(v.icon)}</span><span class="truncate">${esc(c.name)}</span></button>`;
    }).join('');

    const html = `
        <div class="flex flex-col gap-0.5">
            <h2 class="text-[18px] leading-6 font-semibold">${esc(title)}</h2>
            <span class="text-label text-muted tnum">${esc(TM.dateShort(txn.transaction_date))} · ${esc(TM.rpSigned(txn.amount, txn.transaction_type))}</span>
        </div>
        <div class="grid grid-cols-2 gap-2" role="group" aria-label="Category">${catButtons}</div>
        ${keyword ? `
        <div class="flex gap-3 items-start p-3 rounded-[12px] bg-bg">
            <label class="contents"><input type="checkbox" class="sr-only" data-rule-check ${unsorted ? 'checked' : ''}><span class="check mt-0.5">${icon('check')}</span></label>
            <span class="flex flex-col gap-1 min-w-0">
                <span class="text-body-s font-medium">Always file <button type="button" class="font-mono bg-sunken px-1.5 rounded-[4px] underline decoration-dotted underline-offset-2" data-edit-kw aria-label="Edit keyword ${esc(keyword)}">${esc(keyword)}</button> here</span>
                <input type="text" class="field h-11 font-mono uppercase" data-kw-input value="${esc(keyword)}" autocapitalize="characters" aria-label="Keyword" hidden>
                <span class="text-caption text-muted" data-rule-help></span>
            </span>
        </div>` : ''}
        ${unsorted ? '' : `<button type="button" class="btn-text text-muted !h-9 -mt-2" data-clear>Remove category (let rules decide)</button>`}
        <button type="button" class="btn btn-primary btn-lg" data-save ${selected ? '' : 'disabled'}>Save</button>`;

    ui.sheet.open({
        label: `Category for ${title}`, html,
        onOpen(sheet) {
            const save = qs('[data-save]', sheet);
            const check = qs('[data-rule-check]', sheet);
            const help = qs('[data-rule-help]', sheet);
            const kwInput = qs('[data-kw-input]', sheet);
            const updateHelp = () => {
                if (!help) return;
                const n = sortableBy(keyword, txn.id);
                const existing = ruleByKeyword(keyword);
                help.textContent = existing
                    ? `${keyword} already files to ${existing.category}. Saving moves it here.`
                    : `Creates a rule${n ? ` and sorts ${TM.plural(n, 'more past transaction')}` : ''}. Tap the keyword to edit it.`;
            };
            updateHelp();

            sheet.addEventListener('click', async (e) => {
                const c = e.target.closest('[data-cat]');
                if (c) {
                    selected = c.dataset.cat;
                    qsa('[data-cat]', sheet).forEach(b => b.setAttribute('aria-pressed', String(b === c)));
                    save.disabled = false;
                    return;
                }
                if (e.target.closest('[data-edit-kw]')) {
                    kwInput.hidden = false;
                    e.target.closest('[data-edit-kw]').parentElement.hidden = true;
                    check.checked = true;
                    kwInput.focus();
                    return;
                }
                if (e.target.closest('[data-clear]')) {
                    const b = e.target.closest('[data-clear]');
                    setBusy(b, 'Removing…');
                    try {
                        await setCategoryOverride(txn.id, null);
                        await refreshAfterRuleChange();
                        const r = ruleFor(txn.description);
                        ui.sheet.close();
                        ui.toast(r ? `Back to the ${r.keyword} rule: ${r.category}` : 'Category removed');
                        if (onSaved) onSaved();
                    } catch (err) { clearBusy(b); ui.error(errorMessage(err, 'remove the category')); }
                    return;
                }
                if (e.target.closest('[data-save]')) {
                    if (!selected) return;
                    const useRule = check && check.checked && keyword;
                    setBusy(save, 'Saving…');
                    try {
                        let ruled = 0;
                        if (useRule) {
                            const existing = ruleByKeyword(keyword);
                            ruled = sortableBy(keyword, txn.id);
                            await saveRule({ id: existing && existing.id, keyword, category: selected });
                        }
                        await setCategoryOverride(txn.id, selected);
                        txn.category = selected;
                        if (useRule) await refreshAfterRuleChange();
                        ui.sheet.close();
                        ui.toast(useRule && ruled ? `Filed under ${selected}, plus ${TM.plural(ruled, 'more')}` : `Filed under ${selected}`);
                        if (onSaved) onSaved();
                    } catch (err) { clearBusy(save); ui.error(errorMessage(err, 'save the category')); }
                }
            });
            if (kwInput) kwInput.addEventListener('input', () => {
                keyword = kwInput.value.toUpperCase().trim();
                updateHelp();
            });
        },
    });
}

/** Add or edit a keyword rule, with a live preview of what it matches. */
function openRuleSheet({ rule = null, keyword = '', category = null, onSaved } = {}) {
    let selected = rule ? rule.category : category;
    const chips = store.categories.map(c => {
        const v = categoryVisual(c.name);
        return `<button type="button" class="chip chip--icon" data-cat="${esc(c.name)}" aria-pressed="${c.name === selected}"><span class="ms text-[18px]" aria-hidden="true" style="color: var(--cat-${v.token})">${esc(v.icon)}</span>${esc(c.name)}</button>`;
    }).join('');
    const html = `
        <h2 class="sheet-title">${rule ? 'Edit rule' : 'New rule'}</h2>
        <div>
            <label for="rule-kw" class="field-label">When the description contains</label>
            <input id="rule-kw" class="field font-mono font-medium text-[17px] tracking-[0.02em] uppercase" value="${esc(rule ? rule.keyword : keyword)}" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-describedby="rule-kw-help" autofocus>
            <span id="rule-kw-help" class="field-help">Not case sensitive. Shorter keywords catch more.</span>
        </div>
        <fieldset class="border-0 p-0 m-0">
            <legend class="field-label">File it under</legend>
            <div class="flex flex-wrap gap-2">${chips}</div>
        </fieldset>
        <div class="bg-bg rounded-[12px] px-3.5 py-3 flex flex-col gap-2" aria-live="polite" data-preview></div>
        <button type="button" class="btn btn-primary btn-lg" data-save>Save rule</button>
        ${rule ? '<button type="button" class="btn-text-destructive -mt-2" data-delete>Delete rule</button>' : ''}`;

    ui.sheet.open({
        label: rule ? `Edit rule ${rule.keyword}` : 'New rule', html,
        onOpen(sheet) {
            const input = qs('#rule-kw', sheet);
            const preview = qs('[data-preview]', sheet);
            const save = qs('[data-save]', sheet);
            const help = qs('#rule-kw-help', sheet);
            const kw = () => input.value.toUpperCase().trim();
            const setError = (msg) => {
                input.setAttribute('aria-invalid', msg ? 'true' : 'false');
                help.className = msg ? 'field-error' : 'field-help';
                help.innerHTML = msg ? `${icon('error', 'text-[18px]')}${esc(msg)}` : 'Not case sensitive. Shorter keywords catch more.';
            };
            const render = () => {
                const k = kw();
                if (!k) { preview.innerHTML = '<span class="text-label text-muted">Type a keyword to see what it matches.</span>'; save.textContent = 'Save rule'; return; }
                const hits = store.txns.filter(t => String(t.description).toUpperCase().includes(k) && !isIncome(t));
                const loose = hits.filter(isUnsorted);
                const head = !hits.length ? 'No transactions match yet'
                    : `Matches ${TM.plural(hits.length, 'transaction')}${loose.length ? (loose.length === hits.length ? (hits.length === 1 ? ', uncategorized' : `, ${hits.length === 2 ? 'both' : 'all'} uncategorized`) : `, ${loose.length} uncategorized`) : ''}`;
                preview.innerHTML = `<span class="text-label font-semibold">${esc(head)}</span>` + hits.slice(0, 3).map(t =>
                    `<span class="flex justify-between gap-3 text-label text-text-2 tnum"><span class="truncate">${esc(titleOf(t))} · ${esc(TM.dateLong(t.transaction_date).replace(/ \d{4}$/, ''))}</span><span class="whitespace-nowrap">${esc(TM.rpSigned(t.amount, t.transaction_type))}</span></span>`).join('');
                save.textContent = loose.length ? `Save rule and sort ${loose.length}` : 'Save rule';
            };
            input.addEventListener('input', () => { setError(''); render(); });
            render();

            sheet.addEventListener('click', async (e) => {
                const c = e.target.closest('[data-cat]');
                if (c) {
                    selected = c.dataset.cat;
                    qsa('[data-cat]', sheet).forEach(b => b.setAttribute('aria-pressed', String(b === c)));
                    return;
                }
                if (e.target.closest('[data-save]')) {
                    const k = kw();
                    if (!k) { setError('Enter a keyword'); input.focus(); return; }
                    const dup = ruleByKeyword(k);
                    if (dup && (!rule || String(dup.id) !== String(rule.id))) { setError(`${k} already files to ${dup.category}`); input.focus(); return; }
                    if (!selected) { ui.toast('Pick a category to file it under'); return; }
                    setBusy(save, 'Saving…');
                    try {
                        const sorted = store.txns.filter(t => isUnsorted(t) && String(t.description).toUpperCase().includes(k)).length;
                        await saveRule({ id: rule && rule.id, keyword: k, category: selected });
                        await refreshAfterRuleChange();
                        ui.sheet.close();
                        ui.toast(sorted ? `Rule saved. Sorted ${TM.plural(sorted, 'transaction')}.` : `Rule saved: ${k} → ${selected}`);
                        if (onSaved) onSaved();
                    } catch (err) { clearBusy(save); ui.error(errorMessage(err, 'save the rule')); }
                }
                if (e.target.closest('[data-delete]') && rule) {
                    const b = e.target.closest('[data-delete]');
                    setBusy(b, 'Deleting…');
                    try {
                        await deleteRule(rule.id);
                        await refreshAfterRuleChange();
                        ui.sheet.close();
                        if (onSaved) onSaved();
                        ui.toast(`Deleted the ${rule.keyword} rule`, {
                            action: 'Undo',
                            onAction: async () => {
                                try { await saveRule({ keyword: rule.keyword, category: rule.category }); await refreshAfterRuleChange(); if (onSaved) onSaved(); }
                                catch (err) { ui.error(errorMessage(err, 'restore the rule')); }
                            },
                        });
                    } catch (err) { clearBusy(b); ui.error(errorMessage(err, 'delete the rule')); }
                }
            });
        },
    });
}

// --- BOOT ---
/** Chart helpers shared by Home and Budget. */
function niceAxisMax(max) {
    if (max <= 0) return 3;
    const raw = max / 3;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
    return step * 3;
}

const App = {
    /**
     * tab: 'home' | 'activity' | 'budget' | 'rules' (tab page), or
     * pushed: { title, back, narrow } (pushed page, no bottom nav).
     * init(): page setup; runs after the session check and chrome render.
     */
    async start({ tab = null, pushed = null, fab = false, init }) {
        const { data: { session } } = await dbClient.auth.getSession();
        if (!session) { location.replace('login.html'); return; }
        store.user = session.user;
        // Month keys depend on the start day, so know it before the page renders data.
        const settings = loadSettings().catch((e) => { console.warn(e); });
        renderChrome({ tab, pushed, fab });

        // Android back: close the top layer first, then go back (or exit on Home).
        if (isNative() && Capacitor.Plugins.App) {
            Capacitor.Plugins.App.addListener('backButton', () => {
                if (dialogState) return dialogState.close();
                if (ui.sheet.isOpen()) return ui.sheet.close();
                if (tab === 'home') Capacitor.Plugins.App.exitApp();
                else history.back();
            });
        }

        const flash = Flash.take();
        await settings;
        try {
            await init();
        } catch (e) {
            console.error(e);
            ui.error(errorMessage(e, 'load your data'), { action: 'Retry', onAction: () => location.reload(), duration: 10000 });
        }
        if (flash) {
            if (flash.undoTxn) undoDeleteToast(flash.undoTxn, () => window.dispatchEvent(new Event('tm:data')));
            else ui.toast(flash.message, { icon: flash.icon });
        }
        if (store.txns.length) checkSpendingAlerts().catch(() => {});
    },
};
