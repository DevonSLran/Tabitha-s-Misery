// 1. Initialize Supabase (Get these from your Supabase Dashboard -> Settings -> API)
const SUPABASE_URL = 'https://oyexlcmrrhdvsqfbjoif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95ZXhsY21ycmhkdnNxZmJqb2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzODg1NDEsImV4cCI6MjA5MTk2NDU0MX0.25ET5EiQGGyF5WpoM2nv0zYLdrg7x9WimMP9PU77r0Y';

// We must use a different name here, like dbClient
const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SIDEBAR_TEMPLATE = `
<nav class="hidden md:flex flex-col fixed left-0 top-0 h-full w-60 z-40 border-r" style="background:#0d0d0f;border-color:rgba(255,255,255,0.06);padding:28px 12px;">
    <div style="padding:0 10px;margin-bottom:36px;margin-top:8px;">
        <span style="color:#32d74b;font-weight:900;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;font-family:'Inter',sans-serif;">PRECISION</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px;flex:1;">
        <a href="index.html" class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200" style="color:#8a8a8e;font-size:13px;font-weight:500;">
            <span class="material-symbols-outlined" style="font-size:18px;">account_balance_wallet</span>
            Wealth
        </a>
        <a href="activity.html" class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200" style="color:#8a8a8e;font-size:13px;font-weight:500;">
            <span class="material-symbols-outlined" style="font-size:18px;">analytics</span>
            Activity
        </a>
        <a href="budget.html" class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200" style="color:#8a8a8e;font-size:13px;font-weight:500;">
            <span class="material-symbols-outlined" style="font-size:18px;">pie_chart</span>
            Budget
        </a>
        <a href="account.html" class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200" style="color:#8a8a8e;font-size:13px;font-weight:500;">
            <span class="material-symbols-outlined" style="font-size:18px;">person_2</span>
            Account
        </a>
    </div>
    <div style="padding:12px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px;">
        <img alt="User Avatar" style="width:34px;height:34px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px rgba(50,215,75,0.25);" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWlmdEo4ZY-aHf5OzdU6LBoBZ4Pc3lLh9MXeXY0dJLe-USS5ZZnpBUzvMnu1ai-uqXd4Ob1kIrDUca6Klr0gmMTGh_u29hz62qniXAWDyRzzcYrioi0FgiOn1ZYHyJ94PEk7dWERbAHbHXfEuVGxl_ahH3UWpJxcYOGqKhAqSv6Hv9AXlgLnjjkXqXnzBYz7EdH1Nys3Ba5dAfmNB_iZS5b7xYkntfG2ZsZj2sTD2bcAXwRPhKpEy14G4hlt0fwNxUttCY-lhrVnY"/>
        <div>
            <p style="font-size:12px;font-weight:600;color:#f0f0f2;line-height:1.3;">Alex Morgan</p>
            <p style="font-size:11px;color:#8a8a8e;line-height:1.3;margin-top:1px;">Pro Member</p>
        </div>
    </div>
</nav>`;

const BOTTOMBAR_TEMPLATE = `
<div class="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-5 md:hidden" style="padding-bottom:max(env(safe-area-inset-bottom),12px)">
    <nav class="flex items-center w-full max-w-xs px-2 py-1.5 mb-2" style="background:rgba(22,22,25,0.94);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:28px;border:1px solid rgba(255,255,255,0.07);box-shadow:0 4px 40px rgba(0,0,0,0.55),0 1px 0 rgba(255,255,255,0.04) inset;">
        <a href="index.html" class="flex-1 flex flex-col items-center transition-all duration-200 active:scale-95" style="gap:3px;padding:8px 10px;border-radius:18px;color:#8a8a8e;">
            <span class="material-symbols-outlined" style="font-size:20px;line-height:1;">account_balance_wallet</span>
            <span style="font-size:9px;font-weight:600;letter-spacing:0.05em;line-height:1;">Wealth</span>
        </a>
        <a href="activity.html" class="flex-1 flex flex-col items-center transition-all duration-200 active:scale-95" style="gap:3px;padding:8px 10px;border-radius:18px;color:#8a8a8e;">
            <span class="material-symbols-outlined" style="font-size:20px;line-height:1;">analytics</span>
            <span style="font-size:9px;font-weight:600;letter-spacing:0.05em;line-height:1;">Activity</span>
        </a>
        <a href="budget.html" class="flex-1 flex flex-col items-center transition-all duration-200 active:scale-95" style="gap:3px;padding:8px 10px;border-radius:18px;color:#8a8a8e;">
            <span class="material-symbols-outlined" style="font-size:20px;line-height:1;">pie_chart</span>
            <span style="font-size:9px;font-weight:600;letter-spacing:0.05em;line-height:1;">Budget</span>
        </a>
        <a href="account.html" class="flex-1 flex flex-col items-center transition-all duration-200 active:scale-95" style="gap:3px;padding:8px 10px;border-radius:18px;color:#8a8a8e;">
            <span class="material-symbols-outlined" style="font-size:20px;line-height:1;">person_2</span>
            <span style="font-size:9px;font-weight:600;letter-spacing:0.05em;line-height:1;">Account</span>
        </a>
    </nav>
</div>`;

// --- ROUTER ---
document.addEventListener("DOMContentLoaded", async () => {
    // Auth gate: every page requires a session except login.html.
    const onLoginPage = location.pathname.endsWith('login.html');
    const { data: { session } } = await dbClient.auth.getSession();
    if (!session && !onLoginPage) { location.replace('login.html'); return; }
    if (session && onLoginPage) { location.replace('index.html'); return; }
    if (onLoginPage) { setupLoginPage(); return; }

    loadNavigation();
    setupDesktopSidebarToggle();

    document.documentElement.style.setProperty('-webkit-font-smoothing', 'antialiased');
    document.documentElement.style.setProperty('-moz-osx-font-smoothing', 'grayscale');
    document.documentElement.style.setProperty('text-rendering', 'optimizeLegibility');

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        document.addEventListener('backbutton', (e) => {
            e.preventDefault();
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                window.Capacitor.Plugins.App.exitApp();
            } else {
                window.history.back();
            }
        }, false);
    }

    if (document.getElementById('spendingChart')) loadDashboard(); 
    if (document.getElementById('transaction-list')) loadTransactions(); 
    if (document.getElementById('all-categories-list')) loadCategoriesPage(); 
    if (document.getElementById('keyword') && document.querySelector('button[type="submit"]')) setupAddRule(); 
    if (document.getElementById('submit-transaction')) setupAddTransaction(); 
    if (document.getElementById('export-csv-btn')) setupAccountPage();
    if (document.getElementById('scan-emails-btn')) setupImportPage();
    if (document.getElementById('budget-categories-list')) setupBudgetPage();

    checkSpendingAlerts().catch(() => {}); // surface budget-exceeded alerts on app open
});

// --- AUTH ---
async function signOutAndRedirect() {
    try { await dbClient.auth.signOut(); } catch (_) { /* ignore */ }
    location.replace('login.html');
}

function setupLoginPage() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const submitBtn = document.getElementById('auth-submit');
    const toggleBtn = document.getElementById('auth-toggle');
    const toggleText = document.getElementById('auth-toggle-text');
    const titleEl = document.getElementById('auth-title');
    const subtitleEl = document.getElementById('auth-subtitle');
    const errorEl = document.getElementById('auth-error');
    if (!submitBtn) return;

    let mode = 'signin';
    const showError = (msg) => { errorEl.style.display = msg ? 'block' : 'none'; errorEl.textContent = msg || ''; };

    function applyMode() {
        const signin = mode === 'signin';
        titleEl.textContent = signin ? 'Welcome back' : 'Create account';
        subtitleEl.textContent = signin ? 'Sign in to your account' : 'Start tracking your finances';
        submitBtn.textContent = signin ? 'Sign In' : 'Sign Up';
        toggleText.textContent = signin ? "Don't have an account?" : 'Already have an account?';
        toggleBtn.textContent = signin ? 'Sign up' : 'Sign in';
        passInput.setAttribute('autocomplete', signin ? 'current-password' : 'new-password');
        showError('');
    }

    toggleBtn.addEventListener('click', () => { mode = mode === 'signin' ? 'signup' : 'signin'; applyMode(); });

    submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passInput.value;
        if (!email || !password) return showError('Enter your email and password.');
        if (mode === 'signup' && password.length < 6) return showError('Password must be at least 6 characters.');

        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = mode === 'signin' ? 'Signing in…' : 'Creating…';
        showError('');
        try {
            if (mode === 'signin') {
                const { error } = await dbClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                location.replace('index.html');
            } else {
                const { data, error } = await dbClient.auth.signUp({ email, password });
                if (error) throw error;
                if (data.session) {
                    location.replace('index.html'); // email confirmation disabled → instant login
                } else {
                    showError('Account created — check your email to confirm, then sign in.');
                    mode = 'signin'; applyMode();
                    submitBtn.disabled = false; submitBtn.textContent = 'Sign In';
                }
            }
        } catch (e) {
            showError(e.message || 'Something went wrong.');
            submitBtn.disabled = false;
            submitBtn.textContent = original;
        }
    });

    [emailInput, passInput].forEach(el => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click(); }));
    applyMode();
}

// --- NOTIFICATION TOGGLE (firing logic added in Phase 3) ---
function setNotifToggleVisual(on) {
    const t = document.getElementById('notif-toggle');
    const k = document.getElementById('notif-knob');
    if (!t || !k) return;
    t.setAttribute('aria-pressed', on ? 'true' : 'false');
    t.style.background = on ? '#32d74b' : 'rgba(255,255,255,0.1)';
    k.style.left = on ? '23px' : '3px';
    k.style.background = on ? '#fff' : '#8a8a8e';
}

async function requestNotifPermission() {
    try {
        const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
        if (!LN) return true; // plugin not present yet (web / pre-Phase-3) — allow toggle
        const perm = await LN.requestPermissions();
        return perm.display === 'granted';
    } catch (_) { return true; }
}

function setupNotificationToggle() {
    const toggle = document.getElementById('notif-toggle');
    if (!toggle) return;
    let on = localStorage.getItem('precision-notifications') === 'on';
    setNotifToggleVisual(on);
    toggle.addEventListener('click', async () => {
        const next = !on;
        if (next) {
            const granted = await requestNotifPermission();
            if (!granted) { alert('Notifications were denied. Enable them in system settings to get spending alerts.'); return; }
        }
        on = next;
        localStorage.setItem('precision-notifications', on ? 'on' : 'off');
        setNotifToggleVisual(on);
        if (on) checkSpendingAlerts();
    });
}

// Fire a local notification for any budget group that's over its limit this
// month (once per group per month). Called on app load and after each import.
async function checkSpendingAlerts() {
    if (localStorage.getItem('precision-notifications') !== 'on') return;
    const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
    if (!LN) return;
    try {
        const perm = await LN.checkPermissions();
        if (perm.display !== 'granted') return;
    } catch (_) { return; }

    await loadBudgets();
    const budgets = getBudgets();
    const now = new Date();
    const { data: txns } = await dbClient.from('int_bca_categorized').select('*');
    if (!txns) return;

    const spentByGroup = {};
    txns.forEach(t => {
        if ((t.transaction_type || t.type) !== 'DB') return;
        const d = new Date(t.transaction_date || t.date);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
        const g = mapCategoryToBudgetGroup(t.category);
        spentByGroup[g] = (spentByGroup[g] || 0) + Number(t.amount);
    });

    const key = `precision-notified-${now.getFullYear()}-${now.getMonth() + 1}`;
    let notified = [];
    try { notified = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { /* ignore */ }

    const toFire = [];
    Object.keys(BUDGET_GROUPS).forEach(group => {
        const limit = getActiveLimit(budgets, group, now);
        const spent = spentByGroup[group] || 0;
        if (limit > 0 && spent > limit && !notified.includes(group)) toFire.push({ group, spent, limit });
    });
    if (!toFire.length) return;

    const notifications = toFire.map((x, i) => ({
        id: (Date.now() % 1000000) + i,
        title: `${BUDGET_GROUPS[x.group].label} over budget`,
        body: `Spent ${formatRupiah(x.spent)} of ${formatRupiah(x.limit)} this month.`,
        schedule: { at: new Date(Date.now() + 800) },
    }));
    try {
        await LN.schedule({ notifications });
        localStorage.setItem(key, JSON.stringify(notified.concat(toFire.map(x => x.group))));
    } catch (e) { console.error('Notify error:', e); }
}

function setupDesktopSidebarToggle() {
    const sidebar = document.querySelector('[data-desktop-sidebar]');
    const main = document.querySelector('[data-main-with-sidebar]');
    if (!sidebar || !main) return;

    const body = document.body;
    body.classList.add('has-desktop-sidebar');

    const syncSidebarWidth = () => {
        const width = Math.max(0, Math.round(sidebar.getBoundingClientRect().width));
        if (width > 0) {
            body.style.setProperty('--sidebar-width', `${width}px`);
        }
    };

    const storageKey = 'precision-sidebar-collapsed';
    let isCollapsed = false;

    try {
        isCollapsed = localStorage.getItem(storageKey) === '1';
    } catch (_) {
        isCollapsed = false;
    }

    if (isCollapsed) {
        body.classList.add('sidebar-collapsed');
    }

    let toggleBtn = document.getElementById('desktop-sidebar-toggle');
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.id = 'desktop-sidebar-toggle';
        toggleBtn.type = 'button';
        toggleBtn.className = 'hidden md:flex fixed top-4 left-4 z-[60] h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface border border-outline-variant/40 shadow-lg hover:bg-surface-container-highest transition-colors';
        document.body.appendChild(toggleBtn);
    }

    const updateButton = () => {
        const collapsed = body.classList.contains('sidebar-collapsed');
        toggleBtn.setAttribute('aria-label', collapsed ? 'Open sidebar' : 'Close sidebar');
        toggleBtn.innerHTML = `<span class="material-symbols-outlined">${collapsed ? 'menu' : 'menu_open'}</span>`;
    };

    toggleBtn.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
        updateButton();

        try {
            localStorage.setItem(storageKey, body.classList.contains('sidebar-collapsed') ? '1' : '0');
        } catch (_) {
            // Ignore private mode/storage restrictions.
        }
    });

    window.addEventListener('resize', syncSidebarWidth, { passive: true });
    syncSidebarWidth();
    updateButton();
}

// --- HELPERS ---
const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);

function getIconForCategory(category) {
    const cat = category ? category.toUpperCase() : 'UNCATEGORIZED';
    if (cat.includes('FOOD') || cat.includes('DINING')) return { icon: 'restaurant', color: 'text-primary' };
    if (cat.includes('TRANSPORT')) return { icon: 'directions_car', color: 'text-secondary' };
    if (cat.includes('ENTERTAINMENT')) return { icon: 'movie', color: 'text-tertiary' };
    if (cat.includes('WALLET') || cat.includes('TOPUP')) return { icon: 'account_balance_wallet', color: 'text-primary-container' };
    if (cat.includes('SHOPPING')) return { icon: 'local_mall', color: 'text-primary' };
    if (cat.includes('UTILIT') || cat.includes('BILL')) return { icon: 'bolt', color: 'text-secondary' };
    if (cat.includes('INCOME') || cat.includes('SALARY')) return { icon: 'payments', color: 'text-primary' };
    return { icon: 'receipt_long', color: 'text-on-surface' }; 
}

function aggregateCategories(transactions) {
    const map = {};
    transactions.forEach(t => {
        const name = t.category || 'Uncategorized';
        if (!map[name]) map[name] = { name: name, total: 0, count: 0 };
        map[name].total += Number(t.amount);
        map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
}

// --- GLOBAL CHART VARIABLES ---
let spendingChartInstance = null;
let globalDebits = [];

// --- MONTH VIEW NAVIGATOR (shared by dashboard, activity, categories) ---
let viewMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let dashboardTxns = [];
let activityTxns = [];
let categoryTxns = [];

const txnDateOf = (t) => new Date(t.transaction_date || t.date);
function inViewMonth(t) {
    const d = txnDateOf(t);
    return d.getFullYear() === viewMonthDate.getFullYear() && d.getMonth() === viewMonthDate.getMonth();
}
// On first load of a page, jump to the most recent month that actually has data.
function defaultToLatestMonth(txns) {
    if (!txns || !txns.length) return;
    const latest = txns.map(txnDateOf).filter(d => !isNaN(d)).sort((a, b) => b - a)[0];
    if (latest) viewMonthDate = new Date(latest.getFullYear(), latest.getMonth(), 1);
}
function renderMonthNav(rerender) {
    const host = document.getElementById('month-nav');
    if (!host) return;
    const label = viewMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    host.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;background:#161618;border:1px solid rgba(255,255,255,0.05);border-radius:14px;padding:7px;margin-bottom:18px;">
        <button id="month-prev" class="active:scale-90 transition-transform" style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.05);border:none;color:#f0f0f2;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:20px;">chevron_left</span></button>
        <span style="font-size:14px;font-weight:700;color:#f0f0f2;font-family:Inter,sans-serif;">${label}</span>
        <button id="month-next" class="active:scale-90 transition-transform" style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.05);border:none;color:#f0f0f2;cursor:pointer;display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:20px;">chevron_right</span></button>
    </div>`;
    document.getElementById('month-prev').onclick = () => { viewMonthDate = new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() - 1, 1); rerender(); };
    document.getElementById('month-next').onclick = () => { viewMonthDate = new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() + 1, 1); rerender(); };
}

// --- DASHBOARD LOGIC (index.html) ---
async function loadDashboard() {
    const { data: txns, error } = await dbClient.from('int_bca_categorized').select('*');
    if (error || !txns) return console.error("Dashboard Error:", error);
    dashboardTxns = txns;
    defaultToLatestMonth(txns);
    renderDashboard();
}

function renderDashboard() {
    renderMonthNav(renderDashboard);
    const debits = dashboardTxns.filter(inViewMonth).filter(t => (t.type === 'DB' || t.transaction_type === 'DB'));
    globalDebits = debits;

    const grandTotal = debits.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDisplay = document.getElementById('total-spent-display');
    if (totalDisplay) totalDisplay.innerText = formatRupiah(grandTotal);

    const topCategoriesList = document.getElementById('top-categories-list');
    if (topCategoriesList) {
        const top4 = aggregateCategories(debits).slice(0, 4);
        if (!top4.length) {
            topCategoriesList.innerHTML = `<p style="color:#8a8a8e;font-size:12px;padding:10px 2px;font-family:Inter,sans-serif;">No spending this month.</p>`;
        } else {
            let chipsHtml = '';
            top4.forEach(cat => {
                const style = getIconForCategory(cat.name);
                chipsHtml += `
                <div style="flex-shrink:0;background:#1e1e21;border-radius:16px;padding:14px;min-width:138px;display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,0.05);">
                    <div style="width:34px;height:34px;border-radius:10px;background:rgba(50,215,75,0.1);display:flex;align-items:center;justify-content:center;">
                        <span class="material-symbols-outlined" style="font-size:17px;color:#32d74b;">${style.icon}</span>
                    </div>
                    <div>
                        <p style="color:#8a8a8e;font-size:10px;font-weight:500;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cat.name}</p>
                        <p style="color:#f0f0f2;font-weight:700;font-size:12px;font-variant-numeric:tabular-nums;">${formatRupiah(cat.total)}</p>
                    </div>
                </div>`;
            });
            topCategoriesList.innerHTML = chipsHtml;
        }
    }

    renderMonthChart(debits);
}

// Daily spending bars for the selected month.
function renderMonthChart(debits) {
    const chartCanvas = document.getElementById('spendingChart');
    if (!chartCanvas) return;

    const year = viewMonthDate.getFullYear();
    const month = viewMonthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totals = new Array(daysInMonth).fill(0);
    debits.forEach(t => {
        const d = txnDateOf(t);
        if (d.getFullYear() === year && d.getMonth() === month) totals[d.getDate() - 1] += Number(t.amount);
    });

    const subtitle = document.getElementById('chart-date-subtitle');
    if (subtitle) subtitle.innerText = viewMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (spendingChartInstance) spendingChartInstance.destroy();
    spendingChartInstance = new Chart(chartCanvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: totals.map((_, i) => i + 1),
            datasets: [{
                data: totals,
                backgroundColor: 'rgba(50,215,75,0.75)',
                hoverBackgroundColor: '#32d74b',
                borderRadius: 3,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: {
                backgroundColor: '#1e1e21', titleColor: '#8a8a8e', bodyColor: '#f0f0f2',
                borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 10, cornerRadius: 8
            }},
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a8a8e', font: { size: 9, family: 'Inter' } }, border: { color: 'transparent' } },
                x: { grid: { display: false }, ticks: { color: '#8a8a8e', font: { size: 8, family: 'Inter' } }, border: { color: 'rgba(255,255,255,0.06)' } }
            }
        }
    });
}

// --- ACTIVITY LOGIC (activity.html) ---
async function loadTransactions() {
    const { data: txns, error } = await dbClient.from('int_bca_categorized').select('*');
    if (error) return console.error(error);
    activityTxns = txns;
    defaultToLatestMonth(txns);
    renderActivity();
}

function renderActivity() {
    renderMonthNav(renderActivity);
    const txns = activityTxns.filter(inViewMonth).sort((a, b) => txnDateOf(b) - txnDateOf(a));

    const container = document.getElementById('transaction-list');
    if (!txns.length) {
        container.innerHTML = `<p style="color:#8a8a8e;font-size:13px;text-align:center;padding:36px 0;font-family:Inter,sans-serif;">No transactions this month.</p>`;
        return;
    }
    let groups = [];
    let currentGroupDate = '';
    let currentGroup = null;

    txns.forEach(txn => {
        const dateVal = txn.date || txn.transaction_date;
        const dateObj = new Date(dateVal);
        const dateString = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        if (dateString !== currentGroupDate) {
            currentGroup = { date: dateString, txns: [] };
            groups.push(currentGroup);
            currentGroupDate = dateString;
        }
        currentGroup.txns.push(txn);
    });

    let htmlContent = '';
    groups.forEach(group => {
        htmlContent += `
        <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <span style="font-size:11px;font-weight:600;color:#8a8a8e;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;font-family:Inter,sans-serif;">${group.date}</span>
                <div style="flex:1;height:1px;background:rgba(255,255,255,0.05);"></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">`;

        group.txns.forEach(txn => {
            const typeVal = txn.type || txn.transaction_type;
            const formattedAmount = formatRupiah(txn.amount);
            const isCredit = typeVal === 'CR';
            const sign = isCredit ? '+' : '';
            const iconData = getIconForCategory(txn.category);
            const amountColor = isCredit ? '#32d74b' : '#f0f0f2';
            const iconBg = isCredit ? 'rgba(50,215,75,0.1)' : 'rgba(50,215,75,0.07)';
            const category = txn.category || 'Uncategorized';

            htmlContent += `
            <div class="active:scale-[0.98] transition-transform" style="background:#161618;border-radius:14px;padding:13px 14px;display:flex;align-items:center;gap:12px;border:1px solid rgba(255,255,255,0.04);">
                <div style="width:40px;height:40px;flex-shrink:0;border-radius:11px;background:${iconBg};display:flex;align-items:center;justify-content:center;">
                    <span class="material-symbols-outlined" style="font-size:18px;color:#32d74b;font-variation-settings:'FILL' 1;">${iconData.icon}</span>
                </div>
                <div style="flex:1;min-width:0;">
                    <p style="font-size:13px;font-weight:600;color:#f0f0f2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;font-family:Inter,sans-serif;">${txn.description}</p>
                    <p style="font-size:11px;color:#8a8a8e;margin-top:2px;font-family:Inter,sans-serif;">${category}</p>
                </div>
                <div style="text-align:right;flex-shrink:0;max-width:44vw;">
                    <p style="font-size:13px;font-weight:700;color:${amountColor};font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.3;font-family:Inter,sans-serif;">${sign}${formattedAmount}</p>
                    <span style="font-size:9px;font-weight:600;color:#8a8a8e;background:rgba(255,255,255,0.06);border-radius:6px;padding:2px 6px;display:inline-block;margin-top:3px;font-family:Inter,sans-serif;">${typeVal}</span>
                </div>
            </div>`;
        });

        htmlContent += `</div></div>`;
    });

    container.innerHTML = htmlContent;
}

// --- CATEGORIES LOGIC (category.html) ---
async function loadCategoriesPage() {
    const { data: txns } = await dbClient.from('int_bca_categorized').select('*');
    if (!txns) return;
    categoryTxns = txns;
    defaultToLatestMonth(txns);
    renderCategoriesPage();
}

function renderCategoriesPage() {
    renderMonthNav(renderCategoriesPage);
    const debits = categoryTxns.filter(inViewMonth).filter(t => (t.type === 'DB' || t.transaction_type === 'DB'));
    const categoryTotals = aggregateCategories(debits);
    const grandTotal = categoryTotals.reduce((sum, cat) => sum + cat.total, 0); 
    
    let cardsHtml = '';
    categoryTotals.forEach(cat => {
        const style = getIconForCategory(cat.name);
        const percentage = grandTotal > 0 ? Math.round((cat.total / grandTotal) * 100) : 0;

        cardsHtml += `
        <div class="bg-surface-container-low rounded-xl p-5 hover:bg-surface-container-high transition-colors border border-outline-variant/15">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center">
                        <span class="material-symbols-outlined ${style.color}">${style.icon}</span>
                    </div>
                    <div>
                        <h2 class="font-bold text-on-surface text-base">${cat.name}</h2>
                        <p class="text-sm text-on-surface-variant mt-0.5">${cat.count} Transactions</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-on-surface text-lg">${formatRupiah(cat.total)}</p>
                    <p class="text-sm ${style.color} mt-0.5 font-medium">${percentage}% of total</p>
                </div>
            </div>
            <div class="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                <div class="bg-gradient-to-r from-primary to-primary-container h-1.5 rounded-full" style="width: ${percentage}%"></div>
            </div>
        </div>`;
    });
    const host = document.getElementById('category-cards');
    host.innerHTML = cardsHtml || `<p style="color:#8a8a8e;font-size:13px;text-align:center;padding:24px 0;font-family:Inter,sans-serif;">No spending this month.</p>`;
}

// --- ADD RULE LOGIC (add-rule.html) ---
function setupAddRule() {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        const keywordInput = document.getElementById('keyword').value.toUpperCase();
        const categorySelect = document.getElementById('category');
        const categoryText = categorySelect.options[categorySelect.selectedIndex].text;

        if (!keywordInput || categoryText === "Select a category") return alert("Please fill everything!");

        const { error } = await dbClient.from('merchant_mapping').insert([{ keyword: keywordInput, category: categoryText }]);
        if (error) return alert("Failed to save rule.");
        
        window.location.href = "activity.html"; 
    });
}

// --- ADD TRANSACTION LOGIC (add-transaction.html) ---
function setupAddTransaction() {
    const submitBtn = document.getElementById('submit-transaction');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const amountStr = document.getElementById('amount-input').value;
        const description = document.getElementById('description-input').value.toUpperCase();
        const rawDate = document.querySelector('input[type="date"]').value; // YYYY-MM-DD

        const amountNumber = parseInt(amountStr.replace(/\D/g, ''), 10);
        const isExpense = document.getElementById('expense-tab').getAttribute('aria-pressed') === 'true';
        const transactionType = isExpense ? 'DB' : 'CR';

        if (!amountNumber || !description || !rawDate) return alert("Please fill everything!");

        // Store the full ISO date (the stg view now parses YYYY-MM-DD directly),
        // so the year is preserved instead of being forced to 2026.
        const { error } = await dbClient.from('bca_transactions').insert([{
            date: rawDate,
            description: description,
            amount: amountNumber,
            type: transactionType
        }]);

        if (error) return alert(`Failed to save: ${error.message}`);
        window.location.href = "activity.html";
    });
}
// --- SECURE STORAGE HELPERS ---
// The native @aparajita/capacitor-secure-storage bridge exposes only the
// low-level internal* methods. Its get()/set() convenience wrappers live in the
// plugin's JS layer, which this no-bundler app never loads — so we call the
// native methods directly, matching the wrapper's key prefix + JSON encoding.
// (We still prefer get()/set() if they ever become available.)
const SECURE_PREFIX = 'capacitor-storage_';

async function getSecureItem(key) {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
        const ss = Capacitor.Plugins.SecureStorage;
        try {
            if (typeof ss.get === 'function') return await ss.get(key);
            const { data } = await ss.internalGetItem({ prefixedKey: SECURE_PREFIX + key, sync: false });
            return data == null ? null : JSON.parse(data);
        } catch (_) { return null; }
    }
    return localStorage.getItem(key);
}

async function setSecureItem(key, value) {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
        const ss = Capacitor.Plugins.SecureStorage;
        if (typeof ss.set === 'function') { await ss.set(key, value); return; }
        await ss.internalSetItem({ prefixedKey: SECURE_PREFIX + key, data: JSON.stringify(value), sync: false, access: 0 });
    } else {
        localStorage.setItem(key, value);
    }
}

// --- ACCOUNT & SETTINGS LOGIC (account.html) ---
function setupAccountPage() {
    const exportBtn = document.getElementById('export-csv-btn');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const apiKeyInput = document.getElementById('api-key-input');

    // 0. PROFILE (name from user_metadata, email from the auth user)
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const editNameBtn = document.getElementById('edit-name-btn');
    const signOutBtn = document.getElementById('sign-out-btn');

    dbClient.auth.getUser().then(({ data }) => {
        const user = data && data.user;
        if (!user) return;
        if (emailEl) emailEl.textContent = user.email || '';
        const fallback = (user.email || 'User').split('@')[0];
        if (nameEl) nameEl.textContent = (user.user_metadata && user.user_metadata.display_name) || fallback;
    });

    if (editNameBtn) editNameBtn.addEventListener('click', async () => {
        const current = nameEl ? nameEl.textContent : '';
        const next = (window.prompt('Display name', current) || '').trim();
        if (!next || next === current) return;
        const { error } = await dbClient.auth.updateUser({ data: { display_name: next } });
        if (error) return alert(`Couldn't update name: ${error.message}`);
        if (nameEl) nameEl.textContent = next;
    });

    if (signOutBtn) signOutBtn.addEventListener('click', () => signOutAndRedirect());

    setupNotificationToggle();

    // 1. API KEY SAVER
    if (saveKeyBtn && apiKeyInput) {
        getSecureItem('market_api_key').then(existing => {
            if (existing) apiKeyInput.placeholder = "•••••••••••• (Key Saved)";
        });

        saveKeyBtn.addEventListener('click', async () => {
            const key = apiKeyInput.value.trim();
            if (!key) return alert("Please enter a valid API key.");

            await setSecureItem('market_api_key', key);
            apiKeyInput.value = '';
            apiKeyInput.placeholder = "•••••••••••• (Key Saved)";
            alert("API Key saved!");
        });
    }

    // 2. DATABASE CSV EXPORTER
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">sync</span> Fetching Data...`;
            
            // Fetch everything from your main categorization view
            const { data: txns, error } = await dbClient.from('int_bca_categorized').select('*');
            
            if (error || !txns || txns.length === 0) {
                exportBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">download</span> Export Data as CSV`;
                return alert("Failed to fetch data or database is empty.");
            }

            // A. Create the CSV Headers (Date, Amount, Category, etc.)
            const headers = Object.keys(txns[0]).join(',');

            // B. Map the data into CSV rows, wrapping text in quotes to prevent commas from breaking columns
            const csvRows = txns.map(row => {
                return Object.values(row).map(value => {
                    const stringValue = String(value || '');
                    return `"${stringValue.replace(/"/g, '""')}"`; 
                }).join(',');
            });

            // C. Combine headers and rows
            const csvString = [headers, ...csvRows].join('\n');

            // D. Trigger the hidden download
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            const today = new Date().toISOString().split('T')[0]; 
            a.setAttribute('href', url);
            a.setAttribute('download', `Precision_Backup_${today}.csv`);
            a.click();
            
            // Cleanup and reset button
            window.URL.revokeObjectURL(url);
            exportBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">download</span> Export Data as CSV`;
        });
    }
}
// --- BANK EMAIL IMPORT PAGE (import.html) ---
const IMPORT_FN_URL = `${SUPABASE_URL}/functions/v1/import-bca-emails`;
// Shared secret sent as x-import-secret; the function rejects callers without it
// once IMPORT_SHARED_SECRET is set in the function's env. Defense-in-depth on top
// of the public anon key (keeps random anon-key holders from invoking the importer).
const IMPORT_SECRET = 'n6XUP3iN4vljR31iaZytgQN_1AyvchAw';

function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const fmtThousand = (n) => new Intl.NumberFormat('id-ID').format(Number(n) || 0);

function setupImportPage() {
    const userInput = document.getElementById('gmail-user-input');
    const passInput = document.getElementById('gmail-pass-input');
    const fromInput = document.getElementById('import-from');
    const toInput = document.getElementById('import-to');
    const scanBtn = document.getElementById('scan-emails-btn');
    const statusEl = document.getElementById('import-status');
    const resultsEl = document.getElementById('import-results');
    const toolbar = document.getElementById('import-toolbar');
    const toggleAllBtn = document.getElementById('toggle-all-btn');
    const actionBar = document.getElementById('import-action-bar');
    const confirmBtn = document.getElementById('import-confirm-btn');
    const confirmLabel = document.getElementById('import-confirm-label');
    if (!scanBtn) return;

    // Default range: previous month -> current month.
    const now = new Date();
    const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!fromInput.value) fromInput.value = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    if (!toInput.value) toInput.value = ym(now);

    // Prefill saved Gmail address; show that a password is already stored.
    getSecureItem('gmail_user').then(v => { if (v) userInput.value = v; });
    getSecureItem('gmail_app_password').then(v => { if (v) passInput.placeholder = '•••••••••••••••• (saved)'; });

    function setStatus(html, color) {
        statusEl.style.display = html ? 'block' : 'none';
        statusEl.style.color = color || '#8a8a8e';
        statusEl.innerHTML = html;
    }

    async function callFn(body) {
        // Send the signed-in user's access token so the function stamps the right owner.
        const { data: { session } } = await dbClient.auth.getSession();
        const token = (session && session.access_token) || SUPABASE_ANON_KEY;
        const res = await fetch(IMPORT_FN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_ANON_KEY,
                'x-import-secret': IMPORT_SECRET,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data.error || `Request failed (${res.status})`;
            throw new Error(data.detail ? `${msg} [${data.detail}]` : msg);
        }
        return data;
    }

    // ----- selection helpers -----
    const selectable = () => [...resultsEl.querySelectorAll('.txn-card:not(.already)')];
    const isOn = (card) => card.querySelector('.chk').classList.contains('on');
    function setOn(card, on) {
        card.querySelector('.chk').classList.toggle('on', on);
        card.classList.toggle('excluded', !on);
    }
    function updateCount() {
        const n = selectable().filter(isOn).length;
        confirmLabel.textContent = n ? `Import ${n} selected` : 'Select transactions';
        confirmBtn.disabled = n === 0;
        confirmBtn.style.opacity = n === 0 ? '0.5' : '1';
        const anyOn = selectable().some(isOn);
        toggleAllBtn.textContent = anyOn ? 'Deselect all' : 'Select all';
    }

    function cardHTML(t) {
        const already = t.alreadyImported;
        const dis = already ? 'disabled' : '';
        const typeOpts = `<option value="DB" ${t.type === 'DB' ? 'selected' : ''}>Expense</option>` +
                         `<option value="CR" ${t.type === 'CR' ? 'selected' : ''}>Income</option>`;
        const badge = already
            ? `<span style="font-size:9px;font-weight:700;color:#8a8a8e;background:rgba(255,255,255,0.06);border-radius:20px;padding:3px 8px;white-space:nowrap;text-transform:uppercase;letter-spacing:0.05em;">Imported</span>`
            : '';
        return `<div class="txn-card ${already ? 'already' : ''}" data-ref="${escAttr(t.ref)}">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <div class="chk ${already ? '' : 'on'}"><span class="material-symbols-outlined">check</span></div>
                <input class="field txn-desc" type="text" value="${escAttr(t.description)}" placeholder="Description" style="flex:1;min-width:0;" ${dis}/>
                ${badge}
            </div>
            <div style="display:flex;gap:8px;">
                <input class="field txn-date" type="date" value="${escAttr(t.date)}" style="flex:1.3;" ${dis}/>
                <select class="field txn-type" style="flex:1;" ${dis}>${typeOpts}</select>
                <input class="field txn-amount" inputmode="numeric" value="${escAttr(fmtThousand(t.amount))}" style="flex:1.1;text-align:right;" ${dis}/>
            </div>
        </div>`;
    }

    function renderResults(transactions) {
        if (!transactions.length) {
            resultsEl.innerHTML = '';
            toolbar.style.display = 'none';
            actionBar.style.display = 'none';
            setStatus('No BCA transaction emails found in that range. Try a wider range.', '#8a8a8e');
            return;
        }
        const newCount = transactions.filter(t => !t.alreadyImported).length;
        setStatus(`<span style="color:#f0f0f2;font-weight:600;">Found ${transactions.length}</span> — ${newCount} new, ${transactions.length - newCount} already imported`);
        resultsEl.innerHTML = transactions.map(cardHTML).join('');
        toolbar.style.display = 'flex';
        actionBar.style.display = 'block';

        // Wire up each card.
        selectable().forEach(card => {
            card.querySelector('.chk').addEventListener('click', () => {
                if (card.classList.contains('already')) return;
                setOn(card, !isOn(card)); updateCount();
            });
            const amt = card.querySelector('.txn-amount');
            amt.addEventListener('input', () => {
                const digits = amt.value.replace(/\D/g, '');
                amt.value = digits ? fmtThousand(digits) : '';
            });
        });
        updateCount();
    }

    // ----- scan -----
    scanBtn.addEventListener('click', async () => {
        const user = (userInput.value.trim() || (await getSecureItem('gmail_user')) || '').trim();
        const pass = (passInput.value || (await getSecureItem('gmail_app_password')) || '').replace(/\s+/g, '');
        if (!user || !pass) return setStatus('Enter your Gmail address and app password first.', '#ff6b6b');
        if (!fromInput.value || !toInput.value) return setStatus('Pick a From and To month.', '#ff6b6b');
        if (fromInput.value > toInput.value) return setStatus('"From" must be the same as or before "To".', '#ff6b6b');

        await setSecureItem('gmail_user', user);
        await setSecureItem('gmail_app_password', pass);

        scanBtn.disabled = true;
        toolbar.style.display = 'none';
        actionBar.style.display = 'none';
        resultsEl.innerHTML = '';
        setStatus('<span style="color:#32d74b;">Scanning your inbox… this can take a moment.</span>');
        try {
            const data = await callFn({ action: 'scan', from: fromInput.value, to: toInput.value, gmailUser: user, gmailPassword: pass });
            renderResults(data.transactions || []);
        } catch (e) {
            setStatus(`Scan failed: ${e.message}`, '#ff6b6b');
        } finally {
            scanBtn.disabled = false;
        }
    });

    // ----- select / deselect all -----
    toggleAllBtn.addEventListener('click', () => {
        const cards = selectable();
        const target = !cards.some(isOn); // if none on -> turn all on, else turn all off
        cards.forEach(c => setOn(c, target));
        updateCount();
    });

    // ----- import selected -----
    confirmBtn.addEventListener('click', async () => {
        const chosen = selectable().filter(isOn);
        if (!chosen.length) return;
        const transactions = chosen.map(card => ({
            ref: card.dataset.ref,
            date: card.querySelector('.txn-date').value,
            description: card.querySelector('.txn-desc').value,
            amount: Number(card.querySelector('.txn-amount').value.replace(/\D/g, '')),
            type: card.querySelector('.txn-type').value,
        }));

        confirmBtn.disabled = true;
        confirmLabel.textContent = 'Importing…';
        try {
            const data = await callFn({ action: 'import', transactions });
            setStatus(`<span style="color:#32d74b;font-weight:600;">Imported ${data.imported}${data.skipped ? `, skipped ${data.skipped} already there` : ''}${data.invalid ? `, ${data.invalid} invalid` : ''}.</span> <a href="activity.html" style="color:#32d74b;text-decoration:underline;">View in Activity →</a>`, '#32d74b');
            // Mark the imported cards as done so they can't be re-sent.
            chosen.forEach(card => {
                card.classList.add('already');
                card.classList.remove('excluded');
                card.querySelector('.chk').classList.remove('on');
                card.querySelectorAll('input,select').forEach(el => { el.disabled = true; });
            });
            updateCount();
            checkSpendingAlerts().catch(() => {}); // alert if this import pushed a category over budget
        } catch (e) {
            setStatus(`Import failed: ${e.message}`, '#ff6b6b');
        } finally {
            confirmBtn.disabled = false;
        }
    });
}

// --- NAVIGATION INJECTOR ---
async function loadNavigation() {
    try {
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer) {
            sidebarContainer.innerHTML = SIDEBAR_TEMPLATE;
        }

        const bottombarContainer = document.getElementById('bottombar-container');
        if (bottombarContainer) {
            bottombarContainer.innerHTML = BOTTOMBAR_TEMPLATE;
        }

        const rawPage = window.location.pathname.split("/").pop();
        const currentPage = (rawPage && rawPage.endsWith('.html')) ? rawPage : 'index.html';

        const sidebarLinks = document.querySelectorAll('#sidebar-container a');
        sidebarLinks.forEach(link => {
            const icon = link.querySelector('.material-symbols-outlined');
            if (link.getAttribute('href') === currentPage) {
                link.className = "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200";
                link.style.cssText = "background:rgba(50,215,75,0.1);color:#32d74b;font-size:13px;font-weight:600;";
                if (icon) { icon.style.fontSize = '18px'; icon.style.fontVariationSettings = "'FILL' 1"; }
            } else {
                link.className = "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200";
                link.style.cssText = "color:#8a8a8e;font-size:13px;font-weight:500;";
                if (icon) { icon.style.fontSize = '18px'; icon.style.fontVariationSettings = "'FILL' 0"; }
            }
        });

        const bottomLinks = document.querySelectorAll('#bottombar-container a');
        bottomLinks.forEach(link => {
            const icon = link.querySelector('.material-symbols-outlined');
            if (link.getAttribute('href') === currentPage) {
                link.className = "flex-1 flex flex-col items-center transition-all duration-200 active:scale-95";
                link.style.cssText = "gap:3px;padding:8px 10px;border-radius:18px;color:#32d74b;background:rgba(50,215,75,0.12);";
                if (icon) { icon.style.fontSize = '20px'; icon.style.lineHeight = '1'; icon.style.fontVariationSettings = "'FILL' 1"; }
            } else {
                link.className = "flex-1 flex flex-col items-center transition-all duration-200 active:scale-95";
                link.style.cssText = "gap:3px;padding:8px 10px;border-radius:18px;color:#8a8a8e;";
                if (icon) { icon.style.fontSize = '20px'; icon.style.lineHeight = '1'; icon.style.fontVariationSettings = "'FILL' 0"; }
            }
        });

    } catch (error) {
        console.error("Failed to load navigation components:", error);
    }
}

// --- BUDGET LOGIC (budget.html) ---
const BUDGET_GROUPS = {
    FOOD: { label: 'Food & Dining', icon: 'restaurant' },
    TRANSPORT: { label: 'Transport', icon: 'directions_car' },
    ENTERTAINMENT: { label: 'Entertainment', icon: 'movie' },
    SHOPPING: { label: 'Shopping', icon: 'local_mall' },
    BILLS: { label: 'Bills & Utilities', icon: 'bolt' },
    OTHER: { label: 'Other', icon: 'receipt_long' }
};

function mapCategoryToBudgetGroup(category) {
    const cat = category ? category.toUpperCase() : '';
    if (cat.includes('FOOD') || cat.includes('DINING')) return 'FOOD';
    if (cat.includes('TRANSPORT')) return 'TRANSPORT';
    if (cat.includes('ENTERTAINMENT')) return 'ENTERTAINMENT';
    if (cat.includes('SHOPPING')) return 'SHOPPING';
    if (cat.includes('BILL') || cat.includes('UTILIT')) return 'BILLS';
    return 'OTHER';
}

// Budgets live in the per-user `budgets` table (RLS-scoped). We keep a sync
// in-memory cache so the existing render/getActiveLimit code stays synchronous;
// loadBudgets() refreshes it from the DB before rendering.
let budgetsCache = {};

function getBudgets() {
    return budgetsCache;
}

async function loadBudgets() {
    const { data, error } = await dbClient.from('budgets').select('grp, amount, start_month, end_month');
    if (error) { console.error('Budgets load error:', error); return budgetsCache; }
    const map = {};
    for (const r of data || []) {
        map[r.grp] = { amount: Number(r.amount), startMonth: r.start_month, endMonth: r.end_month };
    }
    budgetsCache = map;
    return map;
}

async function saveBudgetEntry(group, entry) {
    budgetsCache[group] = entry; // optimistic local update
    const { error } = await dbClient.from('budgets').upsert(
        { grp: group, amount: entry.amount, start_month: entry.startMonth, end_month: entry.endMonth },
        { onConflict: 'user_id,grp' }
    );
    if (error) alert(`Couldn't save budget: ${error.message}`);
}

async function deleteBudgetEntry(group) {
    delete budgetsCache[group]; // optimistic local update
    const { error } = await dbClient.from('budgets').delete().eq('grp', group);
    if (error) alert(`Couldn't remove budget: ${error.message}`);
}

function monthStrToIdx(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    return year * 12 + (month - 1);
}

function idxToMonthStr(idx) {
    const year = Math.floor(idx / 12);
    const month = idx % 12;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getEntryEndMonth(entry) {
    if (entry.endMonth) return entry.endMonth;
    const startIdx = monthStrToIdx(entry.startMonth);
    return idxToMonthStr(startIdx + (entry.months || 1) - 1);
}

function getActiveLimit(budgets, group, date) {
    const entry = budgets[group];
    if (entry == null) return 0;
    if (typeof entry === 'number') return entry;

    const startIdx = monthStrToIdx(entry.startMonth);
    const endIdx = monthStrToIdx(getEntryEndMonth(entry));
    const targetIdx = date.getFullYear() * 12 + date.getMonth();

    return (targetIdx >= startIdx && targetIdx <= endIdx) ? entry.amount : 0;
}

let budgetMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let budgetTxns = [];

function budgetMonthStr() {
    return `${budgetMonthDate.getFullYear()}-${String(budgetMonthDate.getMonth() + 1).padStart(2, '0')}`;
}

async function setupBudgetPage() {
    const { data: txns, error } = await dbClient.from('int_bca_categorized').select('*');
    if (error) {
        console.error("Budget Error:", error);
    }
    budgetTxns = txns || [];
    await loadBudgets();

    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => {
        budgetMonthDate = new Date(budgetMonthDate.getFullYear(), budgetMonthDate.getMonth() - 1, 1);
        renderBudgetPage();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        budgetMonthDate = new Date(budgetMonthDate.getFullYear(), budgetMonthDate.getMonth() + 1, 1);
        renderBudgetPage();
    });

    const setBtn = document.getElementById('set-budget-btn');
    const emptyBtn = document.getElementById('empty-set-budget-btn');
    const untilInput = document.getElementById('sheet-until');
    const deleteBtn = document.getElementById('sheet-delete-btn');
    [setBtn, emptyBtn].forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            document.getElementById('sheet-category').value = '';
            document.getElementById('sheet-amount').value = '';
            untilInput.value = budgetMonthStr();
            if (deleteBtn) deleteBtn.style.display = 'none'; // new budget → no delete
        });
    });

    if (deleteBtn) deleteBtn.addEventListener('click', async () => {
        const group = document.getElementById('sheet-category').value;
        if (!group || !getBudgets()[group]) return;
        if (!confirm(`Remove the ${(BUDGET_GROUPS[group] && BUDGET_GROUPS[group].label) || group} budget?`)) return;
        await deleteBudgetEntry(group);
        if (window.closeSheet) window.closeSheet();
        renderBudgetPage();
    });

    const saveBtn = document.getElementById('sheet-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
        const categorySelect = document.getElementById('sheet-category');
        const amountInput = document.getElementById('sheet-amount');
        const group = categorySelect.value;
        const amount = Number(amountInput.value.replace(/\D/g, ''));
        const startMonth = budgetMonthStr();
        const endMonth = untilInput.value || startMonth;

        if (!group) return alert("Please select a category!");
        if (!amount) return alert("Please enter a budget amount!");
        if (endMonth < startMonth) return alert("Apply Until must be the current month or later!");

        await saveBudgetEntry(group, { amount, startMonth, endMonth });

        categorySelect.value = '';
        amountInput.value = '';
        untilInput.value = startMonth;
        if (window.closeSheet) window.closeSheet();
        renderBudgetPage();
    });

    renderBudgetPage();
}

function renderBudgetPage() {
    const monthLabel = document.getElementById('budget-month-label');
    if (monthLabel) monthLabel.textContent = budgetMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const year = budgetMonthDate.getFullYear();
    const month = budgetMonthDate.getMonth();

    const monthDebits = budgetTxns.filter(t => {
        const typeVal = t.type || t.transaction_type;
        if (typeVal !== 'DB') return false;
        const d = new Date(t.date || t.transaction_date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const spentByGroup = {};
    let totalSpent = 0;
    monthDebits.forEach(t => {
        const group = mapCategoryToBudgetGroup(t.category);
        const amount = Math.abs(Number(t.amount) || 0);
        spentByGroup[group] = (spentByGroup[group] || 0) + amount;
        totalSpent += amount;
    });

    const budgets = getBudgets();
    const totalBudget = Object.keys(BUDGET_GROUPS).reduce((sum, g) => sum + getActiveLimit(budgets, g, budgetMonthDate), 0);
    const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Hero card
    const heroSpent = document.getElementById('hero-spent');
    const heroBudgetLabel = document.getElementById('hero-budget-label');
    const heroProgressBar = document.getElementById('hero-progress-bar');
    const heroStatusBadge = document.getElementById('hero-status-badge');
    const heroPctLabel = document.getElementById('hero-pct-label');

    if (heroSpent) heroSpent.textContent = formatRupiah(totalSpent);

    if (heroBudgetLabel) {
        heroBudgetLabel.textContent = totalBudget > 0
            ? `of ${formatRupiah(totalBudget)} budgeted`
            : 'No budget set for this month';
    }

    let statusColor = '#32d74b', statusBg = 'rgba(50,215,75,0.1)', statusIcon = 'check_circle', statusText = 'On Track';
    let progressBg = 'linear-gradient(to right,#32d74b,#5de477)';
    if (totalBudget > 0) {
        if (totalPct >= 100) {
            statusColor = '#ff453a'; statusBg = 'rgba(255,69,58,0.1)'; statusIcon = 'error'; statusText = 'Over Budget'; progressBg = '#ff453a';
        } else if (totalPct >= 75) {
            statusColor = '#f59e0b'; statusBg = 'rgba(245,158,11,0.1)'; statusIcon = 'warning'; statusText = 'Near Limit'; progressBg = '#f59e0b';
        }
    }

    if (heroProgressBar) {
        heroProgressBar.style.width = `${Math.min(100, totalPct)}%`;
        heroProgressBar.style.background = progressBg;
    }
    if (heroStatusBadge) {
        heroStatusBadge.style.color = statusColor;
        heroStatusBadge.style.background = statusBg;
        heroStatusBadge.innerHTML = `<span class="material-symbols-outlined" style="font-size:12px;font-variation-settings:'FILL' 1;">${statusIcon}</span> ${statusText}`;
    }
    if (heroPctLabel) heroPctLabel.textContent = `${Math.round(totalPct)}% used`;

    // Category list
    const list = document.getElementById('budget-categories-list');
    const emptyState = document.getElementById('budget-empty-state');
    const activeGroups = Object.keys(BUDGET_GROUPS).filter(g => budgets[g] || spentByGroup[g]);

    if (activeGroups.length === 0) {
        if (list) list.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (list) list.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    activeGroups.forEach(group => {
        const meta = BUDGET_GROUPS[group];
        const spent = spentByGroup[group] || 0;
        const entry = budgets[group];
        const limit = getActiveLimit(budgets, group, budgetMonthDate);
        const groupPct = limit > 0 ? (spent / limit) * 100 : 0;

        let barColor = '#8a8a8e', iconBg = 'rgba(255,255,255,0.05)', iconColor = '#8a8a8e', pctColor = '#8a8a8e', statusSuffix = '';
        if (limit > 0) {
            barColor = '#32d74b'; iconBg = 'rgba(50,215,75,0.08)'; iconColor = '#32d74b';
            if (groupPct >= 100) {
                barColor = '#ff453a'; iconBg = 'rgba(255,69,58,0.08)'; iconColor = '#ff453a'; pctColor = '#ff453a'; statusSuffix = ' · Over budget';
            } else if (groupPct >= 75) {
                barColor = '#f59e0b'; iconBg = 'rgba(245,158,11,0.08)'; iconColor = '#f59e0b'; pctColor = '#f59e0b'; statusSuffix = ' · Almost full';
            }
        }

        const limitText = limit > 0 ? formatRupiah(limit) : 'No limit set';
        const pctText = limit > 0 ? `${Math.round(groupPct)}% used${statusSuffix}` : 'Tap to set a limit';

        let untilText = '';
        if (limit > 0 && entry && typeof entry === 'object') {
            const endMonth = getEntryEndMonth(entry);
            if (endMonth !== entry.startMonth) {
                const endIdx = monthStrToIdx(endMonth);
                const endDate = new Date(Math.floor(endIdx / 12), endIdx % 12, 1);
                untilText = ` · until ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
            }
        }

        html += `
        <div class="budget-category-card active:scale-[0.98] transition-transform" data-group="${group}" style="background:#161618;border-radius:14px;padding:14px;border:1px solid rgba(255,255,255,0.04);cursor:pointer;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:40px;height:40px;flex-shrink:0;border-radius:11px;background:${iconBg};display:flex;align-items:center;justify-content:center;">
                        <span class="material-symbols-outlined" style="font-size:18px;color:${iconColor};font-variation-settings:'FILL' 1;">${meta.icon}</span>
                    </div>
                    <div>
                        <p style="font-size:13px;font-weight:600;color:#f0f0f2;font-family:Inter,sans-serif;line-height:1.3;">${meta.label}</p>
                        <p style="font-size:11px;color:${pctColor};margin-top:1px;font-family:Inter,sans-serif;">${pctText}</p>
                    </div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <p style="font-size:13px;font-weight:700;color:#f0f0f2;font-variant-numeric:tabular-nums;font-family:Inter,sans-serif;">${formatRupiah(spent)}</p>
                    <p style="font-size:11px;color:#8a8a8e;margin-top:1px;font-family:Inter,sans-serif;">of ${limitText}${untilText}</p>
                </div>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, groupPct)}%;background:${barColor};border-radius:2px;"></div>
            </div>
        </div>`;
    });

    list.innerHTML = html;

    list.querySelectorAll('.budget-category-card').forEach(card => {
        card.addEventListener('click', () => {
            const group = card.getAttribute('data-group');
            const categorySelect = document.getElementById('sheet-category');
            const amountInput = document.getElementById('sheet-amount');
            const untilInput = document.getElementById('sheet-until');
            categorySelect.value = group;

            const entry = budgets[group];
            if (entry && typeof entry === 'object') {
                amountInput.value = new Intl.NumberFormat('id-ID').format(Number(entry.amount));
                untilInput.value = getEntryEndMonth(entry);
            } else if (entry) {
                amountInput.value = new Intl.NumberFormat('id-ID').format(Number(entry));
                untilInput.value = budgetMonthStr();
            } else {
                amountInput.value = '';
                untilInput.value = budgetMonthStr();
            }

            const delBtn = document.getElementById('sheet-delete-btn');
            if (delBtn) delBtn.style.display = entry ? 'flex' : 'none'; // show only if a budget exists

            if (window.openSheet) window.openSheet();
        });
    });
}