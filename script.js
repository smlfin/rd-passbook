document.addEventListener('DOMContentLoaded', () => {

    // ===================== LOADING =====================
    setTimeout(() => {
        const ls = document.getElementById('loading-screen');
        ls.classList.add('fade-out');
        setTimeout(() => { ls.style.display = 'none'; showLogin(); }, 500);
    }, 1600);

    function showLogin() {
        document.getElementById('login-container').classList.remove('hidden');
    }

    // ===================== DOM REFS =====================
    const loginContainer     = document.getElementById('login-container');
    const dashboard          = document.getElementById('dashboard');
    const loginForm          = document.getElementById('login-form');
    const passwordInput      = document.getElementById('password');
    const errorMsg           = document.getElementById('error-message');
    const logoutBtn          = document.getElementById('logout-btn');
    const greetingEl         = document.getElementById('greeting');
    const topbarDate         = document.getElementById('topbar-date');
    const userAvatar         = document.getElementById('user-avatar');
    const accountSelectorCtr = document.getElementById('account-selector-container');
    const accountSelector    = document.getElementById('account-selector');
    const hamburger          = document.getElementById('hamburger');
    const sidebar            = document.getElementById('sidebar');

    let growthChart = null;

    // ===================== DATA =====================
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/18K6X1q30z7zvi6zrOrrSWZSJpPULhP4INiMnknyVC9A/export?format=csv&gid=643936536';
    let allAccounts = [];
    let currentAccounts = [];
    let currentAccount = null;

    // ===================== UTILITIES =====================
    function fmt(n) {
        return '\u20B9' + Number(n).toLocaleString('en-IN');
    }
    function cleanStr(s) {
        return typeof s === 'string' ? s.replace(/\s/g, '').trim() : '';
    }
    function parseDateTS(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return 0;
        const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
        if (parts.length !== 3) return 0;
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    function formatDisplayDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
        if (parts.length !== 3) return dateStr;
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function generatePassword(name, mobile) {
        return cleanStr(name).slice(0, 4).toLowerCase() + cleanStr(mobile).slice(-4);
    }

    // ===================== MATURITY CALCULATION =====================
    function calculateMaturity(principal, totalMonths, startDateStr) {
        if (isNaN(principal) || isNaN(totalMonths) || totalMonths <= 0 || !startDateStr) return 0;
        const rate = getRate(totalMonths, startDateStr);
        const i = rate / 1200;
        const n = totalMonths;
        return Math.round(principal * ((Math.pow(1 + i, n) - 1) / i) * (1 + i));
    }

    function getRate(totalMonths, startDateStr) {
        const ts = parseDateTS(startDateStr);
        const nov3_2025  = new Date(2025, 10,  3).getTime();
        const dec22_2025 = new Date(2025, 11, 22).getTime();
        const jan1_2026  = new Date(2026,  0,  1).getTime();
        const apr1_2026  = new Date(2026,  3,  1).getTime();
        const years = totalMonths / 12;
        if (ts < nov3_2025) return 12.00;
        if (ts < dec22_2025) {
            if (years >= 1 && years < 3) return 10.00;
            if (years >= 3 && years <= 5) return 12.00;
            return 12.00;
        }
        if (ts < jan1_2026) {
            if (years >= 1 && years < 3) return 10.00;
            if (years >= 3 && years <= 5) return 11.50;
            return 10.00;
        }
        if (ts < apr1_2026) return 10.00;
        if (years === 1) return 10.00;
        if (years === 2) return 11.00;
        if (years >= 3 && years <= 5) return 12.00;
        return 10.00;
    }

    // Compute maturity date as startDate + totalMonths (used when CSV MATURITY_DATE is blank)
    function computeMaturityDate(startDateStr, totalMonths) {
        if (!startDateStr) return '-';
        const parts = startDateStr.includes('-') ? startDateStr.split('-') : startDateStr.split('/');
        if (parts.length !== 3) return '-';
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1 + totalMonths, parseInt(parts[0]));
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function getMaturityDateDisplay(acc, totalMonths) {
        // Use CSV value if present, otherwise compute
        const raw = String(acc.MATURITY_DATE || '').trim();
        if (raw && raw !== '0' && raw.length > 3) return formatDisplayDate(raw);
        return computeMaturityDate(acc.START_DATE, totalMonths);
    }

    function calcMaturityGeneric(monthly, months, rate) {
        const i = rate / 1200;
        const n = months;
        return Math.round(monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i));
    }

    // ===================== CSV =====================
    async function fetchCSV() {
        try {
            const res = await fetch(CSV_URL);
            if (!res.ok) throw new Error('Network error');
            allAccounts = parseCSV(await res.text());
        } catch (e) {
            console.error('CSV fetch failed:', e);
        }
    }

    function parseCSV(csv) {
        const lines = csv.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = [];
            let inQ = false, start = 0;
            for (let j = 0; j < lines[i].length; j++) {
                if (lines[i][j] === '"') inQ = !inQ;
                else if (lines[i][j] === ',' && !inQ) { vals.push(lines[i].substring(start, j)); start = j + 1; }
            }
            vals.push(lines[i].substring(start));
            if (vals.length === headers.length) {
                const obj = {};
                headers.forEach((h, idx) => {
                    const v = vals[idx].replace(/^"|"$/g, '').trim();
                    obj[h] = isNaN(parseFloat(v)) ? v : parseFloat(v);
                });
                obj['START_DATE']        = cleanStr(vals[4]);
                obj['PAID_INSATLMET']    = cleanStr(vals[6]);
                obj['INSATLMENT_AMOUNT'] = parseFloat(String(vals[5]).replace(/[^0-9.]/g, '')) || 0;
                data.push(obj);
            }
        }
        return data;
    }

    fetchCSV();

    // ===================== PASSWORD TOGGLE =====================
    document.getElementById('toggle-password').addEventListener('click', () => {
        const isText = passwordInput.type === 'text';
        passwordInput.type = isText ? 'password' : 'text';
        document.getElementById('eye-open').classList.toggle('hidden', !isText);
        document.getElementById('eye-closed').classList.toggle('hidden', isText);
    });

    // ===================== LOGIN =====================
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const entered = passwordInput.value.trim().toLowerCase();
        const matches = allAccounts.filter(acc =>
            generatePassword(String(acc["Customer Name"]), String(acc["Customer Mobile number"])) === entered
        );
        if (matches.length > 0) {
            currentAccounts = matches;
            errorMsg.classList.add('hidden');
            loginContainer.classList.add('hidden');
            dashboard.classList.remove('hidden');
            initDashboard(matches[0]);
            if (matches.length > 1) {
                populateAccountSelector(matches);
                accountSelectorCtr.classList.remove('hidden');
            } else {
                accountSelectorCtr.classList.add('hidden');
            }
        } else {
            errorMsg.classList.remove('hidden');
            errorMsg.textContent = 'Invalid password. Please try again.';
            passwordInput.value = '';
        }
    });

    accountSelector.addEventListener('change', e => {
        const acc = currentAccounts.find(a => String(a["RD NUMBER"]) === e.target.value);
        if (acc) initDashboard(acc);
    });

    function populateAccountSelector(accounts) {
        accountSelector.innerHTML = accounts.map(a =>
            `<option value="${a["RD NUMBER"]}">${a["RD NUMBER"]}</option>`
        ).join('');
    }

    // ===================== LOGOUT =====================
    logoutBtn.addEventListener('click', () => {
        dashboard.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        passwordInput.value = '';
        currentAccount = null;
        currentAccounts = [];
        if (growthChart) { growthChart.destroy(); growthChart = null; }
    });

    // ===================== TOPBAR =====================
    function updateTopbar(name) {
        const hr = new Date().getHours();
        const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
        const firstName = String(name).split(' ')[0];
        greetingEl.textContent = greet + ', ' + firstName + ' \uD83D\uDC4B';
        topbarDate.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const initials = String(name).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        userAvatar.textContent = initials;
    }

    // ===================== SIDEBAR OVERLAY =====================
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    });
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    });

    // ===================== TAB NAVIGATION =====================
    function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(t => {
            t.classList.add('hidden');
            t.classList.remove('active');
        });
        document.querySelectorAll('.nav-item, .mnav-item').forEach(n => n.classList.remove('active'));
        const target = document.getElementById('tab-' + tabName);
        if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
        document.querySelectorAll('[data-tab="' + tabName + '"]').forEach(n => n.classList.add('active'));
        if (tabName === 'growth' && currentAccount) renderGrowthChart();
        if (tabName === 'history' && currentAccount) renderHistory();
        if (tabName === 'forecast' && currentAccount) renderForecast();
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    }

    document.querySelectorAll('.nav-item, .mnav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            switchTab(item.dataset.tab);
        });
    });

    // ===================== INIT DASHBOARD =====================
    function initDashboard(account) {
        currentAccount = account;
        updateTopbar(account["Customer Name"]);
        renderOverview(account);
        switchTab('overview');
    }

    // ===================== OVERVIEW =====================
    function renderOverview(acc) {
        const inst    = parseFloat(acc.INSATLMENT_AMOUNT);
        const parts   = String(acc.PAID_INSATLMET).split('/');
        const paid    = parseInt(parts[0], 10);
        const total   = parseInt(parts[1], 10);
        const remaining = total - paid;
        const maturity  = calculateMaturity(inst, total, acc.START_DATE);
        const deposited = inst * paid;
        const interest  = maturity - (inst * total);
        const rate      = getRate(total, acc.START_DATE);

        document.getElementById('hc-maturity').textContent = fmt(maturity);
        document.getElementById('hc-maturity-date').textContent = 'Matures ' + getMaturityDateDisplay(acc, total);
        document.getElementById('hc-balance').textContent = fmt(acc["PAID AMOUNT"] || deposited);
        document.getElementById('hc-paid').textContent = paid + ' of ' + total + ' instalments paid';
        document.getElementById('hc-interest').textContent = fmt(Math.max(0, interest));
        document.getElementById('hc-rate').textContent = '@ ' + rate + '% p.a.';

        const pct = Math.round((paid / total) * 100);
        document.getElementById('progress-pct').textContent = pct + '%';
        document.getElementById('big-progress-fill').style.width = pct + '%';
        document.getElementById('pm-paid').textContent = paid + ' paid';
        document.getElementById('pm-remaining').textContent = remaining + ' remaining';

        // Instalment dots
        const grid = document.getElementById('instalment-grid');
        grid.innerHTML = '';
        for (let i = 1; i <= total; i++) {
            const dot = document.createElement('div');
            dot.className = 'inst-dot';
            if (i <= paid) dot.classList.add('paid');
            else if (i === paid + 1) dot.classList.add('current');
            dot.title = 'Instalment ' + i;
            grid.appendChild(dot);
        }

        document.getElementById('info-start').textContent      = formatDisplayDate(acc.START_DATE);
        document.getElementById('info-maturity').textContent   = getMaturityDateDisplay(acc, total);
        document.getElementById('info-instalment').textContent = fmt(inst);
        document.getElementById('info-rdnum').textContent     = acc["RD NUMBER"] || '-';
        document.getElementById('info-total-emi').textContent = total;

        const dueCard = document.getElementById('due-card');
        const dueVal  = document.getElementById('info-due');
        if (acc.DUE_STATUS > 0) {
            dueCard.className = 'info-card has-due';
            dueVal.textContent = acc.DUE_STATUS + ' due \u2022 ' + fmt(acc.DUE_AMOUNT || 0);
        } else {
            dueCard.className = 'info-card no-due';
            dueVal.textContent = 'No dues \u2713';
        }

        document.getElementById('remaining-click').onclick = () => {
            alert('You have ' + remaining + ' instalments remaining.\nEstimated remaining deposit: ' + fmt(remaining * inst));
        };
    }

    // ===================== GROWTH CHART =====================
    function renderGrowthChart() {
        if (!currentAccount) return;
        const acc   = currentAccount;
        const inst  = parseFloat(acc.INSATLMENT_AMOUNT);
        const parts = String(acc.PAID_INSATLMET).split('/');
        const total = parseInt(parts[1], 10);
        const paid  = parseInt(parts[0], 10);
        const maturity     = calculateMaturity(inst, total, acc.START_DATE);
        const totalDeposit = inst * total;
        const totalInterest = maturity - totalDeposit;

        const labels = [], depositData = [], maturityData = [];
        for (let m = 1; m <= total; m++) {
            labels.push(m % 6 === 0 || m === 1 || m === total ? 'M' + m : '');
            depositData.push(inst * m);
            maturityData.push(calculateMaturity(inst, m, acc.START_DATE));
        }

        document.getElementById('gs-deposited').textContent  = fmt(totalDeposit);
        document.getElementById('gs-interest').textContent   = fmt(Math.max(0, totalInterest));
        document.getElementById('gs-return').textContent     = getRate(total, acc.START_DATE) + '% p.a.';
        document.getElementById('gs-months-left').textContent = (total - paid).toString();

        if (growthChart) growthChart.destroy();

        const canvas = document.getElementById('growth-chart');
        if (!canvas) return;

        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
            script.onload = () => drawChart(canvas, labels, depositData, maturityData);
            document.head.appendChild(script);
        } else {
            drawChart(canvas, labels, depositData, maturityData);
        }
    }

    function drawChart(canvas, labels, depositData, maturityData) {
        const ctx = canvas.getContext('2d');
        growthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Deposited',
                        data: depositData,
                        borderColor: '#0099ff',
                        backgroundColor: 'rgba(0,153,255,0.06)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Maturity Value',
                        data: maturityData,
                        borderColor: '#00d4aa',
                        backgroundColor: 'rgba(0,212,170,0.08)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1c2438',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        titleColor: '#8892a4',
                        bodyColor: '#e8edf5',
                        callbacks: {
                            label: function(ctx) {
                                return ' ' + ctx.dataset.label + ': \u20B9' + ctx.raw.toLocaleString('en-IN');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#5a6478', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: {
                            color: '#5a6478', font: { size: 11 },
                            callback: function(v) {
                                return v >= 100000 ? '\u20B9' + (v/100000).toFixed(1) + 'L' : '\u20B9' + (v/1000).toFixed(0) + 'K';
                            }
                        }
                    }
                }
            }
        });
    }

    // ===================== HISTORY =====================
    function renderHistory(filter) {
        if (!currentAccount) return;
        filter = filter || '';
        const acc       = currentAccount;
        const dateParts = String(acc.START_DATE).includes('-') ? acc.START_DATE.split('-') : acc.START_DATE.split('/');
        const startDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, 1);
        const parts     = String(acc.PAID_INSATLMET).split('/');
        const paid      = parseInt(parts[0], 10);
        const inst      = parseFloat(acc.INSATLMENT_AMOUNT);

        const history = [];
        for (let i = 0; i < paid; i++) {
            const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            history.push({
                num: i + 1,
                month: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                amount: inst,
                balance: (i + 1) * inst
            });
        }

        const filtered = filter
            ? history.filter(h => h.month.toLowerCase().includes(filter.toLowerCase()))
            : history;

        document.getElementById('history-count').textContent = filtered.length + ' payments';
        const list = document.getElementById('history-list');
        if (!filtered.length) {
            list.innerHTML = '<li style="color:var(--text2);padding:16px;text-align:center">No results found.</li>';
            return;
        }
        list.innerHTML = filtered.slice().reverse().map(function(h, idx) {
            return '<li class="history-item" style="animation-delay:' + (idx * 0.03) + 's">' +
                '<div class="hi-left">' +
                    '<div class="hi-num">' + h.num + '</div>' +
                    '<div>' +
                        '<div class="hi-month">' + h.month + '</div>' +
                        '<div class="hi-amount">Balance: ' + fmt(h.balance) + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="hi-right" style="text-align:right">' +
                    '<div style="font-weight:600;color:var(--text);font-size:0.95rem">' + fmt(h.amount) + '</div>' +
                    '<span class="hi-badge">Paid</span>' +
                '</div>' +
            '</li>';
        }).join('');
    }

    document.getElementById('history-search').addEventListener('input', function(e) {
        renderHistory(e.target.value);
    });

    // ===================== FORECAST =====================
    function renderForecast() {
        if (!currentAccount) return;
        const acc       = currentAccount;
        const dateParts = String(acc.START_DATE).includes('-') ? acc.START_DATE.split('-') : acc.START_DATE.split('/');
        const startDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, 1);
        const parts     = String(acc.PAID_INSATLMET).split('/');
        const paid      = parseInt(parts[0], 10);
        const total     = parseInt(parts[1], 10);
        const inst      = parseFloat(acc.INSATLMENT_AMOUNT);

        document.getElementById('forecast-remaining-badge').textContent = (total - paid) + ' remaining';

        const tbody = document.getElementById('forecast-tbody');
        const rows  = [];
        for (let i = 0; i < total; i++) {
            const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            const monthStr   = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            const cumDeposit = inst * (i + 1);
            var status, statusClass, rowClass = '';
            if (i < paid) {
                status = 'Paid'; statusClass = 'status-pill status-paid';
            } else if (i === paid) {
                status = 'Current'; statusClass = 'status-pill status-current'; rowClass = 'current-row';
            } else {
                status = 'Upcoming'; statusClass = 'status-pill status-upcoming';
            }
            rows.push(
                '<tr class="' + rowClass + '">' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + monthStr + '</td>' +
                    '<td>' + fmt(inst) + '</td>' +
                    '<td>' + fmt(cumDeposit) + '</td>' +
                    '<td><span class="' + statusClass + '">' + status + '</span></td>' +
                '</tr>'
            );
        }
        tbody.innerHTML = rows.join('');

        setTimeout(function() {
            const cur = tbody.querySelector('.current-row');
            if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }

    // ===================== CALCULATOR =====================
    var calcTenure = 12;
    var goalTenure = 12;

    document.querySelectorAll('#tenure-pills .pill').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#tenure-pills .pill').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            calcTenure = parseInt(btn.dataset.months);
            setCalcRate(calcTenure);
            runCalc();
        });
    });

    document.querySelectorAll('#goal-tenure-pills .pill').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#goal-tenure-pills .pill').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            goalTenure = parseInt(btn.dataset.months);
            setGoalRate(goalTenure);
            runGoal();
        });
    });

    document.getElementById('calc-monthly').addEventListener('input', runCalc);
    document.getElementById('calc-rate').addEventListener('input', runCalc);
    document.getElementById('goal-target').addEventListener('input', runGoal);
    document.getElementById('goal-rate').addEventListener('input', runGoal);

    function runCalc() {
        const monthly = parseFloat(document.getElementById('calc-monthly').value);
        const rate    = parseFloat(document.getElementById('calc-rate').value);
        if (isNaN(monthly) || monthly <= 0 || isNaN(rate) || rate <= 0) return;
        const maturity  = calcMaturityGeneric(monthly, calcTenure, rate);
        const deposited = monthly * calcTenure;
        const interest  = maturity - deposited;
        document.getElementById('cr-monthly').textContent   = fmt(monthly);
        document.getElementById('cr-deposited').textContent = fmt(deposited);
        document.getElementById('cr-interest').textContent  = fmt(Math.max(0, interest));
        document.getElementById('cr-maturity').textContent  = fmt(maturity);
    }

    function runGoal() {
        const target = parseFloat(document.getElementById('goal-target').value);
        const rate   = parseFloat(document.getElementById('goal-rate').value);
        if (isNaN(target) || target <= 0 || isNaN(rate) || rate <= 0) return;
        const i      = rate / 1200;
        const n      = goalTenure;
        const factor = ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        const monthly = factor > 0 ? Math.ceil(target / factor) : 0;
        const total   = monthly * n;
        document.getElementById('gr-monthly').textContent  = fmt(monthly);
        document.getElementById('gr-total').textContent    = fmt(total);
        document.getElementById('gr-interest').textContent = fmt(Math.max(0, target - total));
    }

    // Initialise calculator rates from current period
    setCalcRate(calcTenure);
    setGoalRate(goalTenure);
    function getCurrentRate(months) {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        return getRate(months, dd + '-' + mm + '-' + yyyy);
    }

    function setCalcRate(months) {
        const r = getCurrentRate(months);
        document.getElementById('calc-rate').value = r;
    }
    function setGoalRate(months) {
        const r = getCurrentRate(months);
        document.getElementById('goal-rate').value = r;
    }

});
