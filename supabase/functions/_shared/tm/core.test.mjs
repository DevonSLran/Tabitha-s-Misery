// Unit tests for the connector's ported app logic. Run: node --test supabase/functions/_shared/tm/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    BUDGET_GROUPS, CATEGORY_ICONS,
    budgetSummary, budgetMap, groupOf, ruleFor, spendingByCategory, budgetRange, overrideFor,
    normaliseTxns, unsortedIn, expensesIn, incomeIn, sumAmounts, isDate, isMonth, NO_END, UNCATEGORIZED,
} from './core.mjs';

const categories = [
    { id: 1, name: 'Food & Dining', budget_group: 'FOOD', sort_order: 1 },
    { id: 2, name: 'Transportation', budget_group: 'TRANSPORT', sort_order: 2 },
    { id: 3, name: 'Pets', budget_group: 'NOT_A_GROUP', sort_order: 3 },
];
const tx = (id, date, amount, type, category) => ({ id, transaction_date: date, description: `TX ${id}`, amount: String(amount), transaction_type: type, category });
const txns = normaliseTxns([
    tx(1, '2026-10-01', 50000, 'DB', 'Food & Dining'),
    tx(2, '2026-10-02', 20000, 'DB', 'Transportation'),
    tx(3, '2026-10-03', 15000, 'DB', UNCATEGORIZED),
    tx(4, '2026-10-04', 30000, 'DB', 'Pets'),
    tx(5, '2026-10-05', 1000000, 'CR', 'Food & Dining'), // the view categorises income too; the app ignores it
    tx(6, '2026-09-30', 99000, 'DB', 'Food & Dining'),
    tx(7, null, 1, 'DB', 'Food & Dining'),
]);

test('normaliseTxns drops undated rows, makes amounts numbers, newest first', () => {
    assert.deepEqual(txns.map(t => t.id), [5, 4, 3, 2, 1, 6]);
    assert.equal(typeof txns[0].amount, 'number');
});

test('month totals split expenses and income', () => {
    assert.equal(sumAmounts(expensesIn(txns, '2026-10')), 115000);
    assert.equal(sumAmounts(incomeIn(txns, '2026-10')), 1000000);
    assert.deepEqual(unsortedIn(txns, '2026-10').map(t => t.id), [3]);
});

test('groupOf: Uncategorized counts toward none, unknown groups toward OTHER', () => {
    assert.equal(groupOf(categories, UNCATEGORIZED), null);
    assert.equal(groupOf(categories, ''), null);
    assert.equal(groupOf(categories, 'Food & Dining'), 'FOOD');
    assert.equal(groupOf(categories, 'Pets'), 'OTHER');
    assert.equal(groupOf(categories, 'Deleted category'), 'OTHER');
});

test('budgetSummary only totals groups with a limit in that month', () => {
    const budgets = budgetMap([
        { grp: 'FOOD', amount: 100000, start_month: '2026-09', end_month: NO_END },
        { grp: 'TRANSPORT', amount: 10000, start_month: '2026-11', end_month: NO_END },
    ]);
    const s = budgetSummary({ txns, categories, budgets }, '2026-10');
    assert.deepEqual(s.budgeted.map(g => [g.key, g.spent, g.limit]), [['FOOD', 50000, 100000]]);
    assert.equal(s.spent, 50000);
    assert.equal(s.limit, 100000);
    assert.deepEqual(s.unbudgeted.map(g => [g.key, g.spent]), [['TRANSPORT', 20000], ['OTHER', 30000]]);
});

test('spendingByCategory buckets expenses, biggest first, income excluded', () => {
    assert.deepEqual(spendingByCategory(txns, '2026-10').map(c => [c.category, c.amount]),
        [['Food & Dining', 50000], ['Pets', 30000], ['Transportation', 20000], [UNCATEGORIZED, 15000]]);
});

test('ruleFor: longest matching keyword wins, case-insensitive', () => {
    const rules = [{ id: 1, keyword: 'GO', category: 'Transportation' }, { id: 2, keyword: 'gofood', category: 'Food & Dining' }];
    assert.equal(ruleFor(rules, 'QRIS GOFOOD JAKARTA').id, 2);
    assert.equal(ruleFor(rules, 'GOJEK').id, 1);
    assert.equal(ruleFor(rules, 'INDOMARET'), null);
});

test('budgetRange matches the app budget sheet', () => {
    const ongoing = { amount: 1, start: '2026-08', end: NO_END };
    assert.deepEqual(budgetRange(null, '2026-10', 'none'), { start: '2026-10', end: NO_END });
    assert.deepEqual(budgetRange(ongoing, '2026-10', 'none'), { start: '2026-08', end: NO_END });
    assert.deepEqual(budgetRange({ ...ongoing, start: '2026-12' }, '2026-10', 'none'), { start: '2026-10', end: NO_END });
    assert.deepEqual(budgetRange(ongoing, '2026-10', 'only'), { start: '2026-10', end: '2026-10' });
    assert.deepEqual(budgetRange(null, '2026-10', 'until', '2026-12'), { start: '2026-10', end: '2026-12' });
});

test('overrideFor keeps rule-given categories rule-driven and income uncategorised', () => {
    assert.equal(overrideFor({ type: 'CR', category: 'Food & Dining' }), null);
    assert.equal(overrideFor({ type: 'DB', category: 'Food & Dining' }), 'Food & Dining');
    assert.equal(overrideFor({ type: 'DB', category: UNCATEGORIZED }), null);
    // Rules already file it as Food; picking Food again doesn't pin it.
    assert.equal(overrideFor({ type: 'DB', category: 'Food & Dining', original: { override: null, category: 'Food & Dining' } }), null);
    // A different pick does.
    assert.equal(overrideFor({ type: 'DB', category: 'Pets', original: { override: null, category: 'Food & Dining' } }), 'Pets');
    // An existing manual pick stays manual.
    assert.equal(overrideFor({ type: 'DB', category: 'Pets', original: { override: 'Pets', category: 'Pets' } }), 'Pets');
});

test('date and month validation', () => {
    assert.ok(isDate('2026-02-28'));
    assert.ok(!isDate('2026-02-30'));
    assert.ok(!isDate('28/02/2026'));
    assert.ok(isMonth('2026-12'));
    assert.ok(!isMonth('2026-13'));
});

test('constants match js/app.js', () => {
    const app = readFileSync(new URL('../../../../js/app.js', import.meta.url), 'utf8');
    const icons = JSON.parse(app.match(/CATEGORY_ICONS\s*=\s*(\[[^\]]*\])/)[1].replace(/'/g, '"'));
    assert.deepEqual(CATEGORY_ICONS, icons);
    const groups = app.match(/const BUDGET_GROUPS = \{([\s\S]*?)\n\};/)[1];
    assert.deepEqual(Object.keys(BUDGET_GROUPS), [...groups.matchAll(/^\s+(\w+):/gm)].map(m => m[1]));
    for (const [key, g] of Object.entries(BUDGET_GROUPS)) assert.ok(groups.includes(`label: '${g.label}'`), `${key} label`);
    assert.match(app, /const UNCATEGORIZED = 'Uncategorized';/);
    assert.match(app, /const NO_END = '9999-12';/);
});

test('the function bundle carries an exact copy of js/format.js', () => {
    const a = readFileSync(new URL('../../../../js/format.js', import.meta.url), 'utf8');
    const b = readFileSync(new URL('./format.js', import.meta.url), 'utf8');
    assert.equal(b, a, 'run `npm run sync:fn` to copy js/format.js into supabase/functions/_shared/tm/');
});
