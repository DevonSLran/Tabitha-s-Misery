/* Add / edit a transaction (add-transaction.html, ?id=… for edit). */
'use strict';

const editId = new URLSearchParams(location.search).get('id');
const form = {
    type: 'DB',
    date: todayISO(),
    category: null,
    original: null, // the row being edited, with its stored category_override
};

function dateLabel(iso) {
    if (iso === todayISO()) return `Today · ${TM.dateShort(iso)}`;
    return `${TM.dateShort(iso)} ${iso.slice(0, 4)}`;
}

function renderType() {
    qsa('#type-seg [data-type]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.type === form.type)));
    qs('#cat-field').hidden = form.type === 'CR';
    qs('#submit').textContent = editId ? 'Save changes' : form.type === 'CR' ? 'Add income' : 'Add expense';
}

function renderCategoryChips() {
    qs('#cat-chips').innerHTML = store.categories.map(c => {
        const v = categoryVisual(c.name);
        return `<button type="button" class="chip chip--icon chip--lg" data-cat="${esc(c.name)}" aria-pressed="${c.name === form.category}"><span class="ms text-[18px]" aria-hidden="true" style="color: var(--cat-${v.token})">${esc(v.icon)}</span>${esc(c.name)}</button>`;
    }).join('');
}

function setFieldError(input, errEl, msg) {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    errEl.hidden = !msg;
    errEl.innerHTML = msg ? `${icon('error', 'text-[18px]')}${esc(msg)}` : '';
}

// --- Calculator ---
// Builds an expression, evaluates it with × ÷ before + −, integer result
// rounded half up, and writes it into the amount field.
const OPS = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
function evaluate(tokens) {
    const t = tokens.slice();
    if (!t.length) return { value: 0 };
    if (OPS[t[t.length - 1]]) t.pop(); // ignore a trailing operator
    const nums = [], ops = [];
    for (let i = 0; i < t.length; i++) {
        if (i % 2 === 0) nums.push(Number(t[i]));
        else ops.push(t[i]);
    }
    // First pass: × and ÷.
    const n2 = [nums[0]], o2 = [];
    for (let i = 0; i < ops.length; i++) {
        if (ops[i] === '×' || ops[i] === '÷') {
            if (ops[i] === '÷' && nums[i + 1] === 0) return { error: "Can't divide by 0" };
            n2[n2.length - 1] = OPS[ops[i]](n2[n2.length - 1], nums[i + 1]);
        } else { o2.push(ops[i]); n2.push(nums[i + 1]); }
    }
    let v = n2[0];
    o2.forEach((op, i) => { v = OPS[op](v, n2[i + 1]); });
    return { value: Math.round(v) };
}

function openCalculator() {
    const start = parseAmount(qs('#amount').value);
    let tokens = start ? [String(start)] : [];
    const keys = [
        ['C', 'Clear', 'clear'], ['backspace', 'Backspace', 'back'], ['÷', 'Divide', 'op'], ['×', 'Multiply', 'op'],
        ['7'], ['8'], ['9'], ['−', 'Minus', 'op'],
        ['4'], ['5'], ['6'], ['+', 'Plus', 'op'],
        ['1'], ['2'], ['3'], ['000', 'Three zeros'],
        ['0', '0', 'zero'], ['use', 'Use result', 'use'],
    ];
    const keyHTML = ([label, aria = label, kind = 'num']) => {
        if (kind === 'use') return `<button type="button" class="btn btn-primary h-14 rounded-[12px] col-span-2 tnum" data-key="use">Use</button>`;
        const base = 'h-14 rounded-[12px] inline-flex items-center justify-center active:scale-[.97] transition-transform';
        if (kind === 'clear') return `<button type="button" class="${base} bg-sunken text-negative text-[18px] font-semibold" data-key="clear" aria-label="${aria}">C</button>`;
        if (kind === 'back') return `<button type="button" class="${base} bg-sunken" data-key="back" aria-label="${aria}">${icon('backspace', 'text-[24px]')}</button>`;
        if (kind === 'op') return `<button type="button" class="${base} bg-sunken text-[22px] font-medium" data-key="${label}" aria-label="${aria}">${label}</button>`;
        return `<button type="button" class="${base} bg-bg text-[${label === '000' ? '18' : '22'}px] font-medium tnum ${kind === 'zero' ? 'col-span-2' : ''}" data-key="${label}" aria-label="${aria}">${label}</button>`;
    };
    ui.sheet.open({
        label: 'Calculator',
        html: `
            <div class="flex justify-between items-center px-1 -mb-2">
                <h2 class="text-[18px] font-semibold">Calculator</h2>
                <button type="button" class="icon-btn" data-key="close" aria-label="Close calculator">${icon('close', 'text-[24px]')}</button>
            </div>
            <div class="bg-bg rounded-[14px] px-4 py-3.5 flex flex-col items-end gap-0.5 min-h-[92px]" aria-live="polite">
                <span class="text-[18px] text-muted tnum text-right break-all" data-expr></span>
                <span class="font-serif text-[38px] leading-[42px] tnum text-right break-all" data-result></span>
            </div>
            <div class="grid grid-cols-4 gap-2">${keys.map(keyHTML).join('')}</div>`,
        onOpen(sheet) {
            const exprEl = qs('[data-expr]', sheet);
            const resEl = qs('[data-result]', sheet);
            const useBtn = qs('[data-key="use"]', sheet);
            let result = { value: 0 };
            const render = () => {
                exprEl.textContent = tokens.length ? tokens.map(t => (OPS[t] ? ` ${t} ` : dots(t))).join('') : '0';
                result = evaluate(tokens);
                if (result.error) { resEl.textContent = result.error; resEl.classList.add('text-negative', '!text-[22px]'); }
                else { resEl.textContent = `= ${dots(Math.max(result.value, 0))}`; resEl.classList.remove('text-negative', '!text-[22px]'); }
                const ok = !result.error && result.value > 0;
                useBtn.disabled = !ok;
                useBtn.textContent = ok ? `Use ${TM.rp(result.value)}` : 'Use';
            };
            render();
            sheet.addEventListener('click', (e) => {
                const b = e.target.closest('[data-key]');
                if (!b) return;
                const k = b.dataset.key;
                const last = tokens[tokens.length - 1];
                if (k === 'close') return ui.sheet.close();
                if (k === 'use') {
                    if (result.error || result.value <= 0) return;
                    const input = qs('#amount');
                    input.value = dots(result.value);
                    setFieldError(input, qs('#amount-error') || document.createElement('span'), '');
                    ui.sheet.close();
                    return;
                }
                if (k === 'clear') tokens = [];
                else if (k === 'back') {
                    if (!last) return;
                    if (OPS[last] || last.length === 1) tokens.pop();
                    else tokens[tokens.length - 1] = last.slice(0, -1);
                } else if (OPS[k]) {
                    if (!tokens.length) return;
                    if (OPS[last]) tokens[tokens.length - 1] = k; else tokens.push(k);
                } else { // digits, 000
                    if (!last || OPS[last]) { if (k === '000') return; tokens.push(k); }
                    else if (last.length < 15) tokens[tokens.length - 1] = (last === '0' ? '' : last) + k;
                }
                render();
            });
        },
    });
}

async function loadForEdit() {
    const [{ data: row, error }, { data: raw }] = await Promise.all([
        dbClient.from('int_bca_categorized').select('id, transaction_date, description, amount, transaction_type, category').eq('id', editId).maybeSingle(),
        dbClient.from('bca_transactions').select('category_override').eq('id', editId).maybeSingle(),
    ]);
    if (error || !row) {
        Flash.set({ message: "That transaction doesn't exist any more." });
        location.replace('activity.html');
        return false;
    }
    form.original = { ...row, amount: Number(row.amount), override: raw ? raw.category_override : null };
    form.type = row.transaction_type === 'CR' ? 'CR' : 'DB';
    form.date = row.transaction_date || todayISO();
    form.category = row.category && row.category !== UNCATEGORIZED ? row.category : null;
    qs('#amount').value = dots(row.amount);
    qs('#desc').value = row.description || '';
    return true;
}

App.start({
    pushed: { title: editId ? 'Edit transaction' : 'Add transaction', back: 'activity.html', narrow: true },
    async init() {
        if (editId) document.title = "Edit transaction · Tabitha's Misery";
        await loadCategories();
        if (editId && !(await loadForEdit())) return;

        const amount = qs('#amount');
        const desc = qs('#desc');
        const dateInput = qs('#date');
        const amountCard = amount.closest('.card-m');
        amountCard.insertAdjacentHTML('beforeend', '<span id="amount-error" class="field-error !mt-0" hidden></span>');
        const amountErr = qs('#amount-error');
        const descErr = qs('#desc-error');

        bindAmountInput(amount, () => setFieldError(amount, amountErr, ''));
        desc.addEventListener('input', () => setFieldError(desc, descErr, ''));
        dateInput.value = form.date;
        qs('#date-label').textContent = dateLabel(form.date);
        qs('#date-btn').addEventListener('click', () => openPicker(dateInput));
        dateInput.addEventListener('change', () => {
            if (!dateInput.value) { dateInput.value = form.date; return; }
            form.date = dateInput.value;
            qs('#date-label').textContent = dateLabel(form.date);
        });

        renderType();
        renderCategoryChips();
        qs('#type-seg').addEventListener('click', (e) => {
            const b = e.target.closest('[data-type]');
            if (!b) return;
            form.type = b.dataset.type;
            renderType();
        });
        qs('#cat-chips').addEventListener('click', (e) => {
            const b = e.target.closest('[data-cat]');
            if (!b) return;
            form.category = form.category === b.dataset.cat ? null : b.dataset.cat; // tap again to clear
            renderCategoryChips();
        });
        qs('#calc-open').addEventListener('click', openCalculator);

        const submit = qs('#submit');
        qs('#txn-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const value = parseAmount(amount.value);
            const description = desc.value.trim();
            let bad = false;
            if (!value) { setFieldError(amount, amountErr, 'Enter an amount'); bad = true; }
            if (!description) { setFieldError(desc, descErr, 'Add a description so you can find it later'); bad = true; }
            if (bad) { (value ? desc : amount).focus(); return; }

            // Keep a rule-given category rule-driven: only write an override
            // when the user actually picked something different.
            let override = form.type === 'CR' ? null : form.category;
            const o = form.original;
            if (o && o.override == null && override === (o.category === UNCATEGORIZED ? null : o.category)) override = null;

            const row = { date: form.date, description, amount: value, type: form.type, category_override: override };
            setBusy(submit, 'Saving…');
            try {
                const { error } = editId
                    ? await dbClient.from('bca_transactions').update(row).eq('id', editId)
                    : await dbClient.from('bca_transactions').insert([row]);
                if (error) throw error;
                Month.set(txMonth({ transaction_date: form.date })); // land on the month it was filed under
                Flash.set({ message: editId ? 'Saved changes' : `Added ${TM.splitDescription(description).title}`, icon: 'check_circle' });
                location.replace('activity.html');
            } catch (err) {
                clearBusy(submit);
                ui.error(errorMessage(err, 'save it'), { action: 'Retry', onAction: () => submit.click() });
            }
        });

        if (editId) {
            const del = qs('#delete');
            del.hidden = false;
            del.addEventListener('click', async () => {
                setBusy(del, 'Deleting…');
                try {
                    await softDeleteTransaction(editId);
                    Flash.set({ undoTxn: { ...form.original } });
                    location.replace('activity.html');
                } catch (err) { clearBusy(del); ui.error(errorMessage(err, 'delete it')); }
            });
        }
    },
});
