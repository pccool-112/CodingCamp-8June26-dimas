/* ============================================================
   CONSTANTS
   ============================================================ */

/** Default expense categories (never written to localStorage). */
const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Utilities',
  'Education',
  'Other',
];

/** localStorage key names — all prefixed with "ebv_" to avoid collisions. */
const KEYS = {
  BUDGET:     'ebv_budget',
  EXPENSES:   'ebv_expenses',
  CATEGORIES: 'ebv_categories',
  SORT_ORDER: 'ebv_sort_order',
  THEME:      'ebv_theme',
};

/** Validation limits. */
const MAX_AMOUNT  = 999_999_999.99; // maximum allowed amount for budget and expenses
const MAX_DESC_LEN = 255;            // maximum description length in characters
const MAX_CAT_LEN  = 50;             // maximum custom category name length in characters

/* ============================================================
   STATE
   ============================================================ */

/**
 * In-memory application state singleton.
 * All fields are hydrated from localStorage by loadState() on startup.
 *
 * @type {{
 *   budget:     number,
 *   expenses:   Array<{id: string, amount: number, category: string, date: string, description: string}>,
 *   categories: string[],
 *   sortOrder:  'amount-desc'|'amount-asc'|'category-az',
 *   theme:      'light'|'dark'
 * }}
 */
const AppState = {
  /** Monthly spending cap. 0 when not yet set. */
  budget: 0,

  /** All recorded expense transactions. Insertion-ordered; sort applied at render time. */
  expenses: [],

  /** User-defined custom categories only (default categories are never stored here). */
  categories: [],

  /** Active sort criterion for the Transaction List. */
  sortOrder: 'amount-desc',

  /** Current visual theme. Applied as data-theme attribute on <html>. */
  theme: 'light',
};

/* ============================================================
   STORAGE
   ============================================================ */

/**
 * Safely reads and JSON-parses a value from localStorage.
 *
 * - Returns `fallback` when the key is absent (localStorage returns null).
 * - Returns the parsed value when the key is present and valid JSON.
 * - Returns `null` (not the fallback) when JSON.parse throws — the caller
 *   must treat null as a corruption signal distinct from a missing key.
 *
 * @param {string} key      - The localStorage key to read.
 * @param {*}      fallback - Value to return when the key does not exist.
 * @returns {*} Parsed value, `fallback` (key missing), or `null` (parse error / access error).
 */
function safeGetItem(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback; // key does not exist — not corruption
    }
    return JSON.parse(raw);
  } catch {
    // JSON.parse failure or localStorage access denied → signal corruption
    return null;
  }
}

/**
 * Safely JSON-serialises and writes a value to localStorage.
 *
 * @param {string} key   - The localStorage key to write.
 * @param {*}      value - Any JSON-serialisable value.
 * @returns {boolean} `true` on success; `false` on any error (quota exceeded, access denied, etc.).
 */
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // caller should show "Storage full" banner
  }
}

/**
 * Hydrates `AppState` from localStorage.
 *
 * Each field uses `safeGetItem` with its typed default as the fallback.
 * If `safeGetItem` returns `null` for any key (indicating corrupt JSON),
 * that field is left at its current default and the `corrupted` flag is
 * set to `true`.  The caller (INIT) uses this flag to show an error
 * banner and disable the expense form (Requirements 5.5, 1.6).
 *
 * @returns {{ corrupted: boolean }} Object indicating whether any
 *   stored value was unreadable due to corruption.
 */
function loadState() {
  let corrupted = false;

  // --- budget (number, default 0) ---
  const budget = safeGetItem(KEYS.BUDGET, 0);
  if (budget === null) {
    corrupted = true;
  } else {
    AppState.budget = budget;
  }

  // --- expenses (Expense[], default []) ---
  const expenses = safeGetItem(KEYS.EXPENSES, []);
  if (expenses === null) {
    corrupted = true;
  } else {
    AppState.expenses = expenses;
  }

  // --- categories (string[], default []) ---
  const categories = safeGetItem(KEYS.CATEGORIES, []);
  if (categories === null) {
    corrupted = true;
  } else {
    AppState.categories = categories;
  }

  // --- sortOrder (string, default 'amount-desc') ---
  const sortOrder = safeGetItem(KEYS.SORT_ORDER, 'amount-desc');
  if (sortOrder === null) {
    corrupted = true;
  } else {
    AppState.sortOrder = sortOrder;
  }

  // --- theme (string, default 'light') ---
  const theme = safeGetItem(KEYS.THEME, 'light');
  if (theme === null) {
    corrupted = true;
  } else {
    AppState.theme = theme;
  }

  return { corrupted };
}

/**
 * Persists all `AppState` fields to localStorage.
 *
 * Uses `safeSetItem` for each key so that a quota-exceeded error on one
 * field does not prevent the remaining fields from being saved.  Returns
 * `true` only when every write succeeded; returns `false` if any write
 * failed so the caller can surface a "Storage full" banner.
 *
 * @returns {boolean} `true` if all fields were saved; `false` if any write failed.
 */
function saveState() {
  const results = [
    safeSetItem(KEYS.BUDGET,     AppState.budget),
    safeSetItem(KEYS.EXPENSES,   AppState.expenses),
    safeSetItem(KEYS.CATEGORIES, AppState.categories),
    safeSetItem(KEYS.SORT_ORDER, AppState.sortOrder),
    safeSetItem(KEYS.THEME,      AppState.theme),
  ];
  return results.every(Boolean);
}

/* ============================================================
   VALIDATION
   ============================================================ */

/**
 * Validates the raw budget string from the budget input field.
 *
 * Rules (applied in order):
 *  1. Value must not be empty or whitespace-only.
 *  2. Value must be numeric (parseFloat must not return NaN).
 *  3. Numeric value must be > 0.
 *  4. Numeric value must be ≤ MAX_AMOUNT (999,999,999.99).
 *
 * @param {string} value - Raw string from the budget input field.
 * @returns {{ valid: boolean, errors: { budget?: string } }}
 */
function validateBudget(value) {
  const errors = {};

  // Rule 1: reject empty / whitespace-only
  if (typeof value !== 'string' || value.trim() === '') {
    errors.budget = 'Budget is required.';
    return { valid: false, errors };
  }

  const trimmed = value.trim();

  // Rule 2: reject non-numeric
  const numeric = Number(trimmed);
  if (isNaN(numeric)) {
    errors.budget = 'Budget must be a valid number.';
    return { valid: false, errors };
  }

  // Rule 3: reject zero and negative
  if (numeric <= 0) {
    errors.budget = 'Budget must be greater than zero.';
    return { valid: false, errors };
  }

  // Rule 4: reject above MAX_AMOUNT
  if (numeric > MAX_AMOUNT) {
    errors.budget = `Budget must not exceed ${MAX_AMOUNT.toLocaleString()}.`;
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

/**
 * Validates an expense object before it is added to the Transaction List.
 *
 * All field errors are accumulated — validation does not short-circuit on
 * the first failure.  The caller receives a single pass/fail result along
 * with per-field error messages.
 *
 * Rules:
 *  amount
 *    1. Must be provided and numeric (not empty, not NaN).
 *    2. Must be > 0.
 *    3. Must be ≤ MAX_AMOUNT (999,999,999.99).
 *    4. Must have at most 2 decimal places.
 *  category
 *    5. Must be a non-empty string.
 *    6. Must exist in the `knownCategories` array (case-sensitive match).
 *  date
 *    7. Must be a non-empty string.
 *    8. Must not represent a date in the future relative to local midnight today.
 *  description
 *    9. Must not exceed MAX_DESC_LEN (255) characters; empty is allowed.
 *
 * @param {{ amount: *, category: string, date: string, description: string }} fields
 * @param {string[]} [knownCategories=[]] - Full list of valid categories
 *   (caller should pass DEFAULT_CATEGORIES.concat(AppState.categories)).
 * @returns {{ valid: boolean, errors: { amount?: string, category?: string, date?: string, description?: string } }}
 */
function validateExpense({ amount, category, date, description }, knownCategories = []) {
  const errors = {};

  // ── Amount ──────────────────────────────────────────────────────────────────

  // Rule 1: must be present and numeric
  const amountStr = (amount === undefined || amount === null) ? '' : String(amount).trim();
  if (amountStr === '') {
    errors.amount = 'Amount is required.';
  } else {
    const numeric = Number(amountStr);
    if (isNaN(numeric)) {
      errors.amount = 'Amount must be a valid number.';
    } else {
      // Rule 2: must be positive
      if (numeric <= 0) {
        errors.amount = 'Amount must be greater than zero.';
      } else if (numeric > MAX_AMOUNT) {
        // Rule 3: must not exceed MAX_AMOUNT
        errors.amount = `Amount must not exceed ${MAX_AMOUNT.toLocaleString()}.`;
      } else {
        // Rule 4: at most 2 decimal places
        const dotIndex = amountStr.indexOf('.');
        if (dotIndex !== -1 && amountStr.length - dotIndex - 1 > 2) {
          errors.amount = 'Amount must not have more than 2 decimal places.';
        }
      }
    }
  }

  // ── Category ─────────────────────────────────────────────────────────────────

  // Rule 5: non-empty string
  if (typeof category !== 'string' || category.trim() === '') {
    errors.category = 'Please select a category.';
  } else if (!knownCategories.includes(category)) {
    // Rule 6: must be one of the known categories
    errors.category = 'Selected category is not valid.';
  }

  // ── Date ──────────────────────────────────────────────────────────────────────

  // Rule 7: must be provided
  if (typeof date !== 'string' || date.trim() === '') {
    errors.date = 'Date is required.';
  } else {
    // Rule 8: must not be a future date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDate = new Date(date.trim() + 'T00:00:00');
    if (isNaN(inputDate.getTime())) {
      errors.date = 'Date is not a valid date.';
    } else if (inputDate > today) {
      errors.date = 'Date must not be in the future.';
    }
  }

  // ── Description ──────────────────────────────────────────────────────────────

  // Rule 9: empty is fine; only reject if exceeds MAX_DESC_LEN
  const desc = typeof description === 'string' ? description : '';
  if (desc.length > MAX_DESC_LEN) {
    errors.description = `Description must not exceed ${MAX_DESC_LEN} characters.`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validates a custom category name against the full known category set.
 *
 * Rules (applied in order):
 *  1. Name must not be empty or whitespace-only (Requirement 5.6).
 *  2. Trimmed name must not exceed MAX_CAT_LEN (50) characters (Requirement 5.1).
 *  3. Trimmed name must not be a case-insensitive duplicate of any name in
 *     DEFAULT_CATEGORIES ∪ existingCategories (Requirement 5.7).
 *
 * @param {string}   name               - Raw string from the category name input.
 * @param {string[]} existingCategories - Array of custom categories already stored in AppState.
 * @returns {{ valid: boolean, errors: { category?: string } }}
 */
function validateCategory(name, existingCategories) {
  const errors = {};

  // Rule 1: reject empty / whitespace-only
  if (typeof name !== 'string' || name.trim() === '') {
    errors.category = 'Category name is required.';
    return { valid: false, errors };
  }

  const trimmed = name.trim();

  // Rule 2: reject names exceeding the maximum length
  if (trimmed.length > MAX_CAT_LEN) {
    errors.category = `Category name must not exceed ${MAX_CAT_LEN} characters.`;
    return { valid: false, errors };
  }

  // Rule 3: reject case-insensitive duplicates against DEFAULT_CATEGORIES ∪ existingCategories
  const normalised = trimmed.toLowerCase();
  const allCategories = [
    ...DEFAULT_CATEGORIES,
    ...(Array.isArray(existingCategories) ? existingCategories : []),
  ];
  const isDuplicate = allCategories.some(c => c.toLowerCase() === normalised);

  if (isDuplicate) {
    errors.category = 'A category with this name already exists.';
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

/* ============================================================
   COMPUTED VALUES
   ============================================================ */

/**
 * Computes the remaining balance: budget minus the sum of all expense amounts.
 *
 * @param {number}   budget   - The current monthly budget (non-negative number).
 * @param {Array<{amount: number}>} expenses - Array of expense objects.
 * @returns {number} The balance rounded to at most 2 decimal places.
 */
function computeBalance(budget, expenses) {
  const sum = expenses.reduce((acc, expense) => acc + expense.amount, 0);
  return Math.round((budget - sum) * 100) / 100;
}

/**
 * Aggregates expense amounts by category.
 *
 * @param {Array<{category: string, amount: number}>} expenses
 * @returns {Map<string, number>} Map from category name to total amount (> 0 only).
 */
function aggregateByCategory(expenses) {
  const totals = new Map();

  for (const expense of expenses) {
    const current = totals.get(expense.category) ?? 0;
    totals.set(expense.category, current + expense.amount);
  }

  for (const [category, total] of totals) {
    if (total <= 0) {
      totals.delete(category);
    }
  }

  return totals;
}

/**
 * Returns a new sorted copy of the expenses array according to `sortOrder`.
 *
 * @param {Array<{amount: number, category: string, date: string}>} expenses
 * @param {'amount-desc'|'amount-asc'|'category-az'} sortOrder
 * @returns {Array} New sorted array.
 */
function sortExpenses(expenses, sortOrder) {
  const copy = [...expenses];

  copy.sort((a, b) => {
    switch (sortOrder) {
      case 'amount-asc': {
        const diff = a.amount - b.amount;
        if (diff !== 0) return diff;
        return new Date(b.date) - new Date(a.date);
      }

      case 'category-az': {
        const catA = a.category.toLowerCase();
        const catB = b.category.toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        return new Date(b.date) - new Date(a.date);
      }

      case 'amount-desc':
      default: {
        const diff = b.amount - a.amount;
        if (diff !== 0) return diff;
        return new Date(b.date) - new Date(a.date);
      }
    }
  });

  return copy;
}

/* ============================================================
   STATE MUTATIONS
   ============================================================ */

/**
 * Adds a new expense to AppState and persists to localStorage.
 * @param {{ id: string, amount: number, category: string, date: string, description: string }} expense
 */
function addExpense(expense) {
  AppState.expenses.push(expense);
  saveState();
}

/**
 * Removes an expense by id from AppState and persists to localStorage.
 * If the save fails, the expense is re-inserted at its original position.
 *
 * @param {string} id - The expense id to remove.
 * @returns {boolean} `true` on success; `false` if localStorage write failed.
 */
function deleteExpenseById(id) {
  const index = AppState.expenses.findIndex(e => e.id === id);
  if (index === -1) return false;

  const [removed] = AppState.expenses.splice(index, 1);
  const ok = saveState();

  if (!ok) {
    // Restore at original position on storage failure
    AppState.expenses.splice(index, 0, removed);
    return false;
  }

  return true;
}

/**
 * Sets the monthly budget in AppState and persists.
 * @param {number} value
 */
function setBudget(value) {
  AppState.budget = value;
  saveState();
}

/**
 * Adds a custom category to AppState and persists.
 * @param {string} name
 */
function addCategory(name) {
  AppState.categories.push(name.trim());
  saveState();
}

/**
 * Sets the active sort order in AppState and persists.
 * @param {'amount-desc'|'amount-asc'|'category-az'} order
 */
function setSortOrder(order) {
  AppState.sortOrder = order;
  saveState();
}

/**
 * Sets the active theme in AppState and persists.
 * Only called when the user has explicitly toggled the theme this session.
 * @param {'light'|'dark'} theme
 */
function setTheme(theme) {
  AppState.theme = theme;
  saveState();
}

/* ============================================================
   RENDER HELPERS
   ============================================================ */

/**
 * Displays an error message in an <output> element.
 * @param {string} outputId - The id of the <output> element.
 * @param {string} message  - The error message to display.
 */
function showError(outputId, message) {
  const el = document.getElementById(outputId);
  if (el) {
    el.textContent = message;
    el.classList.add('error-visible');
  }
}

/**
 * Clears error messages from one or more <output> elements.
 * @param {...string} outputIds - The ids of <output> elements to clear.
 */
function clearErrors(...outputIds) {
  for (const id of outputIds) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.classList.remove('error-visible');
    }
  }
}

/* ============================================================
   RENDER MODULE
   ============================================================ */

/**
 * Renders the budget amount and balance to the DOM.
 * Applies colour classes based on balance sign (Requirement 1.8).
 * @param {typeof AppState} state
 */
function renderSummary(state) {
  const balanceEl = document.getElementById('balance-amount');
  if (!balanceEl) return;

  const balance = computeBalance(state.budget, state.expenses);
  balanceEl.textContent = formatCurrency(balance);

  balanceEl.classList.remove('balance-positive', 'balance-negative');
  if (balance > 0) {
    balanceEl.classList.add('balance-positive');
  } else {
    balanceEl.classList.add('balance-negative');
  }

  // Also update any displayed budget value if present
  const budgetDisplay = document.getElementById('budget-display-amount');
  if (budgetDisplay) {
    budgetDisplay.textContent = formatCurrency(state.budget);
  }
}

/**
 * Repopulates the category <select> with DEFAULT_CATEGORIES ∪ state.categories.
 * Keeps the placeholder option as the first (selected) option.
 * @param {typeof AppState} state
 */
function renderCategories(state) {
  const select = document.getElementById('category-select');
  if (!select) return;

  const currentValue = select.value;

  // Remove all options except the placeholder (index 0)
  while (select.options.length > 1) {
    select.remove(1);
  }

  const allCategories = [...DEFAULT_CATEGORIES, ...state.categories];

  for (const cat of allCategories) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  }

  // Restore previous selection if it still exists
  if (currentValue && allCategories.includes(currentValue)) {
    select.value = currentValue;
  } else {
    select.value = '';
  }
}

/**
 * Renders the transaction list.
 * Shows empty-state message when no expenses exist (Requirements 3.7, 3.8).
 * @param {typeof AppState} state
 */
function renderTransactions(state) {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  // Clear existing items
  list.innerHTML = '';

  if (state.expenses.length === 0) {
    const emptyMsg = document.createElement('li');
    emptyMsg.id = 'empty-state-msg';
    emptyMsg.textContent = 'No transactions yet. Add an expense to get started.';
    list.appendChild(emptyMsg);
    return;
  }

  const sorted = sortExpenses(state.expenses, state.sortOrder);

  for (const expense of sorted) {
    const item = document.createElement('li');
    item.dataset.id = expense.id;

    // Amount
    const amountEl = document.createElement('strong');
    amountEl.className = 'tx-amount';
    amountEl.textContent = formatCurrency(expense.amount);

    // Category badge
    const catEl = document.createElement('em');
    catEl.className = 'tx-category';
    catEl.textContent = expense.category;

    // Date
    const dateEl = document.createElement('time');
    dateEl.className = 'tx-date';
    dateEl.dateTime = expense.date;
    dateEl.textContent = formatDate(expense.date);

    // Description (optional)
    const descEl = document.createElement('p');
    descEl.className = 'tx-description';
    descEl.textContent = expense.description || '—';

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete expense: ${expense.category} ${formatCurrency(expense.amount)}`);
    deleteBtn.dataset.id = expense.id;

    item.appendChild(amountEl);
    item.appendChild(catEl);
    item.appendChild(dateEl);
    item.appendChild(descEl);
    item.appendChild(deleteBtn);

    list.appendChild(item);
  }

  // Sync sort select to current state
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = state.sortOrder;
  }
}

/**
 * Master render function — calls all render sub-functions and updates the chart.
 * This is the single re-render entry point after every state change.
 * @param {typeof AppState} state
 */
function renderAll(state) {
  renderSummary(state);
  renderCategories(state);
  renderTransactions(state);
  updateChart(state.expenses);
}

/* ============================================================
   CHART MODULE
   ============================================================ */

/** Reference to the Chart.js instance. Null until initChart() is called. */
let pieChart = null;

/**
 * Generates n visually distinct HSL colours with equal lightness.
 * @param {number} n - Number of colours to generate.
 * @returns {string[]} Array of HSL colour strings.
 */
function generateColors(n) {
  const colors = [];
  for (let i = 0; i < n; i++) {
    const hue = Math.round((i / n) * 360);
    colors.push(`hsl(${hue}, 65%, 55%)`);
  }
  return colors;
}

/**
 * Initialises the Chart.js pie chart on the #pie-chart canvas.
 * On failure, hides the chart section and shows a fallback message.
 * Requirements: 4.1, 4.4
 */
function initChart() {
  try {
    const canvas = document.getElementById('pie-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    pieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { size: 13 },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatCurrency(value)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  } catch (err) {
    console.error('Chart.js initialisation failed:', err);
    const chartSection = document.getElementById('chart-section');
    if (chartSection) {
      chartSection.hidden = true;
    }
  }
}

/**
 * Updates the pie chart data based on current expenses.
 * Shows/hides the empty-state message as needed.
 * Requirements: 4.2, 4.3, 4.4, 4.5
 *
 * @param {Array} expenses - Current expense array from AppState.
 */
function updateChart(expenses) {
  const emptyMsg = document.getElementById('chart-empty-message');
  const canvas   = document.getElementById('pie-chart');

  if (!pieChart) return;

  const totals = aggregateByCategory(expenses);

  if (totals.size === 0) {
    // Show empty state
    if (emptyMsg) emptyMsg.hidden = false;
    if (canvas)   canvas.hidden   = true;
    return;
  }

  // Hide empty state, show chart
  if (emptyMsg) emptyMsg.hidden = true;
  if (canvas)   canvas.hidden   = false;

  const labels = [...totals.keys()];
  const data   = [...totals.values()];
  const colors = generateColors(labels.length);

  pieChart.data.labels                    = labels;
  pieChart.data.datasets[0].data          = data;
  pieChart.data.datasets[0].backgroundColor = colors;
  pieChart.update();
}

/* ============================================================
   HANDLERS MODULE
   ============================================================ */

/**
 * Handles budget form submission.
 * Requirements: 1.2, 1.3, 1.4, 1.5
 * @param {Event} event
 */
function onSetBudget(event) {
  event.preventDefault();
  clearErrors('budget-error');

  const input = document.getElementById('budget-input');
  const value = input ? input.value : '';

  const { valid, errors } = validateBudget(value);

  if (!valid) {
    showError('budget-error', errors.budget);
    return;
  }

  setBudget(Number(value.trim()));
  renderAll(AppState);
}

/**
 * Handles expense form submission.
 * Requirements: 2.2–2.9
 * @param {Event} event
 */
function onAddExpense(event) {
  event.preventDefault();
  clearErrors('amount-error', 'category-error', 'date-error');

  const amountInput  = document.getElementById('amount-input');
  const catSelect    = document.getElementById('category-select');
  const dateInput    = document.getElementById('date-input');
  const descInput    = document.getElementById('description-input');

  const fields = {
    amount:      amountInput  ? amountInput.value  : '',
    category:    catSelect    ? catSelect.value     : '',
    date:        dateInput    ? dateInput.value     : '',
    description: descInput    ? descInput.value     : '',
  };

  const knownCategories = [...DEFAULT_CATEGORIES, ...AppState.categories];
  const { valid, errors } = validateExpense(fields, knownCategories);

  if (!valid) {
    if (errors.amount)   showError('amount-error',   errors.amount);
    if (errors.category) showError('category-error', errors.category);
    if (errors.date)     showError('date-error',     errors.date);
    return;
  }

  const expense = {
    id:          crypto.randomUUID(),
    amount:      Math.round(Number(fields.amount) * 100) / 100,
    category:    fields.category,
    date:        fields.date,
    description: fields.description.trim(),
  };

  addExpense(expense);
  renderAll(AppState);

  // Reset form fields (Requirement 2.9)
  if (amountInput)  amountInput.value  = '';
  if (catSelect)    catSelect.value    = '';
  if (dateInput)    dateInput.value    = '';
  if (descInput)    descInput.value    = '';
}

/**
 * Handles transaction delete button clicks (via event delegation on #transaction-list).
 * Requirements: 3.3, 3.4, 3.5, 3.6
 * @param {string} id - The expense id to delete.
 */
function onDeleteTransaction(id) {
  const confirmed = window.confirm('Delete this transaction? This cannot be undone.');
  if (!confirmed) return;

  const ok = deleteExpenseById(id);

  if (!ok) {
    // Show inline error on the list container
    const list = document.getElementById('transaction-list');
    if (list) {
      const errMsg = document.createElement('p');
      errMsg.className = 'storage-error';
      errMsg.textContent = 'Error: Could not save the deletion. Please try again.';
      list.prepend(errMsg);
      setTimeout(() => errMsg.remove(), 4000);
    }
    return;
  }

  renderAll(AppState);
}

/**
 * Handles custom category form submission.
 * Requirements: 5.1–5.3, 5.6, 5.7
 * @param {Event} event
 */
function onAddCategory(event) {
  event.preventDefault();
  clearErrors('category-form-error');

  const input = document.getElementById('new-category-input');
  const name  = input ? input.value : '';

  const { valid, errors } = validateCategory(name, AppState.categories);

  if (!valid) {
    showError('category-form-error', errors.category);
    return;
  }

  addCategory(name);
  renderCategories(AppState);

  if (input) input.value = '';
}

/**
 * Handles sort order changes.
 * Requirements: 6.2, 6.3, 6.4
 * @param {Event} event
 */
function onSortChange(event) {
  const order = event.target.value;
  setSortOrder(order);
  renderTransactions(AppState);
}

/**
 * Session flag — tracks whether the user has toggled the theme this session.
 * Prevents writing to localStorage on load (Requirement 7.6).
 */
let themeToggledThisSession = false;

/**
 * Handles theme toggle button clicks.
 * Requirements: 7.1–7.3, 7.5, 7.6
 */
function onThemeToggle() {
  const newTheme = AppState.theme === 'light' ? 'dark' : 'light';
  AppState.theme = newTheme;

  themeToggledThisSession = true;
  setTheme(newTheme); // persists to localStorage

  applyTheme(newTheme);
  updateThemeToggleLabel(newTheme);
}

/**
 * Applies the given theme to the <html> element via data-theme attribute.
 * @param {'light'|'dark'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Updates the theme toggle button's aria-label to reflect the current state.
 * @param {'light'|'dark'} currentTheme
 */
function updateThemeToggleLabel(currentTheme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  if (currentTheme === 'dark') {
    btn.setAttribute('aria-label', 'Switch to light theme (currently dark theme)');
    btn.textContent = '☀️ Toggle Theme';
  } else {
    btn.setAttribute('aria-label', 'Switch to dark theme (currently light theme)');
    btn.textContent = '🌙 Toggle Theme';
  }
}

/* ============================================================
   UTILITY FORMATTERS
   ============================================================ */

/**
 * Formats a number as a currency string (USD-style, 2 decimal places).
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  return 'Rp' + value.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Formats an ISO date string (YYYY-MM-DD) to a human-readable local date.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '';
  // Append T00:00:00 to force local time interpretation
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ============================================================
   INIT MODULE
   ============================================================ */

/**
 * Wires all DOM event listeners. Called once from init().
 */
function wireEventListeners() {
  // Budget form
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) budgetForm.addEventListener('submit', onSetBudget);

  // Expense form
  const expenseForm = document.getElementById('expense-form');
  if (expenseForm) expenseForm.addEventListener('submit', onAddExpense);

  // Custom category form
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) categoryForm.addEventListener('submit', onAddCategory);

  // Sort select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.addEventListener('change', onSortChange);

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', onThemeToggle);

  // Delete buttons — event delegation on the transaction list
  const txList = document.getElementById('transaction-list');
  if (txList) {
    txList.addEventListener('click', (event) => {
      const btn = event.target.closest('.btn-delete');
      if (!btn) return;
      const id = btn.dataset.id;
      if (id) onDeleteTransaction(id);
    });
  }
}

/**
 * Application entry point.
 * Called on DOMContentLoaded.
 * Requirements: 1.6, 1.7, 3.1, 5.4, 5.5, 6.5, 6.6, 7.4
 */
function init() {
  // Apply theme BEFORE any render to prevent flash (Requirement 7.4)
  const storedTheme = safeGetItem(KEYS.THEME, 'light');
  const initialTheme = storedTheme || 'light';
  applyTheme(initialTheme);

  // Hydrate state from localStorage
  const { corrupted } = loadState();

  // Apply theme again from fully hydrated state (ensures consistency)
  applyTheme(AppState.theme);
  updateThemeToggleLabel(AppState.theme);

  // Handle storage corruption (Requirement 5.5)
  if (corrupted) {
    const main = document.querySelector('main');
    if (main) {
      const banner = document.createElement('p');
      banner.id = 'corruption-banner';
      banner.setAttribute('role', 'alert');
      banner.textContent =
        'Warning: Some saved data could not be read (storage may be corrupted). ' +
        'Please reload the page to try again.';
      main.prepend(banner);
    }

    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
      expenseForm.setAttribute('disabled', 'true');
      for (const el of expenseForm.elements) {
        el.disabled = true;
      }
    }
  }

  // Set current year in footer
  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  // Initialise Chart.js
  initChart();

  // Render full UI from loaded state
  renderAll(AppState);

  // Wire all event listeners
  wireEventListeners();
}

// Kick everything off once the DOM is fully parsed
document.addEventListener('DOMContentLoaded', init);
