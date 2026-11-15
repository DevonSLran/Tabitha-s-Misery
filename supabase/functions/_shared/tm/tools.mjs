/* The connector's tools, shared by the local stdio server (mcp/server.mjs, Node)
 * and the remote one (supabase/functions/mcp, Deno). Writes use the same
 * payloads as the app; the logic they share with js/app.js lives in core.mjs.
 *
 * No imports besides core.mjs, so it runs unchanged on both runtimes: the
 * caller passes its own Supabase client, TM (js/format.js) and zod.
 */
import {
    UNCATEGORIZED, BUDGET_GROUPS, GROUP_KEYS, CATEGORY_ICONS, isIncome, isUnsorted, normaliseTxns, budgetMap,
    budgetSummary, spendingByCategory, expensesIn, incomeIn, unsortedIn, sumAmounts, ruleFor,
    ruleByKeyword, normaliseKeyword, budgetRange, overrideFor, isMonth, isDate, thisMonth,
    startDay, periodBounds,
} from './core.mjs';

export const SERVER_INFO = { name: 'tabithas-misery', version: '2.0.0' };

export const INSTRUCTIONS = `This connector reads and changes the user's personal finance data in "Tabitha's Misery", an app for BCA bank transactions.

Data:
- Amounts are whole Indonesian rupiah, always positive. A transaction's type says which way it went: "expense" (BCA "DB") or "income" ("CR"). Show money as "Rp 45.000" (the *_text fields are already formatted).
- An expense's category comes from a manual choice if there is one, otherwise from keyword rules (the longest keyword found in the description wins), otherwise "Uncategorized". Income has no category.
- Each category counts toward one of six fixed budget groups: ${GROUP_KEYS.join(', ')}. Uncategorized spending counts toward no budget.
- Months are "YYYY-MM", dates "YYYY-MM-DD".
- A user's month can start on a day other than the 1st (month_start_day, see get_settings), usually the day their money arrives. Then "YYYY-MM" means the month that starts on that day: with the 15th, "2026-11" runs from 15 Nov to 14 Dec, and 10 Nov counts toward "2026-10". Every tool that takes a month uses this, and month_summary returns the exact dates.

Changing data (every tool that isn't read-only):
- Before calling a write tool, tell the user exactly what will change: which transactions, categories, rules or budgets, with the old and new values. Then wait until they say yes. Do this every time, even when a request sounds clear.
- Make one change per confirmation. Don't chain extra writes the user didn't approve.
- After a write, say what changed and how to undo it. Deleting a transaction is reversible with restore_transaction. A deleted rule can be re-created from what delete_rule returns.
- Look up ids with the read tools first. Never guess an id.`;

/**
 * Registers every tool on `server` (an McpServer from either SDK).
 * db: a supabase-js client acting as the user. requireUser: async, throws an
 * Error named 'NotSignedIn' (with a message for the user) when there's no user.
 */
export function registerTools(server, { db, TM, z, requireUser }) {
    // --- helpers ---
    const READ = { readOnlyHint: true, openWorldHint: false };
    const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
    const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

    class UserError extends Error {}
    const fail = (msg) => { throw new UserError(msg); };

    function tool(name, { title, description, input = {}, annotations }, run) {
        server.registerTool(name, { title, description, inputSchema: z.object(input), annotations: { title, ...annotations } }, async (args) => {
            try {
                await requireUser();
                const result = await run(args);
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            } catch (e) {
                const msg = e instanceof UserError || (e && e.name === 'NotSignedIn') ? e.message
                    : `Supabase error: ${e && e.message ? e.message : String(e)}`;
                return { isError: true, content: [{ type: 'text', text: msg }] };
            }
        });
    }

    async function q(promise) {
        const { data, error, count } = await promise;
        if (error) throw error;
        return count == null ? data : { data, count };
    }

    /** Every row of a query, past the 1000-row page limit. */
    async function fetchAll(build) {
        const out = [];
        for (let from = 0; ; from += 1000) {
            const page = await q(build().range(from, from + 999));
            out.push(...page);
            if (page.length < 1000) return out;
        }
    }

    const TX_COLS = 'id, transaction_date, description, amount, transaction_type, category';
    const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };

    async function txnsBetween(from, toExclusive) {
        return normaliseTxns(await fetchAll(() => db.from('int_bca_categorized').select(TX_COLS)
            .gte('transaction_date', from).lt('transaction_date', toExclusive).order('id')));
    }
    /** Every transaction of budget month `ym` when months start on `day`. */
    const txnsInMonth = (ym, day) => txnsBetween(periodBounds(ym, day).start, periodBounds(nextMonth(ym), day).start);
    /** The user's month start day. No row, or no user_settings table yet, means the 1st. */
    async function loadStartDay() {
        const { data, error } = await db.from('user_settings').select('month_start_day').maybeSingle();
        return error ? 1 : startDay(data && data.month_start_day);
    }
    const loadCategories = async () => q(db.from('categories').select('id, name, icon, budget_group, sort_order').order('sort_order'));
    const loadRules = async () => fetchAll(() => db.from('merchant_mapping').select('id, keyword, category').order('keyword'));
    const loadBudgets = async () => budgetMap(await q(db.from('budgets').select('grp, amount, start_month, end_month')));
    async function viewRow(id) {
        const rows = await q(db.from('int_bca_categorized').select(TX_COLS).eq('id', id));
        return rows[0] ? normaliseTxns(rows)[0] : null;
    }
    async function baseRow(id) {
        const rows = await q(db.from('bca_transactions').select('id, date, description, amount, type, category_override, ref_no, deleted_at').eq('id', id));
        return rows[0] || null;
    }

    function txOut(t) {
        const { title, via } = TM.splitDescription(t.description);
        const income = isIncome(t);
        return {
            id: t.id,
            date: t.transaction_date,
            merchant: title,
            ...(via ? { via } : {}),
            description: t.description,
            amount: t.amount,
            amount_text: TM.rpSigned(t.amount, t.transaction_type),
            type: income ? 'income' : 'expense',
            category: income ? null : (t.category || UNCATEGORIZED),
        };
    }
    const money = (n) => ({ amount: n, text: TM.rp(n) });
    const monthArg = (m, day) => { const ym = m || thisMonth(new Date(), day); if (!isMonth(ym)) fail(`"${m}" isn't a month. Use YYYY-MM.`); return ym; };
    const periodOut = (ym, day) => { const b = periodBounds(ym, day); return { from: b.start, to: b.end }; };
    const groupLabel = (key) => (BUDGET_GROUPS[key] || BUDGET_GROUPS.OTHER).label;

    async function requireCategory(name, categories) {
        if (name == null) return null;
        const cats = categories || await loadCategories();
        const c = cats.find(x => x.name === name) || cats.find(x => x.name.toLowerCase() === String(name).toLowerCase());
        if (!c) fail(`There's no category called "${name}". Existing: ${cats.map(x => x.name).join(', ')}.`);
        return c.name;
    }

    const zMonth = z.string().describe('Month as YYYY-MM (the month that starts on the user\'s month start day). Defaults to the current month.');
    const zDate = z.string().describe('Date as YYYY-MM-DD');
    const zType = z.enum(['expense', 'income']);
    const zGroup = z.enum(GROUP_KEYS);
    const toDbType = (t) => (t === 'income' ? 'CR' : 'DB');

    // --- reads ---
    tool('month_summary', {
        title: 'Month summary',
        description: 'What a month cost: total spent, income, net, spending by category, each budget group against its limit, and how much spending is still uncategorized. The same numbers as the app\'s Home and Budget tabs.',
        input: { month: zMonth.optional() },
        annotations: READ,
    }, async ({ month }) => {
        const day = await loadStartDay();
        const ym = monthArg(month, day);
        const [txns, categories, budgets] = await Promise.all([txnsInMonth(ym, day), loadCategories(), loadBudgets()]);
        const spent = sumAmounts(expensesIn(txns, ym, day));
        const income = sumAmounts(incomeIn(txns, ym, day));
        const b = budgetSummary({ txns, categories, budgets, startDay: day }, ym);
        const unsorted = unsortedIn(txns, ym, day);
        return {
            month: ym,
            label: TM.periodLabel(ym, day),
            dates: periodOut(ym, day),
            spent: money(spent),
            income: money(income),
            net: { amount: income - spent, text: (income - spent < 0 ? '−' : '') + TM.rp(income - spent) },
            transactions: { expenses: expensesIn(txns, ym, day).length, income: incomeIn(txns, ym, day).length },
            by_category: spendingByCategory(txns, ym, day).map(c => ({ category: c.category, ...money(c.amount), count: c.count })),
            budgets: {
                total_spent: money(b.spent),
                total_limit: money(b.limit),
                groups: b.budgeted.map(g => ({ group: g.key, label: g.label, spent: money(g.spent), limit: money(g.limit), status: TM.budgetStatus(g.spent, g.limit).label })),
                spending_without_a_budget: b.unbudgeted.map(g => ({ group: g.key, label: g.label, spent: money(g.spent) })),
            },
            uncategorized: { count: unsorted.length, ...money(sumAmounts(unsorted)) },
        };
    });

    tool('list_transactions', {
        title: 'List transactions',
        description: 'Find transactions, newest first. Filter by month or a date range, text in the description, category, type, or only uncategorized expenses. Returns at most `limit` rows plus the total that matched.',
        input: {
            month: zMonth.optional(),
            from: zDate.optional().describe('First date (YYYY-MM-DD), instead of month'),
            to: zDate.optional().describe('Last date, inclusive (YYYY-MM-DD)'),
            search: z.string().optional().describe('Text the description contains (case-insensitive), e.g. "GOFOOD"'),
            category: z.string().optional().describe('Exact category name, or "Uncategorized"'),
            type: zType.optional(),
            uncategorized_only: z.boolean().optional().describe('Only expenses without a category'),
            limit: z.number().int().min(1).max(200).optional().describe('Default 50'),
        },
        annotations: READ,
    }, async ({ month, from, to, search, category, type, uncategorized_only, limit = 50 }) => {
        let query = db.from('int_bca_categorized').select(TX_COLS, { count: 'exact' });
        if (from || to) {
            if (from && !isDate(from)) fail(`"${from}" isn't a date. Use YYYY-MM-DD.`);
            if (to && !isDate(to)) fail(`"${to}" isn't a date. Use YYYY-MM-DD.`);
            if (from) query = query.gte('transaction_date', from);
            if (to) query = query.lte('transaction_date', to);
        } else if (month) {
            const day = await loadStartDay();
            const ym = monthArg(month, day);
            const b = periodBounds(ym, day);
            query = query.gte('transaction_date', b.start).lte('transaction_date', b.end);
        }
        if (search) query = query.ilike('description', `%${search.replace(/[%_\\]/g, '\\$&')}%`);
        if (uncategorized_only) query = query.neq('transaction_type', 'CR').eq('category', UNCATEGORIZED);
        else {
            if (type) query = type === 'income' ? query.eq('transaction_type', 'CR') : query.neq('transaction_type', 'CR');
            if (category) query = query.eq('category', category).neq('transaction_type', 'CR');
        }
        const { data, count } = await q(query.not('transaction_date', 'is', null)
            .order('transaction_date', { ascending: false }).order('id', { ascending: false }).limit(limit));
        const rows = normaliseTxns(data);
        return { matched: count, showing: rows.length, transactions: rows.map(txOut) };
    });

    tool('get_transaction', {
        title: 'Transaction details',
        description: 'One transaction by id: its details, where its category comes from (manual choice, keyword rule or none) and whether it was imported from a BCA email or added by hand.',
        input: { id: z.number().int() },
        annotations: READ,
    }, async ({ id }) => {
        const [t, base, rules] = await Promise.all([viewRow(id), baseRow(id), loadRules()]);
        if (!base) fail(`No transaction with id ${id}.`);
        if (!t) return { id, deleted: true, deleted_at: base.deleted_at, description: base.description, amount_text: TM.rp(base.amount), note: base.deleted_at ? 'This transaction is deleted. restore_transaction brings it back.' : 'This transaction has no usable date, so the app does not show it.' };
        const rule = ruleFor(rules, t.description);
        return {
            ...txOut(t),
            category_source: isIncome(t) ? 'income has no category'
                : base.category_override ? 'chosen by hand'
                : rule ? `rule "${rule.keyword}" (rule id ${rule.id})` : 'none',
            source: base.ref_no ? 'Imported from BCA email' : 'Added by hand',
        };
    });

    tool('list_categories', {
        title: 'List categories',
        description: 'The user\'s categories, each with its budget group and how many keyword rules file into it.',
        annotations: READ,
    }, async () => {
        const [cats, rules] = await Promise.all([loadCategories(), loadRules()]);
        return cats.map(c => ({
            id: c.id, name: c.name, icon: c.icon,
            budget_group: BUDGET_GROUPS[c.budget_group] ? c.budget_group : 'OTHER',
            budget_group_label: groupLabel(c.budget_group),
            rules: rules.filter(r => r.category === c.name).length,
        }));
    });

    tool('list_rules', {
        title: 'List rules',
        description: 'Keyword rules: an expense whose description contains the keyword is filed under the category (the longest matching keyword wins). Optionally filter by category or keyword text.',
        input: { category: z.string().optional(), search: z.string().optional() },
        annotations: READ,
    }, async ({ category, search }) => {
        let rules = await loadRules();
        if (category) rules = rules.filter(r => r.category === category);
        if (search) rules = rules.filter(r => String(r.keyword).includes(normaliseKeyword(search)));
        return rules;
    });

    tool('list_budgets', {
        title: 'List budgets',
        description: 'Monthly limits per budget group, with the months each applies to and whether it applies in the given month. Use month_summary for spending against them.',
        input: { month: zMonth.optional() },
        annotations: READ,
    }, async ({ month }) => {
        const day = await loadStartDay();
        const ym = monthArg(month, day);
        const [budgets, cats] = await Promise.all([loadBudgets(), loadCategories()]);
        return GROUP_KEYS.map(key => {
            const b = budgets[key];
            const categories = cats.filter(c => (BUDGET_GROUPS[c.budget_group] ? c.budget_group : 'OTHER') === key).map(c => c.name);
            if (!b) return { group: key, label: groupLabel(key), categories, budget: null };
            return {
                group: key, label: groupLabel(key), categories,
                budget: { ...money(b.amount), from: b.start, until: b.end === '9999-12' ? 'no end' : b.end, applies_in_month: ym >= b.start && ym <= b.end },
            };
        });
    });

    tool('get_settings', {
        title: 'Settings',
        description: 'The user\'s month start day (1 = calendar months, 15 = each month runs from the 15th to the 14th) and the dates of the current month.',
        annotations: READ,
    }, async () => {
        const day = await loadStartDay();
        const ym = thisMonth(new Date(), day);
        return { month_start_day: day, current_month: ym, current_month_label: TM.periodLabel(ym, day), current_month_dates: periodOut(ym, day) };
    });

    // --- writes: transactions ---
    tool('add_transaction', {
        title: 'Add transaction',
        description: 'Add a transaction by hand, like the app\'s Add transaction form. Leave the category out to let keyword rules decide. Confirm with the user first.',
        input: {
            date: zDate,
            description: z.string().min(1).describe('What it was, e.g. "Lunch at Hokben"'),
            amount: z.number().int().positive().describe('Whole rupiah, positive'),
            type: zType,
            category: z.string().optional().describe('Category name for an expense. Ignored for income.'),
        },
        annotations: WRITE,
    }, async ({ date, description, amount, type, category }) => {
        if (!isDate(date)) fail(`"${date}" isn't a date. Use YYYY-MM-DD.`);
        const dbType = toDbType(type);
        const cat = dbType === 'CR' ? null : await requireCategory(category);
        const row = { date, description: description.trim(), amount, type: dbType, category_override: overrideFor({ type: dbType, category: cat }) };
        const [saved] = await q(db.from('bca_transactions').insert([row]).select('id'));
        const t = await viewRow(saved.id);
        return { added: t ? txOut(t) : { id: saved.id, ...row }, undo: `delete_transaction with id ${saved.id}` };
    });

    tool('edit_transaction', {
        title: 'Edit transaction',
        description: 'Change a transaction\'s date, description, amount, type or category. Fields left out stay as they are. category: null clears a manual category so rules decide again. Confirm with the user first.',
        input: {
            id: z.number().int(),
            date: zDate.optional(),
            description: z.string().min(1).optional(),
            amount: z.number().int().positive().optional(),
            type: zType.optional(),
            category: z.string().nullable().optional().describe('Category name; null = let rules decide; omit = keep'),
        },
        annotations: WRITE,
    }, async ({ id, date, description, amount, type, category }) => {
        const [before, base] = await Promise.all([viewRow(id), baseRow(id)]);
        if (!base || base.deleted_at || !before) fail(`No visible transaction with id ${id}.`);
        if (date && !isDate(date)) fail(`"${date}" isn't a date. Use YYYY-MM-DD.`);
        const dbType = type ? toDbType(type) : base.type;
        let override;
        if (category === undefined) override = dbType === 'CR' ? null : base.category_override;
        else {
            const cat = category === null || category === UNCATEGORIZED ? null : await requireCategory(category);
            override = overrideFor({ type: dbType, category: cat, original: { override: base.category_override, category: before.category } });
        }
        // Only write what changed, so an imported row keeps its original text and date.
        const row = { category_override: override };
        if (date) row.date = date;
        if (description) row.description = description.trim();
        if (amount) row.amount = amount;
        if (type) row.type = dbType;
        await q(db.from('bca_transactions').update(row).eq('id', id));
        const after = await viewRow(id);
        return { before: txOut(before), after: after ? txOut(after) : row, undo: 'edit_transaction again with the "before" values' };
    });

    tool('delete_transaction', {
        title: 'Delete transaction',
        description: 'Delete a transaction. It is a soft delete, like the app\'s: the row is hidden everywhere but kept, so the email importer won\'t re-add it, and restore_transaction brings it back. Confirm with the user first.',
        input: { id: z.number().int() },
        annotations: DESTRUCTIVE,
    }, async ({ id }) => {
        const t = await viewRow(id);
        if (!t) fail(`No visible transaction with id ${id}.`);
        await q(db.from('bca_transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id));
        return { deleted: txOut(t), undo: `restore_transaction with id ${id}` };
    });

    tool('restore_transaction', {
        title: 'Restore transaction',
        description: 'Bring back a deleted transaction.',
        input: { id: z.number().int() },
        annotations: WRITE,
    }, async ({ id }) => {
        const base = await baseRow(id);
        if (!base) fail(`No transaction with id ${id}.`);
        if (!base.deleted_at) fail(`Transaction ${id} isn't deleted.`);
        await q(db.from('bca_transactions').update({ deleted_at: null }).eq('id', id));
        const t = await viewRow(id);
        return { restored: t ? txOut(t) : { id } };
    });

    tool('set_category', {
        title: 'Set category',
        description: 'File one or more expenses under a category by hand (this beats keyword rules). category: null removes the manual choice so rules decide again. Income is skipped. To file every future transaction from a merchant, use create_rule instead. Confirm with the user first.',
        input: {
            transaction_ids: z.array(z.number().int()).min(1).max(500),
            category: z.string().nullable(),
        },
        annotations: WRITE,
    }, async ({ transaction_ids, category }) => {
        const cat = category === null || category === UNCATEGORIZED ? null : await requireCategory(category);
        const ids = [...new Set(transaction_ids)];
        const rows = normaliseTxns(await q(db.from('int_bca_categorized').select(TX_COLS).in('id', ids)));
        const expenses = rows.filter(t => !isIncome(t));
        const skipped = ids.filter(id => !expenses.some(t => t.id === id));
        if (!expenses.length) fail('None of those ids are visible expenses.');
        await q(db.from('bca_transactions').update({ category_override: cat }).in('id', expenses.map(t => t.id)));
        return {
            changed: expenses.map(t => ({ id: t.id, merchant: TM.splitDescription(t.description).title, from: t.category, to: cat || 'decided by rules' })),
            ...(skipped.length ? { skipped_not_found_or_income: skipped } : {}),
            undo: 'set_category for each id back to its "from" category',
        };
    });

    // --- writes: rules ---
    async function ruleImpact(keyword) {
        // Unsorted expenses this keyword would pick up (what the app's toast reports).
        const rows = normaliseTxns(await fetchAll(() => db.from('int_bca_categorized').select(TX_COLS)
            .ilike('description', `%${keyword.replace(/[%_\\]/g, '\\$&')}%`).order('id')));
        return { matching_transactions: rows.length, previously_uncategorized: rows.filter(isUnsorted).length };
    }

    tool('create_rule', {
        title: 'Create rule',
        description: 'File every expense whose description contains `keyword` under `category`, now and in future imports. Keywords are stored upper-case. Confirm with the user first.',
        input: { keyword: z.string().min(1), category: z.string() },
        annotations: WRITE,
    }, async ({ keyword, category }) => {
        const k = normaliseKeyword(keyword);
        if (!k) fail('Enter a keyword.');
        const [rules, cat] = await Promise.all([loadRules(), requireCategory(category)]);
        const dup = ruleByKeyword(rules, k);
        if (dup) fail(`${k} already files to ${dup.category} (rule id ${dup.id}). Use edit_rule to change it.`);
        const before = await ruleImpact(k);
        const [saved] = await q(db.from('merchant_mapping').insert([{ keyword: k, category: cat }]).select('id, keyword, category'));
        return { created: saved, sorted_uncategorized_transactions: before.previously_uncategorized, undo: `delete_rule with id ${saved.id}` };
    });

    tool('edit_rule', {
        title: 'Edit rule',
        description: 'Change a rule\'s keyword or category. Confirm with the user first.',
        input: { id: z.number().int(), keyword: z.string().min(1).optional(), category: z.string().optional() },
        annotations: WRITE,
    }, async ({ id, keyword, category }) => {
        const rules = await loadRules();
        const rule = rules.find(r => r.id === id);
        if (!rule) fail(`No rule with id ${id}.`);
        const k = keyword ? normaliseKeyword(keyword) : rule.keyword;
        const dup = ruleByKeyword(rules, k);
        if (dup && dup.id !== id) fail(`${k} already files to ${dup.category} (rule id ${dup.id}).`);
        const cat = category ? await requireCategory(category) : rule.category;
        const [saved] = await q(db.from('merchant_mapping').update({ keyword: k, category: cat }).eq('id', id).select('id, keyword, category'));
        return { before: rule, after: saved, undo: `edit_rule id ${id} back to keyword "${rule.keyword}", category "${rule.category}"` };
    });

    tool('delete_rule', {
        title: 'Delete rule',
        description: 'Delete a keyword rule. Transactions it filed go back to Uncategorized unless another rule or a manual choice covers them. Confirm with the user first.',
        input: { id: z.number().int() },
        annotations: DESTRUCTIVE,
    }, async ({ id }) => {
        const rule = (await loadRules()).find(r => r.id === id);
        if (!rule) fail(`No rule with id ${id}.`);
        await q(db.from('merchant_mapping').delete().eq('id', id));
        return { deleted: rule, undo: `create_rule with keyword "${rule.keyword}" and category "${rule.category}"` };
    });

    // --- writes: categories ---
    function checkName(name, cats, exceptId) {
        const n = String(name || '').trim();
        if (!n) fail('Give the category a name.');
        if (n.toLowerCase() === UNCATEGORIZED.toLowerCase()) fail('That name is reserved for transactions without a category.');
        const clash = cats.find(c => c.name.toLowerCase() === n.toLowerCase() && c.id !== exceptId);
        if (clash) fail(`${clash.name} already exists.`);
        return n;
    }
    const zIcon = z.enum(CATEGORY_ICONS.length ? CATEGORY_ICONS : ['category']);

    tool('create_category', {
        title: 'Create category',
        description: 'Add a category and choose the budget group it counts toward. Confirm with the user first.',
        input: { name: z.string().min(1), budget_group: zGroup.optional().describe('Default OTHER'), icon: zIcon.optional() },
        annotations: WRITE,
    }, async ({ name, budget_group = 'OTHER', icon = CATEGORY_ICONS[0] }) => {
        const cats = await loadCategories();
        const n = checkName(name, cats);
        const sort = cats.reduce((m, c) => Math.max(m, Number(c.sort_order) || 0), 0) + 1;
        const [saved] = await q(db.from('categories').insert([{ name: n, icon, budget_group, sort_order: sort }]).select('id, name, icon, budget_group'));
        return { created: saved, undo: `delete_category "${n}"` };
    });

    tool('edit_category', {
        title: 'Edit category',
        description: 'Rename a category, change its icon, or move it to another budget group. A rename carries over to its rules and to transactions filed under it by hand. Confirm with the user first.',
        input: { name: z.string().describe('Current name'), new_name: z.string().min(1).optional(), budget_group: zGroup.optional(), icon: zIcon.optional() },
        annotations: WRITE,
    }, async ({ name, new_name, budget_group, icon }) => {
        const cats = await loadCategories();
        const cat = cats.find(c => c.name === name) || cats.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (!cat) fail(`There's no category called "${name}".`);
        const n = new_name ? checkName(new_name, cats, cat.id) : cat.name;
        const row = { name: n, icon: icon || cat.icon, budget_group: budget_group || cat.budget_group };
        await q(db.from('categories').update(row).eq('id', cat.id));
        const result = { before: { name: cat.name, icon: cat.icon, budget_group: cat.budget_group }, after: row };
        if (n !== cat.name) {
            // Rules and overrides store the category as text, so they follow a rename (js/rules.js).
            const errors = [];
            const r = await db.from('merchant_mapping').update({ category: n }).eq('category', cat.name).select('id');
            if (r.error) errors.push(`rules: ${r.error.message}`);
            const t = await db.from('bca_transactions').update({ category_override: n }).eq('category_override', cat.name).select('id');
            if (t.error) errors.push(`transactions: ${t.error.message}`);
            result.rules_moved = r.data ? r.data.length : 0;
            result.transactions_moved = t.data ? t.data.length : 0;
            if (errors.length) result.warning = `Renamed, but some rules or transactions still point at the old name "${cat.name}": ${errors.join('; ')}. Tell the user.`;
        }
        result.undo = `edit_category "${n}" back to ${JSON.stringify(result.before)}`;
        return result;
    });

    tool('delete_category', {
        title: 'Delete category',
        description: 'Delete a category. Its transactions become Uncategorized; its rules are kept but pointed at Uncategorized, so they can be re-filed later. This can\'t be fully undone: the hand-picked categories on its transactions are cleared. Confirm with the user first, and say how many transactions and rules are affected (use month_summary / list_rules / list_transactions).',
        input: { name: z.string() },
        annotations: DESTRUCTIVE,
    }, async ({ name }) => {
        const cats = await loadCategories();
        const cat = cats.find(c => c.name === name) || cats.find(c => c.name.toLowerCase() === name.toLowerCase());
        if (!cat) fail(`There's no category called "${name}".`);
        await q(db.from('categories').delete().eq('id', cat.id));
        const errors = [];
        const r = await db.from('merchant_mapping').update({ category: UNCATEGORIZED }).eq('category', cat.name).select('id, keyword');
        if (r.error) errors.push(`rules: ${r.error.message}`);
        const t = await db.from('bca_transactions').update({ category_override: null }).eq('category_override', cat.name).select('id');
        if (t.error) errors.push(`transactions: ${t.error.message}`);
        return {
            deleted: { name: cat.name, icon: cat.icon, budget_group: cat.budget_group },
            rules_now_uncategorized: r.data ? r.data.map(x => x.keyword) : [],
            hand_picked_transactions_cleared: t.data ? t.data.length : 0,
            ...(errors.length ? { warning: `Deleted, but some links weren't updated: ${errors.join('; ')}` } : {}),
            undo: 'create_category with the same name, then edit_rule each listed rule back to it',
        };
    });

    // --- writes: budgets ---
    tool('set_budget', {
        title: 'Set budget',
        description: 'Set a monthly limit for a budget group, like the app\'s budget sheet. period "ongoing" applies from `month` with no end (and keeps an earlier start if the budget already ran before); "month_only" applies to `month` alone; "until" runs from `month` through `until`. Each group has one budget, so this replaces the current one. Confirm with the user first.',
        input: {
            group: zGroup,
            amount: z.number().int().positive().describe('Monthly limit in whole rupiah'),
            period: z.enum(['ongoing', 'month_only', 'until']).optional().describe('Default ongoing'),
            month: zMonth.optional(),
            until: zMonth.optional().describe('Last month, for period "until"'),
        },
        annotations: WRITE,
    }, async ({ group, amount, period = 'ongoing', month, until }) => {
        const ym = monthArg(month, await loadStartDay());
        if (period === 'until' && (!until || !isMonth(until) || until < ym)) fail('For period "until", give an `until` month (YYYY-MM) on or after `month`.');
        const budgets = await loadBudgets();
        const existing = budgets[group] || null;
        const { start, end } = budgetRange(existing, ym, { ongoing: 'none', month_only: 'only', until: 'until' }[period], until);
        await q(db.from('budgets').upsert({ grp: group, amount, start_month: start, end_month: end }, { onConflict: 'user_id,grp' }));
        const show = (b) => b && ({ ...money(b.amount), from: b.start, until: b.end === '9999-12' ? 'no end' : b.end });
        return {
            group, label: groupLabel(group),
            before: show(existing) || null,
            after: show({ amount, start, end }),
            undo: existing ? `set_budget back to the "before" values` : `remove_budget ${group}`,
        };
    });

    tool('set_month_start_day', {
        title: 'Set month start day',
        description: 'Set the day budget months start on, 1 to 28 (1 = calendar months). Home, Activity, Budget and every month in these tools then count from that day. Budgets keep their amounts and months. Confirm with the user first.',
        input: { day: z.number().int().min(1).max(28) },
        annotations: WRITE,
    }, async ({ day }) => {
        const before = await loadStartDay();
        const { error } = await db.from('user_settings').upsert({ month_start_day: day }, { onConflict: 'user_id' });
        if (error) fail(/user_settings/.test(error.message || '') && /exist|schema cache/i.test(error.message || '')
            ? 'The app\'s database doesn\'t have the user_settings table yet. Apply the month start day migration first.'
            : `Supabase error: ${error.message}`);
        const ym = thisMonth(new Date(), day);
        return {
            before: { month_start_day: before }, after: { month_start_day: day },
            current_month: ym, current_month_dates: periodOut(ym, day),
            undo: `set_month_start_day with day ${before}`,
        };
    });

    tool('remove_budget', {
        title: 'Remove budget',
        description: 'Remove a budget group\'s limit. Spending stays; only the limit goes. Confirm with the user first.',
        input: { group: zGroup },
        annotations: DESTRUCTIVE,
    }, async ({ group }) => {
        const existing = (await loadBudgets())[group];
        if (!existing) fail(`${groupLabel(group)} has no budget.`);
        await q(db.from('budgets').delete().eq('grp', group));
        return { removed: { group, label: groupLabel(group), ...money(existing.amount), from: existing.start, until: existing.end === '9999-12' ? 'no end' : existing.end }, undo: 'set_budget with those values' };
    });
}
