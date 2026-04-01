document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const showPasswordCheckbox = document.getElementById('show-password');
    const errorMessage = document.getElementById('error-message');
    const loginContainer = document.getElementById('login-container');
    const passbookContainer = document.getElementById('passbook-container');
    const customerInfo = document.getElementById('customer-info');
    const accountSelectorContainer = document.getElementById('account-selector-container');
    const accountSelector = document.getElementById('account-selector');
    const passbookContent = document.getElementById('passbook-content');
    const logoutBtn = document.getElementById('logout-btn');

    const paidEmiLabel = document.getElementById('paid-emi-label');
    const remainingEmiLabel = document.getElementById('remaining-emi-label');
    const paidEmiBar = document.getElementById('paid-emi-bar');
    const remainingEmiBar = document.getElementById('remaining-emi-bar');
    const paidEmiCount = document.getElementById('paid-emi-count');
    const remainingEmiCount = document.getElementById('remaining-emi-count');

    const modal = document.getElementById('emi-history-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const emiList = document.getElementById('emi-list');

    modal.classList.add('hidden');

    const CSV_URL = 'https://docs.google.com/spreadsheets/d/18K6X1q30z7zvi6zrOrrSWZSJpPULhP4INiMnknyVC9A/export?format=csv&gid=643936536';

    let allAccounts = [];
    let currentAccounts = [];
    let currentRDNumber = null;

    function cleanString(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/\s/g, '').trim(); 
    }

    function generatePassword(name, mobile) {
        const cleanName = cleanString(name).slice(0, 4).toLowerCase();
        const cleanMobile = cleanString(mobile).slice(-4);
        return cleanName + cleanMobile;
    }

    // HELPER: Convert DD-MM-YYYY string to a numeric timestamp for safe comparison
    function parseDateToTimestamp(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return 0;
        // Split by '-' or '/'
        const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
        if (parts.length !== 3) return 0;
        
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed
        const year = parseInt(parts[2], 10);
        
        return new Date(year, month, day).getTime();
    }

    async function fetchCSVData() {
        try {
            const response = await fetch(CSV_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            allAccounts = parseCSV(csvText);
        } catch (error) {
            console.error('Error fetching CSV data:', error);
            errorMessage.textContent = 'Failed to load data. Please try again later.';
        }
    }

    function parseCSV(csv) {
        const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(header => header.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = [];
            let inQuote = false;
            let start = 0;

            for (let j = 0; j < lines[i].length; j++) {
                if (lines[i][j] === '"') inQuote = !inQuote;
                else if (lines[i][j] === ',' && !inQuote) {
                    values.push(lines[i].substring(start, j));
                    start = j + 1;
                }
            }
            values.push(lines[i].substring(start));

            if (values.length === headers.length) {
                const obj = {};
                for (let j = 0; j < headers.length; j++) {
                    const header = headers[j];
                    const value = values[j].replace(/^"|"$/g, '').trim();
                    const numValue = parseFloat(value);
                    obj[header] = isNaN(numValue) ? value : numValue;
                }
                obj['START_DATE'] = cleanString(values[4]);
                obj['PAID_INSATLMET'] = cleanString(values[6]);
                const instalmentAmountRaw = String(values[5]).replace(/[^0-9.]/g, '');
                obj['INSATLMENT_AMOUNT'] = parseFloat(instalmentAmountRaw) || 0;
                data.push(obj);
            }
        }
        return data;
    }

    fetchCSVData();

    showPasswordCheckbox.addEventListener('change', () => {
        passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPassword = passwordInput.value.trim().toLowerCase();
        const accounts = allAccounts.filter(account => {
            const generatedPassword = generatePassword(
                String(account["Customer Name"]), 
                String(account["Customer Mobile number"])
            );
            return generatedPassword === enteredPassword;
        });

        if (accounts.length > 0) {
            currentAccounts = accounts;
            errorMessage.textContent = '';
            loginContainer.classList.add('hidden');
            passbookContainer.classList.remove('hidden');
            displayCustomerInfo(accounts[0]["Customer Name"]);
            if (accounts.length > 1) populateAccountSelector(accounts);
            else {
                accountSelectorContainer.classList.add('hidden');
                displayAccountDetails(accounts[0]);
            }
        } else {
            errorMessage.textContent = 'Invalid password. Please try again.';
        }
    });

    accountSelector.addEventListener('change', (e) => {
        const selectedRdNumber = e.target.value;
        const account = currentAccounts.find(acc => acc["RD NUMBER"] === selectedRdNumber);
        if (account) displayAccountDetails(account);
    });

    paidEmiLabel.addEventListener('click', () => {
        if (currentRDNumber) {
            const account = currentAccounts.find(acc => acc["RD NUMBER"] === currentRDNumber);
            if (account) {
                const history = generateDummyPaymentHistory(account);
                populateEmiHistory(history);
                modal.classList.remove('hidden');
            }
        }
    });

    remainingEmiLabel.addEventListener('click', () => {
        const account = currentAccounts.find(acc => acc["RD NUMBER"] === currentRDNumber);
        if (account) {
            const parts = String(account.PAID_INSATLMET).split('/');
            const remainingEmi = parseInt(parts[1], 10) - parseInt(parts[0], 10);
            alert(`You have ${remainingEmi} remaining EMIs to pay.`);
        }
    });

    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

    logoutBtn.addEventListener('click', () => {
        passbookContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
        passwordInput.value = '';
        modal.classList.add('hidden');
    });

    function displayCustomerInfo(customerName) {
        customerInfo.innerHTML = `<h3>Hello, ${customerName} 👋</h3>`;
    }

    function populateAccountSelector(accounts) {
        accountSelectorContainer.classList.remove('hidden');
        accountSelector.innerHTML = '';
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account["RD NUMBER"];
            option.textContent = account["RD NUMBER"];
            accountSelector.appendChild(option);
        });
        displayAccountDetails(accounts[0]);
    }

/**
 * UPDATED MATURITY CALCULATION
 * Matches Excel Formula: inst_amt * (((1 + i)^n - 1) / (1 - (1 + i)^(-1)))
 * Results: 4000 @ 12% for 36 months = 1,74,031
 */
function calculateMaturity(principalAmount, totalMonths, startDateStr) {
    if (isNaN(principalAmount) || isNaN(totalMonths) || totalMonths <= 0 || !startDateStr) return 0;
    
    const accountStartTimestamp = parseDateToTimestamp(startDateStr);
    
    // Define Boundaries
    const nov3_2025  = new Date(2025, 10,  3).getTime();
    const dec22_2025 = new Date(2025, 11, 22).getTime();
    const jan1_2026  = new Date(2026,  0,  1).getTime();
    const apr1_2026  = new Date(2026,  3,  1).getTime();

    const years = totalMonths / 12;
    let annualRatePercentage;

    // 1. Before Nov 3, 2025
    if (accountStartTimestamp < nov3_2025) {
        annualRatePercentage = 12.12;
    }
    // 2. Nov 3, 2025 – Dec 21, 2025
    else if (accountStartTimestamp < dec22_2025) {
        if (years >= 1 && years < 3)      annualRatePercentage = 10.00;
        else if (years >= 3 && years <= 5) annualRatePercentage = 12.00;
        else                               annualRatePercentage = 12.12;
    }
    // 3. Dec 22, 2025 – Dec 31, 2025
    else if (accountStartTimestamp < jan1_2026) {
        if (years >= 1 && years < 3)      annualRatePercentage = 10.00;
        else if (years >= 3 && years <= 5) annualRatePercentage = 11.50;
        else                               annualRatePercentage = 10.00;
    }
    // 4. Jan 1, 2026 – Mar 31, 2026
    else if (accountStartTimestamp < apr1_2026) {
        annualRatePercentage = 10.00;
    }
    // 5. Apr 1, 2026 onwards
    else {
        if (years === 1)                   annualRatePercentage = 10.00;
        else if (years === 2)              annualRatePercentage = 11.00;
        else if (years >= 3 && years <= 5) annualRatePercentage = 12.00;
        else                               annualRatePercentage = 10.00;
    }

    // Standard Banking Formula
    const i = annualRatePercentage / 1200;
    const n = totalMonths;
    const maturityAmount = principalAmount * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    
    return Math.round(maturityAmount);
}
    function displayAccountDetails(account) {
        passbookContent.classList.remove('hidden');
        currentRDNumber = account["RD NUMBER"];

        document.getElementById('rd-number').textContent = account["RD NUMBER"];
        document.getElementById('start-date').textContent = account.START_DATE || 'N/A';
        document.getElementById('maturity-date').textContent = account.MATURITY_DATE || 'N/A';
        
        const instalmentAmount = parseFloat(account.INSATLMENT_AMOUNT);
        document.getElementById('instalment-amount').textContent = `₹${instalmentAmount.toLocaleString('en-IN')}`;

        const parts = String(account.PAID_INSATLMET).split('/');
        const paidEmi = parseInt(parts[0], 10);
        const totalEmi = parseInt(parts[1], 10);

        paidEmiCount.textContent = paidEmi;
        remainingEmiCount.textContent = totalEmi - paidEmi;
        paidEmiBar.style.width = `${(paidEmi / totalEmi) * 100}%`;
        
        document.getElementById('total-emi').textContent = totalEmi;
        document.getElementById('rd-balance').textContent = `₹${(account["PAID AMOUNT"] || 0).toLocaleString('en-IN')}`;

        const dueStatus = document.getElementById('due-status');
        const dueAmount = document.getElementById('due-amount');
        if (account.DUE_STATUS > 0) {
            dueStatus.textContent = account.DUE_STATUS;
            dueStatus.className = 'value has-due';
            dueAmount.textContent = `₹${(account.DUE_AMOUNT || 0).toLocaleString('en-IN')}`;
        } else {
            dueStatus.textContent = '0';
            dueStatus.className = 'value no-due';
            dueAmount.textContent = 'N/A';
        }

        const maturityVal = calculateMaturity(instalmentAmount, totalEmi, account.START_DATE);
        document.getElementById('maturity-amount').textContent = `₹${maturityVal.toLocaleString('en-IN')}`;
    }

    function generateDummyPaymentHistory(account) {
        const history = [];
        const dateParts = String(account.START_DATE).includes('-') ? 
                          String(account.START_DATE).split('-') : 
                          String(account.START_DATE).split('/');
                          
        const startDate = new Date(dateParts[2], dateParts[1] - 1, 1);
        const paidInstallments = parseInt(String(account.PAID_INSATLMET).split('/')[0], 10);
        const instalmentAmount = parseFloat(account.INSATLMENT_AMOUNT);
        
        for (let i = 0; i < paidInstallments; i++) {
            const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
            history.push({ 
                month: paymentDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' }), 
                amount: instalmentAmount, 
                balance: (i + 1) * instalmentAmount 
            });
        }
        return history;
    }

    function populateEmiHistory(history) {
        emiList.innerHTML = history.map(item => `
            <li>
                <span>${item.month} - ₹${item.amount.toLocaleString('en-IN')}</span>
                <span class="emi-detail-balance">Balance: ₹${item.balance.toLocaleString('en-IN')}</span>
            </li>
        `).join('') || '<li>No payment history available.</li>';
    }
});


