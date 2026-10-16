/* Activity: every transaction in the month, searchable and filterable. */
'use strict';

const params = new URLSearchParams(location.search);
const view = {
    filter: ['spent', 'income', 'unsorted'].includes(params.get('filter')) ? params.get('filter') : 'all',
    category: params.get('category') || null, // from Spending by Category
    query: '',
};
const desktop = window.matchMedia('(min-width: 768px)');

function matchesQuery(t, q) {
    if (!q) return true;
    if (String(t.description).toLowerCase().includes(q.toLowerCase())) return true;
    // Amounts typed with or without dots: "412.300", "412300", "412"
    const digits = q.replace(/[.\s,]|rp/gi, '');
    return /^\d+$/.test(digits) && String(t.amount).includes(digits);
}

function visibleTxns(ym) {
    return store.txns.filter(t => {
        if (txMonth(t) !== ym) return false;
        if (view.category && (isIncome(t) || (t.category || UNCATEGORIZED) !== view.category)) return false;
        if (view.filter === 'spent' && isIncome(t)) return false;
        if (view.filter === 'income' && !isIncome(t)) return false;
        if (view.filter === 'unsorted' && !isUnsorted(t)) return false;
        return matchesQuery(t, view.query);
    });
}

function renderFilters(ym) {
    const n = unsortedIn(ym).length;
    const chip = (key, label) => `<button type="button" class="chip px-3.5" data-filter="${key}" aria-pressed="${view.filter === key && !view.category}">${label}</button>`;
    let html = chip('all', 'All') + chip('spent', 'Spent') + chip('income', 'Income');
    html += `<button type="button" class="chip chip--accent" data-filter="unsorted" aria-pressed="${view.filter === 'unsorted' && !view.category}">Unsorted<span class="count-badge">${n}</span></button>`;
    if (view.category) {
        html += `<button type="button" class="chip chip--icon" aria-pressed="true" data-clear-category aria-label="Showing ${esc(view.category)} only. Show all">${esc(view.category)}<span class="ms text-[18px]" aria-hidden="true">close</span></button>`;
    }
    qs('#filters').innerHTML = html;
}

function rowHTML(t) {
    const { title, via } = TM.splitDescription(t.description);
    const income = isIncome(t);
    const unsorted = isUnsorted(t);
    const meta = income ? ['Income', via] : unsorted ? [via] : [t.category, via];
    return `<div class="tx-row">
        ${txTileHTML(t)}
        <span class="flex-1 min-w-0 flex flex-col gap-0.5 items-start">
            <button type="button" class="tx-open" data-open="${esc(t.id)}">${esc(title)}</button>
            ${meta.filter(Boolean).length ? `<span class="text-label text-muted truncate max-w-full">${esc(meta.filter(Boolean).join(' · '))}</span>` : ''}
            ${unsorted ? `<button type="button" class="pick-chip mt-1" data-pick="${esc(t.id)}">${icon('add', 'text-[16px]')}Pick a category</button>` : ''}
        </span>
        <span class="tx-amount ${income ? 'text-positive' : ''}">${esc(TM.rpSigned(t.amount, t.transaction_type))}</span>
    </div>`;
}

function tableRowHTML(t) {
    const { title, via } = TM.splitDescription(t.description);
    const income = isIncome(t);
    const unsorted = isUnsorted(t);
    const catCell = income
        ? '<span class="text-label text-muted">Income</span>'
        : unsorted
            ? `<button type="button" class="pick-chip" data-pick="${esc(t.id)}">${icon('add', 'text-[16px]')}Pick a category</button>`
            : `<button type="button" class="inline-flex items-center gap-1 h-8 max-w-full rounded-xs border border-line bg-surface px-2.5 text-label font-medium" data-pick="${esc(t.id)}" aria-label="Category: ${esc(t.category)}. Change"><span class="truncate">${esc(t.category)}</span>${icon('expand_more', 'text-[16px] text-muted')}</button>`;
    return `<div role="row" class="tx-table-row">
        <span role="cell" class="flex gap-3 items-center min-w-0">
            ${txTileHTML(t, 'tile--s')}
            <span class="min-w-0 flex flex-col items-start">
                <button type="button" class="text-[15px] font-semibold truncate max-w-full text-left hover:underline" data-open="${esc(t.id)}">${esc(title)}</button>
                ${via ? `<span class="text-caption text-muted truncate max-w-full">${esc(via)}</span>` : ''}
            </span>
        </span>
        <span role="cell" class="min-w-0">${catCell}</span>
        <span role="cell" class="tx-amount text-right text-[15px] ${income ? 'text-positive' : ''}">${esc(TM.rpSigned(t.amount, t.transaction_type))}</span>
        <span role="cell" class="tx-actions">
            <a href="add-transaction.html?id=${encodeURIComponent(t.id)}" class="icon-btn w-10 h-10" aria-label="Edit ${esc(title)}">${icon('edit', 'text-[20px]')}</a>
            <button type="button" class="icon-btn w-10 h-10 text-negative" data-delete="${esc(t.id)}" aria-label="Delete ${esc(title)}">${icon('delete', 'text-[20px]')}</button>
        </span>
    </div>`;
}

function dayTotals(list) {
    const spent = sumAmounts(list.filter(t => !isIncome(t)));
    const inc = sumAmounts(list.filter(isIncome));
    return [spent ? '−' + TM.rp(spent) : '', inc ? '+' + TM.rp(inc) : ''].filter(Boolean).join('  ');
}

function groupByDay(list) {
    const days = [];
    list.forEach(t => {
        let d = days[days.length - 1];
        if (!d || d.date !== t.transaction_date) { d = { date: t.transaction_date, rows: [] }; days.push(d); }
        d.rows.push(t);
    });
    return days;
}

function renderActivity() {
    const ym = Month.get();
    const monthTxns = store.txns.filter(t => txMonth(t) === ym);
    const list = visibleTxns(ym);
    const mon = monthName(ym);
    const current = ym === thisMonth();
    const spent = sumAmounts(monthTxns.filter(t => !isIncome(t)));
    const inc = sumAmounts(monthTxns.filter(isIncome));
    const listEl = qs('#list');

    qs('#tools').hidden = !monthTxns.length;
    qs('#summary').hidden = !monthTxns.length;
    renderFilters(ym);

    if (!monthTxns.length) {
        listEl.innerHTML = `<div class="empty mt-3">
            ${icon('sentiment_calm')}
            <h2>Suspiciously quiet.</h2>
            <p>Nothing recorded for ${esc(mon)}. Import your BCA emails for this month, or add a transaction by hand.</p>
            <div class="empty-actions">
                <a href="import.html" class="btn btn-primary">${icon('move_to_inbox', 'text-[20px]')}Import ${esc(mon)} emails</a>
                <a href="add-transaction.html" class="btn btn-secondary">${icon('add', 'text-[20px]')}Add by hand</a>
            </div>
        </div>`;
        return;
    }

    qs('#desk-summary').innerHTML = `−${esc(TM.rp(spent))} · <span class="text-positive">+${esc(TM.rp(inc))}</span>`;
    qs('#summary').innerHTML = view.query
        ? `<p class="text-body-s text-text-2">${TM.plural(list.length, 'result')} for “${esc(view.query)}” in ${esc(mon)}</p>`
        : `<div class="grid grid-cols-2 gap-px bg-line border border-line rounded-[14px] overflow-hidden tnum">
               <div class="bg-surface px-3.5 py-2.5 flex flex-col gap-0.5"><span class="text-caption text-muted">Spent</span><span class="text-[15px] font-semibold whitespace-nowrap">−${esc(TM.rp(spent))}</span></div>
               <div class="bg-surface px-3.5 py-2.5 flex flex-col gap-0.5"><span class="text-caption text-muted">Came in</span><span class="text-[15px] font-semibold text-positive whitespace-nowrap">+${esc(TM.rp(inc))}</span></div>
           </div>`;

    const days = groupByDay(list);
    const endLine = view.query
        ? `Searched descriptions in ${mon}. Try another month with the arrows.`
        : view.filter !== 'all' || view.category ? '' : current ? `That's all of ${mon} so far.` : `That's all of ${mon}.`;
    const nothing = !list.length
        ? `<p class="text-body-s text-muted py-6 text-center">${view.query ? `Nothing in ${esc(mon)} matches “${esc(view.query)}”.` : view.filter === 'unsorted' ? `Every ${esc(mon)} expense has a category.` : view.filter === 'income' ? `No income recorded in ${esc(mon)}.` : `Nothing to show for ${esc(mon)}.`}</p>`
        : '';

    if (desktop.matches) {
        listEl.innerHTML = list.length ? `<div class="list-card overflow-x-auto">
            <div role="table" aria-label="${esc(mon)} transactions" class="min-w-[760px]">
                <div role="row" class="tx-table-row !min-h-0 !py-3 !border-t-0 border-b border-line text-caption font-semibold text-muted hover:!bg-transparent">
                    <span role="columnheader">Transaction</span><span role="columnheader">Category</span><span role="columnheader" class="text-right">Amount</span><span role="columnheader"><span class="sr-only">Actions</span></span>
                </div>
                ${days.map(d => `<div role="rowgroup">
                    <div role="row" class="flex justify-between px-5 pt-3.5 pb-1.5 text-label font-semibold text-text-2 bg-bg tnum"><span role="cell">${esc(TM.dayGroupLabel(d.date))}</span><span role="cell" class="font-normal text-muted">${esc(dayTotals(d.rows))}</span></div>
                    ${d.rows.map(tableRowHTML).join('')}
                </div>`).join('')}
            </div>
        </div>` : nothing;
    } else {
        listEl.innerHTML = days.map(d => `<section aria-label="${esc(TM.dayGroupLabel(d.date))}" class="flex flex-col">
            <div class="flex justify-between items-baseline gap-3 pt-2 pb-1 border-b border-line tnum">
                <h2 class="text-label font-semibold text-text-2">${esc(TM.dayGroupLabel(d.date))}</h2>
                <span class="text-caption text-muted whitespace-pre">${esc(dayTotals(d.rows))}</span>
            </div>
            ${d.rows.map(rowHTML).join('')}
        </section>`).join('') + nothing;
    }
    if (endLine && list.length) listEl.insertAdjacentHTML('beforeend', `<p class="mt-4 text-center text-label text-muted">${esc(endLine)}</p>`);
}

function rerender() { renderActivity(); updateRulesBadge(); }
const findTxn = (id) => store.txns.find(t => String(t.id) === String(id));

App.start({
    tab: 'activity',
    fab: true,
    async init() {
        let loaded = false;
        const renderMonth = mountMonth(() => renderActivity(), (ym) => (loaded ? TM.plural(store.txns.filter(t => txMonth(t) === ym).length, 'transaction') : ''));
        await Promise.all([loadCategories(), loadRules(), loadTransactions()]);
        loaded = true;
        qs('#main').removeAttribute('aria-busy');
        renderMonth(); // the caption counts transactions, so redraw now they're here
        rerender();

        const search = qs('#search');
        const clear = qs('#search-clear');
        search.addEventListener('input', () => {
            view.query = search.value.trim();
            clear.hidden = !search.value;
            renderActivity();
        });
        clear.addEventListener('click', () => { search.value = ''; view.query = ''; clear.hidden = true; renderActivity(); search.focus(); });

        qs('#filters').addEventListener('click', (e) => {
            const f = e.target.closest('[data-filter]');
            if (f) { view.filter = f.dataset.filter; view.category = null; history.replaceState(null, '', 'activity.html'); renderActivity(); return; }
            if (e.target.closest('[data-clear-category]')) { view.category = null; history.replaceState(null, '', 'activity.html'); renderActivity(); }
        });

        qs('#list').addEventListener('click', async (e) => {
            const open = e.target.closest('[data-open]');
            const pick = e.target.closest('[data-pick]');
            const del = e.target.closest('[data-delete]');
            if (pick) { const t = findTxn(pick.dataset.pick); if (t) openCategoryPicker(t, { onSaved: rerender }); return; }
            if (open) { const t = findTxn(open.dataset.open); if (t) openTransactionSheet(t, { onChange: rerender }); return; }
            if (del) {
                const t = findTxn(del.dataset.delete);
                if (!t) return;
                del.disabled = true;
                try {
                    await softDeleteTransaction(t.id);
                    store.txns = store.txns.filter(x => x !== t);
                    rerender();
                    undoDeleteToast(t, rerender);
                } catch (err) { del.disabled = false; ui.error(errorMessage(err, 'delete it')); }
            }
        });

        desktop.addEventListener('change', renderActivity);
        window.addEventListener('tm:data', rerender);
    },
});
