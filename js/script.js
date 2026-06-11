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
        // Use string inspection on the original trimmed value so that e.g.
        // "1.000" (three trailing zeros) is correctly caught as > 2 dp.
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
    // Compare at midnight local time to avoid timezone-offset surprises.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Append T00:00:00 so the Date constructor treats it as local time, not UTC.
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
 * Uses floating-point-safe arithmetic by rounding the result to 2 decimal
 * places, which prevents cumulative IEEE-754 drift on long expense lists.
 *
 * @param {number}   budget   - The current monthly budget (non-negative number).
 * @param {Array<{amount: number}>} expenses - Array of expense objects.
 * @returns {number} The balance rounded to at most 2 decimal places.
 *
 * Requirements: 1.2, 1.3, 4.2, 6.3
 */
function computeBalance(budget, expenses) {
  const sum = expenses.reduce((acc, expense) => acc + expense.amount, 0);
  return Math.round((budget - sum) * 100) / 100;
}

/**
 * Aggregates expense amounts by category.
 *
 * Returns a Map where each key is a category name and each value is the
 * total amount spent in that category.  Categories whose total rounds to
 * zero or below are excluded so the Pie_Chart never receives a zero-area
 * segment.
 *
 * @param {Array<{category: string, amount: number}>} expenses - Array of expense objects.
 * @returns {Map<string, number>} Map from category name to total amount (> 0 only).
 *
 * Requirements: 4.2
 */
function aggregateByCategory(expenses) {
  const totals = new Map();

  for (const expense of expenses) {
    const current = totals.get(expense.category) ?? 0;
    totals.set(expense.category, current + expense.amount);
  }

  // Remove any categories whose accumulated total is not positive
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
 * The input array is NEVER mutated — a shallow copy is sorted and returned.
 *
 * Sort orders:
 *  'amount-desc'  — amount descending; ties broken by date descending (most recent first)
 *  'amount-asc'   — amount ascending;  ties broken by date descending (most recent first)
 *  'category-az'  — category name A→Z (case-insensitive); ties broken by date descending
 *
 * For date comparison, ISO 8601 date strings (YYYY-MM-DD) sort correctly as
 * plain strings, but `new Date(a.date) - new Date(b.date)` is used for
 * explicitness and robustness.
 *
 * @param {Array<{amount: number, category: string, date: string}>} expenses
 * @param {'amount-desc'|'amount-asc'|'category-az'} sortOrder
 * @returns {Array<{amount: number, category: string, date: string}>} New sorted array.
 *
 * Requirements: 6.3
 */
function sortExpenses(expenses, sortOrder) {
  const copy = [...expenses];

  copy.sort((a, b) => {
    switch (sortOrder) {
      case 'amount-asc': {
        const diff = a.amount - b.amount;
        if (diff !== 0) return diff;
        // Tie-break: date descending (most recent first)
        return new Date(b.date) - new Date(a.date);
      }

      case 'category-az': {
        const catA = a.category.toLowerCase();
        const catB = b.category.toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;
        // Tie-break: date descending (most recent first)
        return new Date(b.date) - new Date(a.date);
      }

      case 'amount-desc':
      default: {
        const diff = b.amount - a.amount;
        if (diff !== 0) return diff;
        // Tie-break: date descending (most recent first)
        return new Date(b.date) - new Date(a.date);
      }
    }
  });

  return copy;
}
