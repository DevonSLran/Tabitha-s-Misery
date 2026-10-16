/* Rules tab (categories.html): sort uncategorized expenses, keyword rules, categories. */
'use strict';

const TAB_KEY = 'tm.rulesTab';
const TABS_ORDER = ['sort', 'rules', 'categories'];
let tab = (() => {
    const h = location.hash.slice(1);
    if (TABS_ORDER.includes(h)) return h;
    try { const s = localStorage.getItem(TAB_KEY); if (TABS_ORDER.includes(s)) return s; } catch (_) { /* ignore */ }
    return 'sort';
})();

const seenCount = (kw) => store.txns.filter(t => String(t.description).toUpperCase().includes(kw)).length;

function sortHint(t) {
    const kw = TM.suggestKeyword(t.description);
    if (!kw) return "Bank transfers don't name who you paid, so a rule won't help. Just pick a category.";
    const seen = seenCount(kw);
    return seen >= 2 ? `Seen ${seen} times. Picking a category will offer a ${kw} rule.` : `Picking a category will offer a ${kw} rule.`;
}

function sortPanelHTML() {
    const ym = thisMonth();
    const loose = unsortedIn(ym);
    const prev = shiftMonth(ym, -1);
    const prevLoose = unsortedIn(prev).length;
    const more = prevLoose ? `<a href="activity.html?filter=unsorted" class="link text-body-s py-2 self-center tnum" data-month-go="${prev}">${prevLoose} more in ${esc(monthName(prev))} →</a>` : '';
    if (!loose.length) {
        return `<div class="empty">
            ${icon('check_circle')}
            <h2>All sorted.</h2>
            <p>Nothing left wandering. Every ${esc(monthName(ym))} expense has a category.</p>
        </div>${more}`;
    }
    return `<p class="text-[15px] leading-[22px] text-text-2 tnum">${TM.plural(loose.length, `${monthName(ym)} expense`)} (${esc(TM.rp(sumAmounts(loose)))}) ${loose.length === 1 ? 'has' : 'have'} no category. Pick one, and if the merchant repeats, let a rule handle it next time.</p>
        ${loose.map(t => `<article class="card-m p-4 flex flex-col gap-3">
            <div class="flex gap-3 items-start">
                ${tileHTML(UNCATEGORIZED)}
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <h2 class="text-title font-semibold">${esc(titleOf(t))}</h2>
                    <span class="text-label text-muted">${esc(TM.dateShort(t.transaction_date))}</span>
                </div>
                <span class="tx-amount">${esc(TM.rpSigned(t.amount, t.transaction_type))}</span>
            </div>
            <div class="mono-box">${esc(t.description)}</div>
            <p class="text-label text-muted">${esc(sortHint(t))}</p>
            <button type="button" class="btn btn-primary h-11" data-pick="${esc(t.id)}">${icon('sell', 'text-[20px]')}Pick a category</button>
        </article>`).join('')}
        ${more}`;
}

function rulesPanelHTML() {
    const byCat = {};
    store.rules.forEach(r => { (byCat[r.category] = byCat[r.category] || []).push(r); });
    const names = store.categories.map(c => c.name);
    Object.keys(byCat).forEach(n => { if (!names.includes(n)) names.push(n); }); // e.g. rules left on Uncategorized
    const groups = names.map(name => {
        const rules = (byCat[name] || []).slice().sort((a, b) => a.keyword.localeCompare(b.keyword));
        return `<section aria-label="${esc(name)} rules" class="card-m px-4 py-3.5 flex flex-col gap-2.5">
            <div class="flex items-center gap-2.5">
                ${tileHTML(name, 'tile--xs')}
                <h2 class="flex-1 text-[15px] font-semibold">${esc(name)}</h2>
                <span class="text-caption text-muted">${rules.length ? TM.plural(rules.length, 'rule') : 'No rules yet'}</span>
            </div>
            <div class="flex flex-wrap gap-2">
                ${rules.map(r => `<button type="button" class="inline-flex items-center h-9 rounded-xs border border-line bg-bg px-3 font-mono text-label font-medium" data-rule="${esc(r.id)}" aria-label="Rule ${esc(r.keyword)}. Edit">${esc(r.keyword)}</button>`).join('')}
                ${name === UNCATEGORIZED ? '' : `<button type="button" class="inline-flex items-center justify-center w-9 h-9 rounded-xs border border-dashed border-line-strong text-muted" data-add-rule="${esc(name)}" aria-label="Add a keyword for ${esc(name)}">${icon('add', 'text-[18px]')}</button>`}
            </div>
        </section>`;
    }).join('');
    return `<div class="card-m p-4 flex flex-col gap-2.5">
            <p class="text-[15px] leading-[22px]">If a transaction's description <strong>contains</strong> a keyword, it gets that keyword's category. When two keywords match, <strong>the longest one wins.</strong></p>
            <div class="flex flex-col gap-1.5 bg-bg rounded-[10px] px-3 py-2.5">
                <span class="font-mono text-[12px] leading-[17px] text-text-2">…GRAB / <span class="bg-accent-soft text-accent-text font-medium">GRABFOOD</span></span>
                <span class="text-label text-text-2">GRAB (4) and GRABFOOD (8) both match → <strong class="text-text">Food &amp; Dining</strong></span>
            </div>
            <span class="text-caption text-muted">A category you pick by hand always beats a rule.</span>
        </div>
        <button type="button" class="btn btn-primary" data-add-rule="">${icon('add', 'text-[20px]')}Add a rule</button>
        ${groups}`;
}

function categoriesPanelHTML() {
    return `<p class="text-[15px] leading-[22px] text-text-2">Categories are what you see on transactions. Each one counts toward one budget group.</p>
        <button type="button" class="btn btn-primary" data-add-category>${icon('add', 'text-[20px]')}Add a category</button>
        <div class="card-m px-4">
            ${store.categories.map((c, i) => {
                const n = store.rules.filter(r => r.category === c.name).length;
                const group = BUDGET_GROUPS[c.budget_group] ? BUDGET_GROUPS[c.budget_group].label : 'Other';
                return `<button type="button" class="flex gap-3 items-center w-full py-3.5 text-left ${i ? 'border-t border-sunken' : ''}" data-category="${esc(c.id)}">
                    ${tileHTML(c.name)}
                    <span class="flex-1 min-w-0 flex flex-col gap-0.5"><span class="text-[15px] font-semibold">${esc(c.name)}</span><span class="text-label text-muted">Budget: ${esc(group)} · ${TM.plural(n, 'rule')}</span></span>
                    ${icon('chevron_right', 'text-[20px] text-faint')}
                </button>`;
            }).join('')}
        </div>`;
}

function renderRules() {
    qsa('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    qs('#panel').setAttribute('aria-labelledby', `tab-${tab}`);
    qs('[data-count="sort"]').textContent = String(unsortedIn(thisMonth()).length);
    qs('[data-count="rules"]').textContent = String(store.rules.length);
    qs('[data-count="categories"]').textContent = String(store.categories.length);
    qs('#panel').innerHTML = tab === 'sort' ? sortPanelHTML() : tab === 'rules' ? rulesPanelHTML() : categoriesPanelHTML();
    updateRulesBadge();
}

/** Add or edit a category: name, icon, budget group. Delete asks first. */
function openCategoryEditor(cat = null) {
    let iconName = cat ? safeIcon(cat.icon) : CATEGORY_ICONS[0];
    let group = cat ? (BUDGET_GROUPS[cat.budget_group] ? cat.budget_group : 'OTHER') : 'OTHER';
    const icons = CATEGORY_ICONS.includes(iconName) ? CATEGORY_ICONS : CATEGORY_ICONS.concat(iconName);
    const html = `
        <h2 class="sheet-title">${cat ? 'Edit category' : 'New category'}</h2>
        <div>
            <label for="cat-name" class="field-label">Name</label>
            <input id="cat-name" class="field" value="${esc(cat ? cat.name : '')}" placeholder="e.g. Groceries" autocomplete="off" aria-describedby="cat-name-error" ${cat ? '' : 'autofocus'}>
            <span id="cat-name-error" class="field-error" hidden></span>
        </div>
        <fieldset class="border-0 p-0 m-0">
            <legend class="field-label">Icon</legend>
            <div class="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Icon" data-icons>
                ${icons.map(n => `<button type="button" role="radio" class="h-12 rounded-tile border border-sunken bg-bg grid place-items-center aria-checked:bg-ink aria-checked:text-on-ink aria-checked:border-ink" data-icon="${esc(n)}" aria-checked="${n === iconName}" aria-label="${esc(n.replace(/_/g, ' '))}">${icon(n, 'text-[22px]')}</button>`).join('')}
            </div>
        </fieldset>
        <fieldset class="border-0 p-0 m-0">
            <legend class="field-label">Counts toward budget</legend>
            <div class="flex flex-wrap gap-2" data-groups>
                ${GROUP_KEYS.map(k => `<button type="button" class="chip" data-group="${k}" aria-pressed="${k === group}">${esc(BUDGET_GROUPS[k].label)}</button>`).join('')}
            </div>
        </fieldset>
        <button type="button" class="btn btn-primary btn-lg" data-save>${cat ? 'Save' : 'Add category'}</button>
        ${cat ? '<button type="button" class="btn-text-destructive -mt-2" data-delete>Delete category</button>' : ''}`;

    ui.sheet.open({
        label: cat ? `Edit ${cat.name}` : 'New category', html,
        onOpen(sheet) {
            const nameInput = qs('#cat-name', sheet);
            const nameErr = qs('#cat-name-error', sheet);
            const setErr = (msg) => {
                nameInput.setAttribute('aria-invalid', msg ? 'true' : 'false');
                nameErr.hidden = !msg;
                nameErr.innerHTML = msg ? `${icon('error', 'text-[18px]')}${esc(msg)}` : '';
            };
            nameInput.addEventListener('input', () => setErr(''));
            sheet.addEventListener('click', async (e) => {
                const ic = e.target.closest('[data-icon]');
                if (ic) { iconName = ic.dataset.icon; qsa('[data-icon]', sheet).forEach(b => b.setAttribute('aria-checked', String(b === ic))); return; }
                const g = e.target.closest('[data-group]');
                if (g) { group = g.dataset.group; qsa('[data-group]', sheet).forEach(b => b.setAttribute('aria-pressed', String(b === g))); return; }

                if (e.target.closest('[data-save]')) {
                    const btn = e.target.closest('[data-save]');
                    const name = nameInput.value.trim();
                    if (!name) { setErr('Give it a name'); nameInput.focus(); return; }
                    if (name.toLowerCase() === UNCATEGORIZED.toLowerCase()) { setErr('That name is reserved for transactions without a category'); return; }
                    const clash = store.categories.find(c => c.name.toLowerCase() === name.toLowerCase() && (!cat || c.id !== cat.id));
                    if (clash) { setErr(`${clash.name} already exists`); nameInput.focus(); return; }
                    setBusy(btn, 'Saving…');
                    try {
                        if (cat) {
                            const { error } = await dbClient.from('categories').update({ name, icon: iconName, budget_group: group }).eq('id', cat.id);
                            if (error) throw error;
                            if (name !== cat.name) {
                                // Rules and overrides store the category as free text, so they follow a rename.
                                await dbClient.from('merchant_mapping').update({ category: name }).eq('category', cat.name);
                                await dbClient.from('bca_transactions').update({ category_override: name }).eq('category_override', cat.name);
                            }
                        } else {
                            const sort = store.categories.reduce((m, c) => Math.max(m, Number(c.sort_order) || 0), 0) + 1;
                            const { error } = await dbClient.from('categories').insert([{ name, icon: iconName, budget_group: group, sort_order: sort }]);
                            if (error) throw error;
                        }
                        await Promise.all([loadCategories(), loadRules(), loadTransactions()]);
                        ui.sheet.close();
                        ui.toast(cat ? `Saved ${name}` : `Added ${name}`, { icon: 'check_circle' });
                        renderRules();
                    } catch (err) { clearBusy(btn); ui.error(errorMessage(err, 'save the category')); }
                }

                if (e.target.closest('[data-delete]') && cat) {
                    const n = store.txns.filter(t => t.category === cat.name).length;
                    const rules = store.rules.filter(r => r.category === cat.name).map(r => r.keyword);
                    const rulesLine = !rules.length ? ''
                        : rules.length === 1 ? ` The rule ${rules[0]} stays, pointed at Uncategorized.`
                        : ` The rules ${rules.slice(0, -1).join(', ')} and ${rules[rules.length - 1]} stay, pointed at Uncategorized.`;
                    const ok = await ui.confirm({
                        title: `Delete the ${cat.name} category?`,
                        body: `Its ${TM.plural(n, 'transaction')} become${n === 1 ? 's' : ''} Uncategorized.${rulesLine}`,
                        confirmLabel: 'Delete category',
                    });
                    if (!ok) return;
                    try {
                        const { error } = await dbClient.from('categories').delete().eq('id', cat.id);
                        if (error) throw error;
                        // Keep the rules — the keyword is the hard-won part — and clear
                        // overrides so those rows fall back to the rules.
                        await dbClient.from('merchant_mapping').update({ category: UNCATEGORIZED }).eq('category', cat.name);
                        await dbClient.from('bca_transactions').update({ category_override: null }).eq('category_override', cat.name);
                        await Promise.all([loadCategories(), loadRules(), loadTransactions()]);
                        ui.sheet.close();
                        ui.toast(`Deleted ${cat.name}`);
                        renderRules();
                    } catch (err) { ui.error(errorMessage(err, 'delete the category')); }
                }
            });
        },
    });
}

App.start({
    tab: 'rules',
    async init() {
        await Promise.all([loadCategories(), loadRules(), loadTransactions()]);
        qs('#main').removeAttribute('aria-busy');
        renderRules();

        qs('#tabs').addEventListener('click', (e) => {
            const b = e.target.closest('[data-tab]');
            if (!b) return;
            tab = b.dataset.tab;
            try { localStorage.setItem(TAB_KEY, tab); } catch (_) { /* ignore */ }
            history.replaceState(null, '', `#${tab}`);
            renderRules();
        });
        // Arrow keys move between tabs.
        qs('#tabs').addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const i = TABS_ORDER.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
            const next = qs(`#tabs [data-tab="${TABS_ORDER[(i + 3) % 3]}"]`);
            next.focus();
            next.click();
        });
        window.addEventListener('hashchange', () => {
            const h = location.hash.slice(1);
            if (TABS_ORDER.includes(h) && h !== tab) { tab = h; renderRules(); }
        });

        qs('#panel').addEventListener('click', (e) => {
            const pick = e.target.closest('[data-pick]');
            if (pick) { const t = store.txns.find(x => String(x.id) === pick.dataset.pick); if (t) openCategoryPicker(t, { onSaved: renderRules }); return; }
            const rule = e.target.closest('[data-rule]');
            if (rule) { const r = store.rules.find(x => String(x.id) === rule.dataset.rule); if (r) openRuleSheet({ rule: r, onSaved: renderRules }); return; }
            const add = e.target.closest('[data-add-rule]');
            if (add) { openRuleSheet({ category: add.dataset.addRule || null, onSaved: renderRules }); return; }
            if (e.target.closest('[data-add-category]')) { openCategoryEditor(); return; }
            const c = e.target.closest('[data-category]');
            if (c) { const cat = store.categories.find(x => String(x.id) === c.dataset.category); if (cat) openCategoryEditor(cat); return; }
            const go = e.target.closest('[data-month-go]');
            if (go) Month.set(go.dataset.monthGo);
        });
        window.addEventListener('tm:data', renderRules);
    },
});
