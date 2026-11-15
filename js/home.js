/* Home: what this month has cost so far. */
'use strict';

function heroHTML(ym, spent) {
    const size = TM.heroClass(spent);
    const prev = shiftMonth(ym, -1);
    const p = monthProgress(ym);
    let compare = '';
    // Current month: compare with the previous month up to the same day of it.
    // Past months: compare whole months.
    const prevSpent = p.day
        ? sumAmounts(expensesIn(prev).filter(t => dayInMonth(t, prev) <= p.day))
        : sumAmounts(expensesIn(prev));
    if (spent || prevSpent) {
        const diff = spent - prevSpent;
        const sameDay = TM.periodDate(prev, monthStartDay(), Math.min(p.day, monthProgress(prev).days) - 1);
        const against = p.day ? `by ${TM.dayMonth(sameDay)}` : monthName(prev);
        compare = diff === 0
            ? `The same as ${p.day ? against : 'in ' + against}`
            : `${icon(diff > 0 ? 'north_east' : 'south_east', 'text-[16px]')}${esc(TM.rp(Math.abs(diff)))} ${diff > 0 ? 'more' : 'less'} than ${esc(against)}`;
    }
    return `<div class="flex flex-col gap-1">
            <span class="text-body-s text-muted">Spent in ${esc(monthName(ym))}</span>
            <span class="font-serif ${size} ${size === 'text-money' ? 'md:text-money-xl' : ''} flex items-baseline gap-2 tnum"><span class="text-[0.5em] text-muted">Rp</span>${esc(dots(spent))}</span>
            ${compare ? `<span class="text-label md:text-body-s text-muted flex items-center gap-1.5 tnum">${compare}</span>` : ''}
        </div>`;
}

function budgetsBlockHTML(ym) {
    const sum = budgetSummary(ym);
    if (!sum.limit) {
        return `<a href="budget.html" class="flex items-center justify-between gap-3 min-h-11">
            <span class="flex flex-col"><span class="text-[15px] font-semibold">Budgets</span><span class="text-label text-muted">No limits set for ${esc(monthName(ym))}.</span></span>
            <span class="link text-body-s whitespace-nowrap">Set a budget →</span></a>`;
    }
    const s = TM.budgetStatus(sum.spent, sum.limit);
    const p = monthProgress(ym);
    const tick = p.day ? `<span class="bar-tick" style="left: ${p.pct}%" aria-hidden="true"></span>` : '';
    return `<a href="budget.html" class="flex flex-col gap-2.5" aria-label="Budgets: ${esc(s.pctLabel)}, ${esc(TM.rp(sum.spent))} of ${esc(TM.rp(sum.limit))}">
        <span class="flex justify-between items-center gap-2"><span class="text-[15px] font-semibold">Budgets</span><span class="pill pill--${s.key}">${icon(s.icon)}${esc(s.pctLabel)}</span></span>
        <span class="bar md:bar--l"><span class="bar-fill bar-fill--${s.key}" style="width: ${s.barWidth}"></span>${tick}</span>
        <span class="flex flex-wrap justify-between gap-2 text-label md:text-body-s text-muted tnum">
            <span>${esc(TM.rp(sum.spent))} of ${esc(TM.rp(sum.limit))}</span>
            ${s.over ? `<span class="text-negative font-semibold">${esc(TM.rp(s.overBy))} over</span>` : `<span class="text-text font-medium">${esc(TM.rp(s.left))} left</span>`}
        </span>
        ${p.day ? `<span class="text-caption text-muted">${p.pct}% of the month gone (the tick). ${TM.plural(p.daysLeft, 'day')} to go.</span>` : ''}
    </a>`;
}

function statsHTML(ym, spent) {
    const income = sumAmounts(incomeIn(ym));
    const net = income - spent;
    const current = ym === thisMonth();
    return `<div class="grid grid-cols-2 gap-3">
        <div class="card-m px-3.5 py-3 md:p-4 flex flex-col gap-0.5 min-w-0"><span class="text-label text-muted">Income</span><span class="text-[16px] md:text-[18px] font-semibold text-positive whitespace-nowrap tnum">+${esc(TM.rp(income))}</span></div>
        <div class="card-m px-3.5 py-3 md:p-4 flex flex-col gap-0.5 min-w-0"><span class="text-label text-muted">${current ? 'Net so far' : 'Net'}</span><span class="text-[16px] md:text-[18px] font-semibold whitespace-nowrap tnum">${net < 0 ? '−' : '+'}${esc(TM.rp(net))}</span></div>
    </div>`;
}

function nudgeHTML(ym) {
    const loose = unsortedIn(ym);
    if (!loose.length) return '';
    return `<a href="categories.html#sort" class="flex md:flex-1 md:flex-col md:items-start md:justify-between gap-3 md:gap-4 items-center bg-accent-soft rounded-m pl-3.5 pr-3 py-3 md:p-5">
        <span class="flex gap-3 items-center flex-1 min-w-0 md:flex-none">
            <span class="tile border-[1.5px] border-dashed border-accent text-accent">${icon('label_off')}</span>
            <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-[15px] md:text-body font-semibold">${TM.plural(loose.length, 'expense')} ${loose.length === 1 ? 'needs' : 'need'} a category</span>
                <span class="text-label md:text-body-s text-accent-text tnum">${esc(TM.rp(sumAmounts(loose)))} is wandering around unlabelled.</span>
            </span>
        </span>
        <span class="inline-flex items-center h-9 md:h-10 rounded-full bg-ink text-on-ink text-body-s font-semibold px-3.5 md:px-4 shrink-0">Sort</span>
    </a>`;
}

function dayChartHTML(ym) {
    const p = monthProgress(ym);
    const today = p.day || (ym < thisMonth() ? p.days : 0);
    const daily = Array.from({ length: p.days }, () => 0);
    expensesIn(ym).forEach(t => { daily[dayInMonth(t, ym) - 1] += t.amount; });
    const dateAt = (i) => TM.periodDate(ym, monthStartDay(), i); // bar i -> "YYYY-MM-DD"
    const max = Math.max(...daily.slice(0, today || p.days));
    const top = niceAxisMax(max);
    let peak = 0;
    daily.forEach((v, i) => { if (v > daily[peak]) peak = i; });

    const bars = daily.map((v, i) => {
        const d = i + 1;
        if (p.day && d > p.day) return `<span class="day-bar bg-sunken" style="height: 3px" data-day="${d}"></span>`;
        const h = v ? Math.max(2, (v / top) * 100) : 0;
        const color = p.day && d === p.day ? 'bg-accent' : 'bg-text-2';
        return `<span class="day-bar ${color}" style="height: ${h.toFixed(2)}%" data-day="${d}" data-amount="${v}"></span>`;
    }).join('');
    // Axis labels show the date of the 1st, 8th, 15th… bar of the month.
    const label = (set) => daily.map((_, i) => `<span>${set.includes(i + 1) ? Number(dateAt(i).slice(8)) : ''}</span>`).join('');
    const ticks = [top, top * 2 / 3, top / 3];
    const aria = max
        ? `Daily spending, ${TM.dayMonth(dateAt(0))} to ${TM.dayMonth(dateAt((today || p.days) - 1))}. Highest: ${TM.rp(daily[peak])} on ${TM.dayMonth(dateAt(peak))}.`
        : `No spending recorded in ${monthName(ym)}.`;

    return `<section class="card px-4 pt-4 pb-3 md:p-6 flex flex-col gap-3 md:gap-4" aria-label="Daily spending">
        <div class="flex justify-between items-baseline gap-3">
            <h2 class="section-title md:text-[17px]">Day by day</h2>
            <span class="text-caption text-muted tnum text-right" data-chart-readout aria-live="polite">${p.day ? '<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-[2px] bg-accent"></span>Today</span>' : ''}</span>
        </div>
        <div class="flex gap-2 md:gap-2.5">
            <div class="chart-axis" aria-hidden="true">
                ${ticks.map((v, i) => `<span style="top: ${(i * 100 / 3).toFixed(2)}%">${TM.rpCompact(v)}</span>`).join('')}
                <span style="top: 100%">0</span>
            </div>
            <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                <div class="day-chart" role="img" aria-label="${esc(aria)}" data-ym="${ym}">
                    <span class="gridline" style="top: 0"></span><span class="gridline" style="top: 33.33%"></span><span class="gridline" style="top: 66.67%"></span>
                    ${bars}
                </div>
                <div class="chart-days md:hidden" aria-hidden="true">${label([1, 8, 15, 22, 29])}</div>
                <div class="chart-days hidden md:flex" aria-hidden="true">${label([1, 5, 10, 15, 20, 25, 30])}</div>
            </div>
        </div>
    </section>`;
}

/** Tap or hover a day to read its total. */
function bindChartReadout(root) {
    const chart = qs('.day-chart', root);
    const out = qs('[data-chart-readout]', root);
    if (!chart || !out) return;
    const idle = out.innerHTML;
    const ym = chart.dataset.ym;
    const show = (e) => {
        const bars = qsa('.day-bar', chart);
        const r = chart.getBoundingClientRect();
        const i = Math.min(bars.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * bars.length)));
        const bar = bars[i];
        if (bar.dataset.amount == null) { out.innerHTML = idle; return; }
        out.textContent = `${TM.dateShort(TM.periodDate(ym, monthStartDay(), i))} · ${TM.rp(Number(bar.dataset.amount))}`;
    };
    chart.addEventListener('pointermove', show);
    chart.addEventListener('pointerdown', show);
    chart.addEventListener('pointerleave', () => { out.innerHTML = idle; });
}

function whereItWentHTML(ym) {
    const by = {};
    expensesIn(ym).forEach(t => {
        const k = t.category || UNCATEGORIZED;
        by[k] = by[k] || { name: k, amount: 0, count: 0 };
        by[k].amount += t.amount;
        by[k].count += 1;
    });
    const rows = Object.values(by).sort((a, b) => b.amount - a.amount);
    if (!rows.length) return '';
    const total = sumAmounts(expensesIn(ym));
    const max = rows[0].amount;
    return `<section class="card px-4 md:px-5 pt-4 md:pt-6 pb-1 md:pb-2.5 flex flex-col md:flex-1" aria-label="Top categories">
        <div class="flex justify-between items-center mb-1">
            <h2 class="section-title md:text-[17px]">Where it went</h2>
            <a href="view-category.html" class="link text-body-s py-2.5">See all ${rows.length}</a>
        </div>
        ${rows.slice(0, 4).map((c, i) => {
            const v = categoryVisual(c.name);
            const barColor = v.none ? 'var(--faint)' : `var(--cat-${v.token})`;
            return `<div class="flex gap-3 items-center py-3 ${i ? 'border-t border-sunken' : ''}">
                ${tileHTML(c.name, 'md:tile--s')}
                <span class="flex-1 min-w-0 flex flex-col gap-1.5">
                    <span class="flex justify-between gap-2 items-baseline"><span class="text-[15px] md:text-body-s font-semibold truncate">${esc(c.name)}</span><span class="text-[15px] md:text-body-s font-semibold whitespace-nowrap tnum">${esc(TM.rp(c.amount))}</span></span>
                    <span class="bar bar--xs"><span class="bar-fill" style="width: ${Math.round(c.amount / max * 100)}%; background: ${barColor}"></span></span>
                    <span class="flex justify-between text-caption text-muted tnum"><span>${TM.plural(c.count, 'transaction')}</span><span>${total ? Math.round(c.amount / total * 100) : 0}%</span></span>
                </span>
            </div>`;
        }).join('')}
    </section>`;
}

function renderHome() {
    const ym = Month.get();
    const host = qs('#home-content');
    const spent = sumAmounts(expensesIn(ym));
    const hasData = store.txns.some(t => txMonth(t) === ym);

    const hero = `<section class="card p-4 md:p-7 flex flex-col gap-3 md:gap-[18px] min-w-0 basis-full md:flex-[2_1_480px]" aria-label="${esc(monthName(ym))} spending">
        ${heroHTML(ym, spent)}
        ${hasData ? `<div class="divider"></div>${budgetsBlockHTML(ym)}` : ''}
    </section>`;

    if (!hasData) {
        host.innerHTML = hero + `<div class="empty">
            ${icon('sentiment_calm')}
            <h2>Suspiciously quiet.</h2>
            <p>Nothing recorded for ${esc(monthName(ym))}. Import your BCA emails for this month, or add a transaction by hand.</p>
            <div class="empty-actions">
                <a href="import.html" class="btn btn-primary">${icon('move_to_inbox', 'text-[20px]')}Import ${esc(monthName(ym))} emails</a>
                <a href="add-transaction.html" class="btn btn-secondary">${icon('add', 'text-[20px]')}Add by hand</a>
            </div>
        </div>`;
        return;
    }

    host.innerHTML = `
        <div class="flex flex-wrap gap-4 md:gap-5">
            ${hero}
            <div class="flex-[1_1_280px] min-w-0 flex flex-col gap-4 md:gap-5">
                ${statsHTML(ym, spent)}
                ${nudgeHTML(ym)}
            </div>
        </div>
        <div class="flex flex-wrap gap-4 md:gap-5">
            <div class="flex-[2_1_480px] min-w-0">${dayChartHTML(ym)}</div>
            <div class="flex-[1_1_280px] min-w-0 flex flex-col">${whereItWentHTML(ym)}</div>
        </div>`;
    bindChartReadout(host);
}

App.start({
    tab: 'home',
    fab: true,
    async init() {
        mountMonth(() => renderHome());
        await Promise.all([loadCategories(), loadBudgets(), loadTransactions()]);
        qs('#greeting').textContent = `Hi ${displayName()}.`;
        qs('#greeting-sub').textContent = "Here's the damage so far.";
        qs('#main').removeAttribute('aria-busy');
        renderHome();
        updateRulesBadge();
        window.addEventListener('tm:data', renderHome);
    },
});
