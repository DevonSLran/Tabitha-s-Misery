/* Budget: monthly limits per budget group, and how this month is tracking. */
'use strict';

function tickHTML(ym) {
    const p = TM.monthProgress(ym);
    return p.day ? `<span class="bar-tick" style="left: ${p.pct}%" aria-hidden="true"></span>` : '';
}

function rangeLabel(b, ym) {
    if (b.end === NO_END) return 'every month';
    if (b.start === b.end && b.end === ym) return `${monthName(ym)} only`;
    return `until ${TM.monthShort(b.end)}`;
}

function feedsLabel(group) {
    const names = categoriesInGroup(group).map(c => c.name);
    return names.length ? names.join(', ') : 'No categories yet';
}

function summaryHTML(ym, sum) {
    const s = TM.budgetStatus(sum.spent, sum.limit);
    const p = TM.monthProgress(ym);
    const perDay = p.day ? Math.floor(s.left / p.daysLeft) : 0;
    return `<section class="card p-4 md:p-7 flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 md:gap-x-12 md:gap-y-6" aria-label="All budgets">
        <div class="flex flex-col gap-3 md:gap-3.5 md:flex-[2_1_420px] min-w-0">
            <div class="flex justify-between items-center gap-2">
                <span class="text-body-s text-muted">Spent against budgets${p.day ? `<span class="hidden md:inline"> · day ${p.day} of ${p.days}</span>` : ''}</span>
                <span class="pill pill--${s.key}">${icon(s.icon)}${esc(s.pctLabel)}</span>
            </div>
            <div class="flex flex-wrap items-baseline gap-2 md:gap-2.5 tnum">
                <span class="font-serif text-[36px] leading-[40px] md:text-[56px] md:leading-[58px]">${esc(TM.rp(sum.spent))}</span>
                <span class="text-[15px] md:text-body text-muted">of ${esc(TM.rp(sum.limit))}</span>
            </div>
            <span class="bar bar--l"><span class="bar-fill bar-fill--${s.key}" style="width: ${s.barWidth}"></span>${tickHTML(ym)}</span>
        </div>
        <div class="grid grid-cols-2 gap-3 md:gap-4 pt-1 md:pt-0 md:flex-[1_1_220px] tnum">
            <div class="flex flex-col gap-0.5 md:gap-1">
                <span class="text-caption md:text-label text-muted">${s.over ? 'Over by' : p.day ? 'Left this month' : 'Left over'}</span>
                <span class="text-body md:text-[20px] font-semibold ${s.over ? 'text-negative' : ''}">${esc(TM.rp(s.over ? s.overBy : s.left))}</span>
            </div>
            ${p.day && !s.over ? `<div class="flex flex-col gap-0.5 md:gap-1">
                <span class="text-caption md:text-label text-muted">Per day, ${TM.plural(p.daysLeft, 'day')} left</span>
                <span class="text-body md:text-[20px] font-semibold">${esc(TM.rp(perDay))}</span>
            </div>` : ''}
        </div>
    </section>`;
}

function groupCardHTML(g, ym) {
    const s = TM.budgetStatus(g.spent, g.limit);
    const b = store.budgets[g.key];
    return `<button type="button" class="card-m p-3.5 md:p-[18px] flex flex-col gap-2 md:gap-3 text-left w-full active:bg-sunken" data-edit="${g.key}" aria-label="${esc(g.label)} budget: ${esc(s.pctLabel)}. Edit">
        <span class="flex gap-3 items-center w-full">
            ${groupTileHTML(g.key)}
            <span class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="text-body font-semibold">${esc(g.label)}</span>
                <span class="text-caption text-muted">${esc(feedsLabel(g.key))} · ${esc(rangeLabel(b, ym))}</span>
            </span>
            <span class="pill pill--${s.key}">${icon(s.icon)}${s.pct}%</span>
        </span>
        <span class="bar bar--s w-full"><span class="bar-fill bar-fill--${s.key}" style="width: ${s.barWidth}"></span>${tickHTML(ym)}</span>
        <span class="flex flex-wrap justify-between gap-x-2 gap-y-0.5 w-full text-label text-muted tnum">
            <span class="whitespace-nowrap">${esc(TM.rp(g.spent))} of ${esc(TM.rp(g.limit))}</span>
            ${s.over ? `<span class="text-negative font-semibold whitespace-nowrap">${esc(TM.rp(s.overBy))} over</span>` : `<span class="text-text font-medium whitespace-nowrap">${esc(TM.rp(s.left))} left</span>`}
        </span>
    </button>`;
}

function unbudgetedHTML(g) {
    return `<div class="border border-dashed border-line-strong rounded-m p-3.5 md:p-[18px] flex md:flex-col md:items-start md:justify-between gap-3 items-center">
        <span class="flex gap-3 items-center flex-1 min-w-0">
            ${groupTileHTML(g.key).replace('cat-tile', 'tile--group-none')}
            <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-[15px] md:text-body font-semibold">${esc(g.label)}</span>
                <span class="text-label md:text-caption text-muted tnum">${esc(TM.rp(g.spent))} spent · no budget</span>
            </span>
        </span>
        <button type="button" class="btn-pill !px-3.5" data-new-budget="${g.key}"><span class="md:hidden">Set</span><span class="hidden md:inline">Set a budget</span></button>
    </div>`;
}

function renderBudget() {
    const ym = Month.get();
    const host = qs('#budget-content');
    const sum = budgetSummary(ym);
    const loose = unsortedIn(ym);

    if (!sum.budgeted.length) {
        const spent = sumAmounts(expensesIn(ym));
        host.innerHTML = `<div class="empty mt-2">
            ${icon('donut_large')}
            <h2>No limits yet.</h2>
            <p class="tnum">${spent ? `You've spent ${esc(TM.rp(spent))} ${ym === thisMonth() ? 'this month' : `in ${esc(monthName(ym))}`} with nothing to measure it against.` : 'Nothing to measure yet.'} Pick a group, set a monthly limit, and we'll keep score.</p>
            <div class="empty-actions !w-auto"><button type="button" class="btn btn-primary px-5" data-new-budget>${icon('add', 'text-[20px]')}Set your first budget</button></div>
        </div>`;
        return;
    }

    const groups = sum.budgeted.slice().sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit));
    host.innerHTML = `
        ${summaryHTML(ym, sum)}
        <h2 class="section-title mt-2 md:hidden">By group</h2>
        <div class="grid gap-4 md:gap-4" style="grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr))">
            ${groups.map(g => groupCardHTML(g, ym)).join('')}
            ${sum.unbudgeted.map(unbudgetedHTML).join('')}
        </div>
        ${loose.length ? `<a href="categories.html#sort" class="banner banner--info !p-3 md:!px-[18px] items-center">
            ${icon('info')}
            <span class="flex-1 tnum">${esc(TM.rp(sumAmounts(loose)))} is uncategorized, so it doesn't count toward any budget yet.</span>
            <span class="font-semibold text-accent-text whitespace-nowrap">Sort ${loose.length} →</span>
        </a>` : ''}`;
}

/** Set or edit one group's budget. */
function openBudgetSheet(editGroup, presetGroup) {
    const ym = Month.get();
    const existing = editGroup ? store.budgets[editGroup] : null;
    let group = editGroup || presetGroup || null;
    let period = !existing ? 'only' : existing.end === NO_END ? 'none' : (existing.start === existing.end && existing.end === ym) ? 'only' : 'until';
    let until = existing && period === 'until' ? existing.end : shiftMonth(ym, 2);
    const taken = (key) => !editGroup && activeLimit(key, ym) > 0;

    const chips = GROUP_KEYS.map(key => `<button type="button" class="chip" data-group="${key}" aria-pressed="${key === group}" ${taken(key) ? 'disabled' : ''}>${esc(BUDGET_GROUPS[key].label)}</button>`).join('');
    const html = `
        <h2 class="sheet-title" id="budget-sheet-title">${editGroup ? `${esc(BUDGET_GROUPS[editGroup].label)} budget` : 'New budget'}</h2>
        <fieldset class="border-0 p-0 m-0 flex flex-col gap-2">
            <legend class="field-label ${editGroup ? 'sr-only' : ''}">Group</legend>
            <div class="flex flex-wrap gap-2" data-groups ${editGroup ? 'hidden' : ''}>${chips}</div>
            <span class="text-caption text-muted" data-feeds></span>
        </fieldset>
        <div>
            <label for="budget-limit" class="field-label">Monthly limit</label>
            <div class="amount-line amount-line--s">
                <span class="rp" aria-hidden="true">Rp</span>
                <input id="budget-limit" inputmode="numeric" placeholder="0" autocomplete="off" value="${existing ? dots(existing.amount) : ''}" ${editGroup || presetGroup ? 'autofocus' : ''}>
            </div>
            <span class="field-error" data-limit-error hidden></span>
        </div>
        <fieldset class="border-0 p-0 m-0 flex flex-col gap-2">
            <legend class="field-label">Applies from ${esc(TM.monthLabel(existing && existing.start < ym && period !== 'only' ? existing.start : ym))}</legend>
            <div class="seg grid-cols-3" role="radiogroup" aria-label="How long" data-period>
                <button type="button" role="radio" data-p="only" aria-checked="${period === 'only'}">${esc(monthAbbr(ym))} only</button>
                <button type="button" role="radio" data-p="until" aria-checked="${period === 'until'}"><span data-until-label>Until…</span></button>
                <button type="button" role="radio" data-p="none" aria-checked="${period === 'none'}">No end</button>
            </div>
            <input type="month" class="picker-input" tabindex="-1" aria-hidden="true" data-until min="${ym}" value="${until}">
            <span class="text-caption text-muted" data-period-help></span>
        </fieldset>
        <button type="button" class="btn btn-primary btn-lg" data-save>Save budget</button>
        ${editGroup ? '<button type="button" class="btn-text-destructive -mt-2" data-remove>Remove budget</button>' : ''}`;

    ui.sheet.open({
        label: editGroup ? `${BUDGET_GROUPS[editGroup].label} budget` : 'New budget', html,
        onOpen(sheet) {
            const limit = qs('#budget-limit', sheet);
            const limitErr = qs('[data-limit-error]', sheet);
            const untilInput = qs('[data-until]', sheet);
            const render = () => {
                qsa('[data-group]', sheet).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.group === group)));
                qs('[data-feeds]', sheet).textContent = group ? `Counts spending in: ${feedsLabel(group)}` : 'Pick the group this limit is for.';
                qsa('[data-p]', sheet).forEach(b => b.setAttribute('aria-checked', String(b.dataset.p === period)));
                qs('[data-until-label]', sheet).textContent = period === 'until' ? `Until ${TM.monthShort(until)}` : 'Until…';
                qs('[data-period-help]', sheet).textContent = period === 'only' ? `Only counts in ${TM.monthLabel(ym)}.`
                    : period === 'until' ? `Every month up to and including ${TM.monthLabel(until)}.` : 'Every month from now on.';
            };
            render();
            bindAmountInput(limit, () => { limit.setAttribute('aria-invalid', 'false'); limitErr.hidden = true; });
            untilInput.addEventListener('change', () => {
                if (untilInput.value && untilInput.value >= ym) { until = untilInput.value; period = 'until'; }
                render();
            });

            sheet.addEventListener('click', async (e) => {
                const g = e.target.closest('[data-group]');
                if (g && !g.disabled) { group = g.dataset.group; render(); return; }
                const p = e.target.closest('[data-p]');
                if (p) {
                    period = p.dataset.p;
                    if (period === 'until') openPicker(untilInput);
                    render();
                    return;
                }
                if (e.target.closest('[data-save]')) {
                    const btn = e.target.closest('[data-save]');
                    const amount = parseAmount(limit.value);
                    if (!group) { ui.toast('Pick a group first'); return; }
                    if (!amount) {
                        limit.setAttribute('aria-invalid', 'true');
                        limitErr.hidden = false;
                        limitErr.innerHTML = `${icon('error', 'text-[18px]')}Enter a monthly limit`;
                        limit.focus();
                        return;
                    }
                    // Keep earlier months of an ongoing budget; "only" pins it to this month.
                    const start = period === 'only' ? ym : (existing && existing.start < ym ? existing.start : ym);
                    const end = period === 'only' ? ym : period === 'none' ? NO_END : until;
                    setBusy(btn, 'Saving…');
                    try {
                        const { error } = await dbClient.from('budgets').upsert(
                            { grp: group, amount, start_month: start, end_month: end },
                            { onConflict: 'user_id,grp' });
                        if (error) throw error;
                        store.budgets[group] = { amount, start, end };
                        ui.sheet.close();
                        ui.toast(`${BUDGET_GROUPS[group].label}: ${TM.rp(amount)} a month`, { icon: 'check_circle' });
                        renderBudget();
                    } catch (err) { clearBusy(btn); ui.error(errorMessage(err, 'save the budget')); }
                }
                if (e.target.closest('[data-remove]')) {
                    const label = BUDGET_GROUPS[editGroup].label;
                    const ok = await ui.confirm({ title: `Remove the ${label} budget?`, body: 'Spending stays; only the limit goes.', confirmLabel: 'Remove budget' });
                    if (!ok) return;
                    try {
                        const { error } = await dbClient.from('budgets').delete().eq('grp', editGroup);
                        if (error) throw error;
                        delete store.budgets[editGroup];
                        ui.sheet.close();
                        ui.toast(`Removed the ${label} budget`);
                        renderBudget();
                    } catch (err) { ui.error(errorMessage(err, 'remove the budget')); }
                }
            });
        },
    });
}

App.start({
    tab: 'budget',
    async init() {
        mountMonth(() => renderBudget());
        await Promise.all([loadCategories(), loadBudgets(), loadTransactions()]);
        qs('#main').removeAttribute('aria-busy');
        renderBudget();
        updateRulesBadge();
        document.addEventListener('click', (e) => {
            const edit = e.target.closest('[data-edit]');
            if (edit) return openBudgetSheet(edit.dataset.edit);
            const add = e.target.closest('[data-new-budget]');
            if (add) openBudgetSheet(null, add.dataset.newBudget || null);
        });
    },
});
