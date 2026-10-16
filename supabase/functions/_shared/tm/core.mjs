/* Pure finance logic for the MCP connector.
 *
 * The source of truth is the web app: js/app.js (constants, groupOf,
 * activeLimit, ruleFor, budgetSummary) and js/budget.js (budget month range).
 * A change there must be mirrored here — see CLAUDE.md. core.test.mjs checks
 * the constants against js/app.js.
 *
 * Every function takes plain data ({ txns, categories, rules, budgets }) shaped
 * like the app's `store`, so it can be tested without Supabase.
 */

// js/app.js
export const UNCATEGORIZED = 'Uncategorized';
export const NO_END = '9999-12'; // budgets.end_month is NOT NULL; this means "no end"

export const BUDGET_GROUPS = {
    FOOD:          { label: 'Food & Dining' },
    TRANSPORT:     { label: 'Transport' },
    ENTERTAINMENT: { label: 'Entertainment' },
    SHOPPING:      { label: 'Shopping' },
    BILLS:         { label: 'Bills & Utilities' },
    OTHER:         { label: 'Other' },
};
export const GROUP_KEYS = Object.keys(BUDGET_GROUPS);

// The icons offered when creating a category (CATEGORY_ICONS in js/app.js).
export const CATEGORY_ICONS = ['restaurant', 'directions_car', 'favorite', 'bolt', 'movie', 'local_mall', 'receipt_long', 'shopping_cart', 'home', 'school', 'pets', 'flight'];

export const isIncome = (t) => t.transaction_type === 'CR';
export const isUnsorted = (t) => !isIncome(t) && (!t.category || t.category === UNCATEGORIZED);
export const txMonth = (t) => String(t.transaction_date || '').slice(0, 7);

/** Same cleanup as loadTransactions() in js/app.js: drop undated rows, numeric amounts, newest first. */
export function normaliseTxns(rows) {
    return (rows || [])
        .filter(t => t.transaction_date)
        .map(t => ({ ...t, amount: Number(t.amount) || 0 }))
        .sort((a, b) => (b.transaction_date.localeCompare(a.transaction_date)) || (Number(b.id) - Number(a.id)));
}

/** budgets rows -> { GROUP: { amount, start, end } }, like loadBudgets(). */
export function budgetMap(rows) {
    const map = {};
    (rows || []).forEach(b => { map[b.grp] = { amount: Number(b.amount) || 0, start: b.start_month, end: b.end_month || b.start_month }; });
    return map;
}

export const findCategory = (categories, name) => categories.find(c => c.name === name) || null;

/** The budget group a category counts toward. Uncategorized counts toward none. */
export function groupOf(categories, categoryName) {
    if (!categoryName || categoryName === UNCATEGORIZED) return null;
    const c = findCategory(categories, categoryName);
    return c && BUDGET_GROUPS[c.budget_group] ? c.budget_group : 'OTHER';
}

/** The monthly limit that applies to `group` in month `ym`, or 0. */
export function activeLimit(budgets, group, ym) {
    const b = budgets[group];
    if (!b) return 0;
    return ym >= b.start && ym <= b.end ? b.amount : 0;
}

/** The rule that would categorise `description`: longest matching keyword wins. */
export function ruleFor(rules, description) {
    const d = String(description || '').toUpperCase();
    let best = null;
    rules.forEach(r => {
        const k = String(r.keyword || '').toUpperCase();
        if (k && d.includes(k) && (!best || k.length > best.keyword.length)) best = { ...r, keyword: k };
    });
    return best;
}
export const ruleByKeyword = (rules, kw) =>
    rules.find(r => String(r.keyword).toUpperCase() === String(kw).toUpperCase()) || null;
export const normaliseKeyword = (kw) => String(kw || '').toUpperCase().trim();

export const expensesIn = (txns, ym) => txns.filter(t => txMonth(t) === ym && !isIncome(t));
export const incomeIn = (txns, ym) => txns.filter(t => txMonth(t) === ym && isIncome(t));
export const unsortedIn = (txns, ym) => expensesIn(txns, ym).filter(isUnsorted);
export const sumAmounts = (list) => list.reduce((s, t) => s + t.amount, 0);

/** Per-group spending and limits for one month. */
export function budgetSummary({ txns, categories, budgets }, ym) {
    const spentBy = {};
    expensesIn(txns, ym).forEach(t => {
        const g = groupOf(categories, t.category);
        if (g) spentBy[g] = (spentBy[g] || 0) + t.amount;
    });
    const groups = GROUP_KEYS.map(key => ({ key, ...BUDGET_GROUPS[key], spent: spentBy[key] || 0, limit: activeLimit(budgets, key, ym) }));
    const budgeted = groups.filter(g => g.limit > 0);
    return {
        groups, budgeted,
        unbudgeted: groups.filter(g => !g.limit && g.spent > 0),
        spent: budgeted.reduce((s, g) => s + g.spent, 0),
        limit: budgeted.reduce((s, g) => s + g.limit, 0),
    };
}

/** Expense totals by category for one month, biggest first (js/spending.js). */
export function spendingByCategory(txns, ym) {
    const by = {};
    expensesIn(txns, ym).forEach(t => {
        const k = t.category || UNCATEGORIZED;
        by[k] = by[k] || { category: k, amount: 0, count: 0 };
        by[k].amount += t.amount;
        by[k].count += 1;
    });
    return Object.values(by).sort((a, b) => b.amount - a.amount);
}

/**
 * The start/end months a budget save writes (js/budget.js).
 * period: 'only' (just this month), 'none' (no end) or 'until' (through `until`).
 * An ongoing budget keeps its earlier start, so past months keep a limit.
 */
export function budgetRange(existing, ym, period, until) {
    const start = period === 'only' ? ym : (existing && existing.start < ym ? existing.start : ym);
    const end = period === 'only' ? ym : period === 'none' ? NO_END : until;
    return { start, end };
}

/** The category_override a hand edit writes (js/transaction-form.js): CR has none,
 *  and a category the rules already gave stays rule-driven. */
export function overrideFor({ type, category, original }) {
    let override = type === 'CR' ? null : (category || null);
    if (override === UNCATEGORIZED) override = null;
    if (original && original.override == null && override === (original.category === UNCATEGORIZED ? null : original.category)) override = null;
    return override;
}

export const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s));
export function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
/** Current month in local time, 'YYYY-MM'. */
export function thisMonth(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
