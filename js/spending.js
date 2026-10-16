/* Spending by category: every category with spending in the month. */
'use strict';

function renderSpending() {
    const ym = Month.get();
    const host = qs('#spending-content');
    const expenses = expensesIn(ym);
    const total = sumAmounts(expenses);

    if (!expenses.length) {
        host.innerHTML = `<div class="empty mt-2">
            ${icon('donut_large')}
            <h2>Nothing spent.</h2>
            <p>No expenses recorded for ${esc(monthName(ym))}. Your wallet thanks you.</p>
        </div>`;
        return;
    }

    const by = {};
    expenses.forEach(t => {
        const k = t.category || UNCATEGORIZED;
        by[k] = by[k] || { name: k, amount: 0, count: 0 };
        by[k].amount += t.amount;
        by[k].count += 1;
    });
    const rows = Object.values(by).sort((a, b) => b.amount - a.amount);
    const max = rows[0].amount;

    // Doughnut as a conic gradient: one stop per category, Uncategorized in line-strong.
    let at = 0;
    const stops = rows.map(r => {
        const v = categoryVisual(r.name);
        const from = at;
        at += (r.amount / total) * 100;
        return `${v.none ? 'var(--line-strong)' : `var(--cat-${v.token})`} ${from.toFixed(2)}% ${at.toFixed(2)}%`;
    }).join(', ');

    host.innerHTML = `
        <section class="card p-4 md:p-5 flex gap-4 md:gap-5 items-center">
            <div role="img" aria-label="Share of ${esc(monthName(ym))} spending by category" class="w-32 h-32 shrink-0 rounded-full grid place-items-center" style="background: conic-gradient(${stops})">
                <div class="w-[84px] h-[84px] rounded-full bg-surface grid place-items-center text-center text-caption text-muted leading-[15px]">${rows.length}<br>${rows.length === 1 ? 'category' : 'categories'}</div>
            </div>
            <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-label text-muted">Spent in ${esc(monthName(ym))}</span>
                <span class="font-serif text-[30px] leading-[34px] md:text-[34px] md:leading-[38px] tnum" style="overflow-wrap:anywhere">${esc(TM.rp(total))}</span>
                <span class="text-label text-muted">${TM.plural(expenses.length, 'expense')}</span>
            </div>
        </section>
        <section class="card px-4 py-1" aria-label="Categories">
            ${rows.map((r, i) => {
                const v = categoryVisual(r.name);
                const href = v.none ? 'activity.html?filter=unsorted' : `activity.html?category=${encodeURIComponent(r.name)}`;
                return `<a href="${href}" class="flex gap-3 items-center py-3.5 ${i ? 'border-t border-sunken' : ''}">
                    ${tileHTML(r.name)}
                    <span class="flex-1 min-w-0 flex flex-col gap-1.5">
                        <span class="flex justify-between gap-2 items-baseline"><span class="text-[15px] font-semibold truncate">${esc(r.name)}</span><span class="text-[15px] font-semibold whitespace-nowrap tnum">${esc(TM.rp(r.amount))}</span></span>
                        <span class="bar bar--xs"><span class="bar-fill" style="width: ${Math.round(r.amount / max * 100)}%; background: ${v.none ? 'var(--faint)' : `var(--cat-${v.token})`}"></span></span>
                        <span class="flex justify-between text-caption text-muted tnum"><span>${TM.plural(r.count, 'transaction')}</span><span>${Math.round(r.amount / total * 100)}% of spending</span></span>
                    </span>
                    ${icon('chevron_right', 'text-[20px] text-faint')}
                </a>`;
            }).join('')}
        </section>
        <a href="categories.html#rules" class="btn btn-secondary">${icon('rule', 'text-[20px]')}Manage categories and rules</a>`;
}

App.start({
    pushed: { title: 'Spending by category', back: 'index.html', narrow: true },
    async init() {
        mountMonth(() => renderSpending(), () => '');
        await Promise.all([loadCategories(), loadTransactions()]);
        qs('#main').removeAttribute('aria-busy');
        renderSpending();
    },
});
