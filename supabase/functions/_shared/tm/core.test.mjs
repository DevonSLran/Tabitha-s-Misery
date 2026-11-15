// Unit tests for the connector's ported app logic. Run: node --test supabase/functions/_shared/tm/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
    BUDGET_GROUPS, CATEGORY_ICONS,
    budgetSummary, budgetMap, groupOf, ruleFor, spendingByCategory, budgetRange, overrideFor,
    normaliseTxns, unsortedIn, expensesIn, incomeIn, sumAmounts, isDate, isMonth, NO_END, UNCATEGORIZED,
    startDay, periodOf, periodBounds, thisMonth, txMonth,
} from './core.mjs';

// js/format.js is a plain browser script that sets globalThis.TM.
createRequire(import.meta.url)(new URL('../../../../js/format.js', import.meta.url).pathname);
const TM = globalThis.TM;

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

test('month start day: dates count toward the month that started on that day', () => {
    assert.equal(periodOf('2026-11-14', 15), '2026-10');
    assert.equal(periodOf('2026-11-15', 15), '2026-11');
    assert.equal(periodOf('2026-01-03', 15), '2025-12');
    assert.equal(periodOf('2026-11-01', 1), '2026-11');
    assert.equal(periodOf('', 15), '');
    assert.deepEqual(periodBounds('2026-11', 15), { start: '2026-11-15', end: '2026-12-14' });
    assert.deepEqual(periodBounds('2026-12', 15), { start: '2026-12-15', end: '2027-01-14' });
    assert.deepEqual(periodBounds('2024-02', 1), { start: '2024-02-01', end: '2024-02-29' });
    assert.deepEqual(periodBounds('2026-01', 28), { start: '2026-01-28', end: '2026-02-27' });
    assert.equal(thisMonth(new Date(2026, 10, 14), 15), '2026-10');
    assert.equal(thisMonth(new Date(2026, 10, 15), 15), '2026-11');
    assert.equal(startDay(0), 1);
    assert.equal(startDay(29), 1);
    assert.equal(startDay('15'), 15);
});

test('month start day: totals and budgets follow the start day', () => {
    const list = normaliseTxns([
        tx(1, '2026-11-14', 10000, 'DB', 'Food & Dining'), // still October's month
        tx(2, '2026-11-15', 20000, 'DB', 'Food & Dining'),
        tx(3, '2026-12-14', 30000, 'DB', 'Food & Dining'),
        tx(4, '2026-12-15', 40000, 'DB', 'Food & Dining'), // December's month
        tx(5, '2026-11-16', 2500000, 'CR', null),
    ]);
    assert.equal(sumAmounts(expensesIn(list, '2026-11', 15)), 50000);
    assert.equal(sumAmounts(expensesIn(list, '2026-10', 15)), 10000);
    assert.equal(sumAmounts(incomeIn(list, '2026-11', 15)), 2500000);
    assert.equal(sumAmounts(expensesIn(list, '2026-11')), 30000); // calendar months by default
    const budgets = budgetMap([{ grp: 'FOOD', amount: 900000, start_month: '2026-11', end_month: NO_END }]);
    const s = budgetSummary({ txns: list, categories, budgets, startDay: 15 }, '2026-11');
    assert.deepEqual(s.budgeted.map(g => [g.key, g.spent, g.limit]), [['FOOD', 50000, 900000]]);
    assert.equal(budgetSummary({ txns: list, categories, budgets, startDay: 15 }, '2026-10').limit, 0);
    assert.equal(txMonth(list[0], 15), '2026-12');
});

test('month start day: core.mjs agrees with js/format.js', () => {
    const dates = [];
    for (let d = new Date(Date.UTC(2025, 11, 1)); d < new Date(Date.UTC(2027, 2, 1)); d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
    for (const day of [1, 2, 15, 27, 28]) {
        for (const iso of dates) assert.equal(periodOf(iso, day), TM.periodOf(iso, day), `${iso} @ ${day}`);
        for (const ym of ['2025-12', '2026-01', '2026-02', '2026-11', '2026-12', '2027-01']) {
            assert.deepEqual(periodBounds(ym, day), TM.periodBounds(ym, day), `${ym} @ ${day}`);
        }
    }
    assert.equal(TM.periodLabel('2026-11', 15), '15 Nov – 14 Dec 2026');
    assert.equal(TM.periodLabel('2026-12', 15), '15 Dec 2026 – 14 Jan 2027');
    assert.equal(TM.periodLabel('2026-11', 1), 'November 2026');
    assert.deepEqual(TM.monthProgress('2026-11', new Date(2026, 10, 15), 15), { pct: 3, day: 1, days: 30, daysLeft: 30 });
    assert.deepEqual(TM.monthProgress('2026-11', new Date(2026, 10, 15)), { pct: 50, day: 15, days: 30, daysLeft: 16 });
});
