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
const paidEmiLink = document.getElementById('paid-emi');

const modal = document.getElementById('emi-history-modal');
const closeModalBtn = document.querySelector('.close-btn');
const emiList = document.getElementById('emi-list');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxcZ5BVpz-jvCQze4msaEqv1uSUTS-Z-mulCPYUU9xvh0_8R4aDoMmOIMclJQbIeeVWAtA9qkyJ8Vv/pub?gid=643936536&single=true&output=csv';

let allAccounts = [];
let currentAccounts = [];
let currentRDNumber = null;

// Function to perform aggressive data cleaning on a string
function cleanString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/\s/g, '').trim(); 
}

// Function to generate the password from name and mobile number
function generatePassword(name, mobile) {
    const cleanName = cleanString(name).slice(0, 4).toLowerCase();
    const cleanMobile = cleanString(mobile).slice(-4);
    return cleanName + cleanMobile;
}

// Function to fetch and parse the CSV data
async function fetchCSVData() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        allAccounts = parseCSV(csvText);
        console.log("Data loaded successfully:", allAccounts.length, "records");
    } catch (error) {
        console.error('Error fetching CSV data:', error);
        errorMessage.textContent = 'Failed to load data. Please try again later.';
    }
}

// =======================================================
// Final, robust CSV parser to handle all data issues
// =======================================================
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
            if (lines[i][j] === '"') {
                inQuote = !inQuote;
            } else if (lines[i][j] === ',' && !inQuote) {
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

            // Manually map fields to column indexes to bypass header issues
            obj['START_DATE'] = cleanString(values[4]); // Column E
            obj['MATURITY_DATE'] = cleanString(values[12]); // Column M
            // FIX: Due Status is now a number based on your feedback
            const dueStatusValue = parseFloat(values[9]); // Column J
            obj['DUE_STATUS'] = isNaN(dueStatusValue) ? 0 : dueStatusValue;
            // FIX: Due Amount is now a number based on your feedback
            const dueAmountValue = parseFloat(values[10]); // Column K
            obj['DUE_AMOUNT'] = isNaN(dueAmountValue) ? 0 : dueAmountValue;

            obj['PAID_INSATLMET'] = cleanString(values[6]); // Column G
            
            // FIX: More robust cleaning for Instalment Amount
            const instalmentAmountRaw = values[5].replace(/[^0-9.]/g, ''); // Remove all characters except numbers and decimal point
            const instalmentAmountValue = parseFloat(instalmentAmountRaw);
            obj['INSATLMENT_AMOUNT'] = isNaN(instalmentAmountValue) ? 0 : instalmentAmountValue;

            data.push(obj);
        }
    }
    return data;
}

// Initial data fetch when the page loads
fetchCSVData();

// Toggle password visibility
showPasswordCheckbox.addEventListener('change', () => {
    if (showPasswordCheckbox.checked) {
        passwordInput.type = 'text';
    } else {
        passwordInput.type = 'password';
    }
});

// New login logic using only the generated password
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPassword = passwordInput.value.trim().toLowerCase();
    
    console.log(`Attempting login with password: ${enteredPassword}`);

    const accounts = allAccounts.filter(account => {
        const generatedPassword = generatePassword(
            String(account["Customer Name"]), 
            String(account["Customer Mobile number"])
        );
        
        return generatedPassword === enteredPassword;
    });

    console.log("Found matching accounts:", accounts);

    if (accounts.length > 0) {
        currentAccounts = accounts;
        errorMessage.textContent = '';
        loginContainer.classList.add('hidden');
        passbookContainer.classList.remove('hidden');
        displayCustomerInfo(accounts[0]["Customer Name"]);
        
        if (accounts.length > 1) {
            populateAccountSelector(accounts);
        } else {
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
    if (account) {
        displayAccountDetails(account);
    }
});

// Event listener for EMI history link
paidEmiLink.addEventListener('click', () => {
    if (currentRDNumber) {
        const account = currentAccounts.find(acc => acc["RD NUMBER"] === currentRDNumber);
        if (account) {
            const history = generateDummyPaymentHistory(account);
            populateEmiHistory(history);
            modal.classList.remove('hidden');
        }
    }
});

// Close modal
closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

logoutBtn.addEventListener('click', () => {
    passbookContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
    passwordInput.value = '';
    currentAccounts = [];
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
        }
    );
    displayAccountDetails(accounts[0]);
}

// =======================================================
// NEW: Maturity Calculation Function
// =======================================================
function calculateMaturity(principalAmount, totalMonths) {
    const annualRatePercentage = 12.12;
    
    // Check for valid inputs
    if (isNaN(principalAmount) || isNaN(totalMonths) || totalMonths <= 0) {
        return 'N/A';
    }

    const years = totalMonths / 12;

    // Calculate r = (I3 / 400)
    const r = annualRatePercentage / 400;

    // Calculate n_quarters = (B3 * 12) / 3
    const n_quarters = (years * 12) / 3;

    // Implement the main maturity formula
    const numerator = Math.pow((1 + r), n_quarters) - 1;
    const denominator = 1 - Math.pow((1 + r), -1/3);

    let maturityAmount = 0;
    if (denominator !== 0) { // Avoid division by zero
        maturityAmount = principalAmount * (numerator / denominator);
    } else {
        return 'N/A';
    }

    return Math.round(maturityAmount);
}

// =======================================================
// Final, robust passbook display to handle all data issues
// =======================================================
function displayAccountDetails(account) {
    passbookContent.classList.remove('hidden');
    currentRDNumber = account["RD NUMBER"];

    // Displaying data using the new index-based fields
    document.getElementById('rd-number').textContent = account["RD NUMBER"];
    document.getElementById('start-date').textContent = account.START_DATE || 'N/A';
    document.getElementById('maturity-date').textContent = account.MATURITY_DATE || 'N/A';
    
    // Check for NaN on instalment amount
    const instalmentAmount = parseFloat(account.INSATLMENT_AMOUNT);
    if (!isNaN(instalmentAmount)) {
        document.getElementById('instalment-amount').textContent = `₹${instalmentAmount.toLocaleString('en-IN')}`;
    } else {
        document.getElementById('instalment-amount').textContent = 'N/A';
    }

    const paidInstallmentString = String(account.PAID_INSATLMET);
    const parts = paidInstallmentString.split('/');
    const paidEmi = parseInt(parts[0], 10);
    const totalEmi = parseInt(parts[1], 10);
    const remainingEmi = totalEmi - paidEmi;

    document.getElementById('paid-emi').textContent = isNaN(paidEmi) ? 'N/A' : paidEmi;
    document.getElementById('total-emi').textContent = isNaN(totalEmi) ? 'N/A' : totalEmi;
    document.getElementById('remaining-emi').textContent = (isNaN(remainingEmi) || remainingEmi < 0) ? 'N/A' : remainingEmi;
    
    document.getElementById('rd-balance').textContent = `₹${account["PAID AMOUNT"].toLocaleString('en-IN')}`;

    const dueStatusBox = document.getElementById('due-status-box');
    const dueAmountBox = document.getElementById('due-amount-box');
    const dueStatus = document.getElementById('due-status');
    const dueAmount = document.getElementById('due-amount');

    // FIX: Check if DUE_STATUS (from column J) is a number > 0
    if (account.DUE_STATUS > 0) {
        dueStatus.textContent = account.DUE_STATUS;
        dueStatus.classList.remove('no-due');
        dueStatus.classList.add('has-due');
        
        const dueAmountValue = account.DUE_AMOUNT;
        if (dueAmountValue > 0) {
             dueAmount.textContent = `₹${dueAmountValue.toLocaleString('en-IN')}`;
             dueAmountBox.classList.remove('hidden');
        } else {
             dueAmount.textContent = 'N/A';
             dueAmountBox.classList.remove('hidden');
        }
    } else {
        dueStatus.textContent = '0';
        dueStatus.classList.remove('has-due');
        dueStatus.classList.add('no-due');
        dueAmountBox.classList.add('hidden');
    }

    // Call the new maturity calculation function
    const maturityAmount = calculateMaturity(instalmentAmount, totalEmi);
    const maturityAmountElement = document.getElementById('maturity-amount');
    if (maturityAmount !== 'N/A') {
        maturityAmountElement.textContent = `₹${maturityAmount.toLocaleString('en-IN')}`;
    } else {
        maturityAmountElement.textContent = 'N/A';
    }
}

function generateDummyPaymentHistory(account) {
    const history = [];
    const startDate = new Date(String(account.START_DATE).split('-').reverse().join('-'));
    let balance = 0;
    
    const paidInstallmentString = String(account.PAID_INSATLMET);
    const parts = paidInstallmentString.split('/');
    const paidInstallments = parseInt(parts[0], 10);
    
    const instalmentAmount = parseFloat(account.INSATLMENT_AMOUNT);

    for (let i = 0; i < paidInstallments; i++) {
        const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const monthYear = paymentDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        balance += instalmentAmount;
        history.push({
            month: monthYear,
            amount: instalmentAmount,
            balance: balance
        });
    }
    return history;
}

function populateEmiHistory(history) {
    emiList.innerHTML = '';
    if (history && history.length > 0) {
        history.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.month} - ₹${item.amount.toLocaleString('en-IN')}</span>
                <span class="emi-detail-balance">Balance: ₹${item.balance.toLocaleString('en-IN')}</span>
            `;
            emiList.appendChild(li);
        });
    } else {
        emiList.innerHTML = '<li>No payment history available.</li>';
    }
}