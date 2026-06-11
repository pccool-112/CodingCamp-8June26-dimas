# Design Document

## Overview

The Expense & Budget Visualizer is a zero-dependency, client-only Single-Page Application (SPA). It is delivered as three files — `index.html`, `css/style.css`, and `js/script.js` — and runs entirely in the browser. All state is held in-memory during the session and persisted to `localStorage` as JSON strings.

The application provides five user-facing capabilities:

1. **Budget management** — set/update a monthly spending cap; see remaining balance.
2. **Expense entry** — record individual transactions with amount, category, date, and description.
3. **Transaction history** — browse, sort, and delete past expenses.
4. **Visual dashboard** — real-time Chart.js v4 pie chart grouped by category.
5. **Customisation** — user-defined categories, sort order persistence, dark/light theme toggle.

The tech stack is intentionally constrained: HTML5 semantic elements only (no `<div>`), CSS3 with custom properties for theming, ES6+ Vanilla JavaScript, and Chart.js 4.x loaded from CDN.

---

## Architecture

The application uses a **unidirectional data flow** pattern without a framework:

```
User Interaction
      │
      ▼
 Event Handler  (js/script.js — UI layer)
      │  calls
      ▼
 State Manager  (in-memory AppState object + LocalStorage adapter)
      │  produces new state
      ▼
 Render Engine  (pure functions that diff/rewrite DOM sections)
      │  writes
      ▼
   DOM + Chart
```

There is no virtual DOM. Each render function receives the full current state and rewrites the affected DOM subtree. Chart.js holds its own internal state; the render engine calls `chart.data.datasets[0].data = newData; chart.update()` to synchronise it.

### Module Boundaries (single-file, logical sections)

`js/script.js` is organised into clearly commented sections:

| Section | Responsibility |
|---|---|
| `CONSTANTS` | Default categories, localStorage keys, validation limits |
| `STATE` | In-memory singleton (`AppState`) |
| `STORAGE` | `loadState()`, `saveState()` — all localStorage I/O |
| `VALIDATION` | Pure validation functions; return `{ valid, errors }` |
| `CHART` | Chart.js initialisation and `updateChart()` |
| `RENDER` | `renderTransactions()`, `renderSummary()`, `renderCategories()` |
| `HANDLERS` | `onAddExpense()`, `onDeleteTransaction()`, `onSetBudget()`, etc. |
| `INIT` | `DOMContentLoaded` bootstrap — loads state, wires events, first render |

---

## Components and Interfaces

### HTML Structure

```
<header>
  <h1>…</h1>
  <button id="theme-toggle">…</button>
</header>

<main>
  <section id="budget-section" aria-labelledby="budget-heading">
    <h2 id="budget-heading">…</h2>
    <form id="budget-form">
      <label for="budget-input">Monthly Budget</label>
      <input id="budget-input" type="number" …>
      <button type="submit">Set Budget</button>
      <output id="budget-error" role="alert" aria-live="polite"></output>
    </form>
    <p id="balance-display">…</p>
  </section>

  <section id="expense-section" aria-labelledby="expense-heading">
    <h2 id="expense-heading">…</h2>
    <form id="expense-form">
      <label for="amount-input">Amount</label>
      <input id="amount-input" type="number" …>
      <output id="amount-error" role="alert" aria-live="polite"></output>

      <label for="category-select">Category</label>
      <select id="category-select">…</select>
      <output id="category-error" role="alert" aria-live="polite"></output>

      <label for="date-input">Date</label>
      <input id="date-input" type="date" …>
      <output id="date-error" role="alert" aria-live="polite"></output>

      <label for="description-input">Description (optional)</label>
      <input id="description-input" type="text" maxlength="255">

      <button type="submit">Add Expense</button>
    </form>
  </section>

  <section id="chart-section" aria-labelledby="chart-heading">
    <h2 id="chart-heading">…</h2>
    <figure>
      <canvas id="pie-chart"></canvas>
      <figcaption id="chart-empty-message" hidden>No expense data to display.</figcaption>
    </figure>
  </section>

  <section id="category-section" aria-labelledby="category-heading">
    <h2 id="category-heading">…</h2>
    <form id="category-form">
      <label for="new-category-input">Category Name</label>
      <input id="new-category-input" type="text" maxlength="50">
      <output id="category-form-error" role="alert" aria-live="polite"></output>
      <button type="submit">Add Category</button>
    </form>
  </section>

  <section id="history-section" aria-labelledby="history-heading">
    <h2 id="history-heading">…</h2>
    <nav aria-label="Sort transactions">
      <label for="sort-select">Sort by</label>
      <select id="sort-select">
        <option value="amount-desc">Amount: High to Low</option>
        <option value="amount-asc">Amount: Low to High</option>
        <option value="category-az">Category (A–Z)</option>
      </select>
    </nav>
    <ol id="transaction-list" aria-live="polite" aria-relevant="additions removals">
      <!-- <li> per transaction or empty-state <p> -->
    </ol>
  </section>
</main>

<footer>…</footer>
```

> **No `<div>` elements** are used anywhere. `<output>` elements carry inline validation messages; `role="alert"` + `aria-live="polite"` makes them announced to screen readers.

### JavaScript Interfaces

```js
/** In-memory application state */
const AppState = {
  budget: 0,            // number
  expenses: [],         // Expense[]
  categories: [],       // string[] — custom categories only
  sortOrder: 'amount-desc',  // SortOrder
  theme: 'light',       // 'light' | 'dark'
};

/**
 * @typedef {Object} Expense
 * @property {string}  id          — crypto.randomUUID()
 * @property {number}  amount      — positive float, ≤ 2 dp
 * @property {string}  category    — non-empty string
 * @property {string}  date        — ISO 8601 date string (YYYY-MM-DD)
 * @property {string}  description — up to 255 chars, may be empty
 */

/** @typedef {'amount-desc'|'amount-asc'|'category-az'} SortOrder */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {Object.<string, string>} errors — field name → message
 */
```

### LocalStorage Schema

| Key | Type | Content |
|---|---|---|
| `ebv_budget` | string (number) | e.g. `"1500"` |
| `ebv_expenses` | JSON array | `Expense[]` |
| `ebv_categories` | JSON array | `string[]` |
| `ebv_sort_order` | string | `SortOrder` value |
| `ebv_theme` | string | `"light"` or `"dark"` |

All keys are namespaced with the `ebv_` prefix to avoid collisions.

### Chart.js Integration

```js
// Initialisation (INIT phase)
const ctx = document.getElementById('pie-chart').getContext('2d');
const pieChart = new Chart(ctx, {
  type: 'pie',
  data: { labels: [], datasets: [{ data: [] }] },
  options: {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
  },
});

// Update (called by renderChart())
function updateChart(expenses) {
  const totals = aggregateByCategory(expenses);   // Map<string, number>
  pieChart.data.labels   = [...totals.keys()];
  pieChart.data.datasets[0].data   = [...totals.values()];
  pieChart.data.datasets[0].backgroundColor = generateColors(totals.size);
  pieChart.update();
}
```

Chart.js's `chart.update()` call triggers an animated transition — no page reload is required (Requirement 4.3).

---

## Data Models

### Expense

```
Expense {
  id:          UUID string          — generated client-side via crypto.randomUUID()
  amount:      number               — positive, ≤ 999,999,999.99, ≤ 2 decimal places
  category:    string               — one of DEFAULT_CATEGORIES ∪ AppState.categories
  date:        YYYY-MM-DD string    — not in the future relative to local date
  description: string               — 0–255 characters (empty string when omitted)
}
```

### AppState

```
AppState {
  budget:     number     — non-negative; 0 when not yet set
  expenses:   Expense[]  — insertion-ordered; UI may apply a sort on top
  categories: string[]   — custom categories added by user (not defaults)
  sortOrder:  SortOrder  — controls Transaction_List rendering order
  theme:      'light' | 'dark'
}
```

### Computed Values (derived, never stored separately)

| Value | Formula |
|---|---|
| `balance` | `AppState.budget − Σ expense.amount` |
| `categoryTotals` | `Map<category, Σ amount>` over all expenses |
| `sortedExpenses` | `AppState.expenses` sorted by `AppState.sortOrder` |

### Default Categories

```js
const DEFAULT_CATEGORIES = [
  'Food', 'Transport', 'Housing', 'Entertainment',
  'Healthcare', 'Shopping', 'Utilities', 'Education', 'Other',
];
```

These are hard-coded constants and never written to `localStorage`.

### Validation Constraints

| Field | Rule |
|---|---|
| Budget | Numeric, > 0, ≤ 999,999,999.99 |
| Amount | Numeric, > 0, ≤ 999,999,999.99, ≤ 2 decimal places |
| Category | Non-empty, from known category list |
| Date | Valid date string, not in the future |
| Description | 0–255 characters |
| Custom Category | 1–50 characters, case-insensitive unique |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Balance invariant

*For any* budget value and any list of expenses, the displayed balance must equal the budget minus the sum of all expense amounts.

**Validates: Requirements 1.2, 1.3, 2.4, 3.5**

---

### Property 2: LocalStorage round-trip preserves expense data

*For any* valid `Expense` object, serialising the expense list to `localStorage` and then deserialising it must produce a list containing an object deeply equal to the original.

**Validates: Requirements 2.3, 3.1**

---

### Property 3: Expense form validation rejects all invalid inputs

*For any* combination of form field values where at least one field violates its constraint (amount ≤ 0, no category selected, future date, amount exceeding the maximum), the validator must return `valid = false` and produce at least one non-empty error message.

**Validates: Requirements 2.6, 2.7, 2.8**

---

### Property 4: Whitespace/empty budget is always rejected

*For any* string that is empty or composed entirely of whitespace, or any non-positive numeric value, the budget validator must return `valid = false`.

**Validates: Requirements 1.4, 1.5**

---

### Property 5: Pie chart proportions sum to 360°

*For any* non-empty list of expenses with positive amounts, the computed arc angles for all category segments must sum to exactly 360° (i.e., the data values sum equals the total of all positive expense amounts).

**Validates: Requirements 4.2**

---

### Property 6: Sort order stability — secondary sort by date

*For any* list of expenses where two or more expenses share the same amount, sorting by `amount-desc` or `amount-asc` must produce a sub-ordering for those tied expenses that is sorted by date descending (most recent first).

**Validates: Requirements 6.3**

---

### Property 7: Custom category duplicate detection is case-insensitive

*For any* new category name string, if a case-insensitive match already exists in the union of default categories and stored custom categories, the validator must return `valid = false`.

**Validates: Requirements 5.7**

---

### Property 8: Custom category round-trip

*For any* list of custom category strings added through the UI, persisting and then reloading from `localStorage` must reproduce the same ordered list.

**Validates: Requirements 5.2, 5.3, 5.4**

---

### Property 9: Transaction deletion removes exactly one record

*For any* expense list and any valid expense `id`, deleting that expense must result in a list whose length is exactly one less than before and which does not contain the deleted expense, while all other expenses remain unchanged.

**Validates: Requirements 3.3, 3.5, 3.6**

---

### Property 10: Form reset after successful submission

*For any* valid expense submission, after the expense is created the amount field must be empty, the category field must be the placeholder, the date field must be empty, and the description field must be empty.

**Validates: Requirements 2.9**

---

## Error Handling

### Validation Errors (inline, non-blocking for other fields)

- Each form field has a dedicated `<output role="alert" aria-live="polite">` element.
- Validation runs on submit; errors are displayed inline adjacent to the offending field.
- Successful submission clears all error outputs.
- Pattern: `showError(fieldId, message)` / `clearError(fieldId)`.

### LocalStorage Failures

Three failure modes are handled:

| Mode | Trigger | Response |
|---|---|---|
| **Quota exceeded** | `setItem` throws `QuotaExceededError` | Show persistent banner: "Storage full. Cannot save data." |
| **Corrupted data** | `JSON.parse` throws on a stored value | Show error banner, disable expense form, prompt reload (Req 5.5) |
| **Access denied** | `localStorage` is `null` or throws on access | Treat as first-run with empty state; show non-blocking info message |

```js
function safeGetItem(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return null;  // caller inspects null to detect corruption
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;  // caller shows error banner
  }
}
```

### Deletion Failure

If `safeSetItem` returns `false` during a delete, the expense is re-inserted at its original index and an inline error message is shown (Req 3.4).

### Chart Rendering Failure

Chart.js initialisation is wrapped in a `try/catch`. If the canvas context cannot be acquired (e.g., WebGL disabled) the chart section is hidden and replaced with a static text summary of category totals.

---

## Testing Strategy

### Unit Tests

Unit tests use plain ES6 modules and a test runner compatible with Vanilla JS (e.g., Vitest or Jest with `jsdom`). Focus areas:

- **Validation functions**: one test per boundary condition (empty string, zero, negative, above max, future date, duplicate category name).
- **Balance computation**: `computeBalance(budget, expenses)` with various inputs including an empty expense list.
- **`aggregateByCategory`**: verify totals are correct for shared and unique categories.
- **`sortExpenses`**: verify all three sort orders, including the secondary date tie-break.
- **`safeGetItem` / `safeSetItem`**: mock `localStorage` to simulate quota errors and parse failures.

### Property-Based Tests

A property-based testing library for JavaScript — [fast-check](https://github.com/dubzzz/fast-check) — is used. Each test runs a minimum of **100 iterations**.

Each test is tagged with a comment in the format:
`// Feature: expense-budget-visualizer, Property <N>: <property_text>`

| Property | Test approach |
|---|---|
| P1 Balance invariant | Generate random budget (0–999999999.99) + random expense list; assert `budget - Σ amounts === computeBalance(...)` |
| P2 LocalStorage round-trip | Generate random valid `Expense` array; serialise → deserialise → deep-equal |
| P3 Form validation rejects invalid | Generate invalid field combinations; assert `valid === false` and `errors` non-empty |
| P4 Budget validation rejects non-positive | Generate empty strings, whitespace, ≤ 0 numbers; assert `valid === false` |
| P5 Pie chart proportions | Generate non-empty expense list; assert `Σ data values === Σ expense amounts` |
| P6 Sort stability with ties | Generate expense list with duplicated amounts; assert tied entries are sub-sorted by date desc |
| P7 Duplicate category detection | Generate category name already in defaults/custom list with random casing; assert `valid === false` |
| P8 Custom category round-trip | Generate string[] of valid category names; serialise → deserialise → equal |
| P9 Delete removes exactly one | Generate expense list + random index; delete → assert length decreased by 1, rest unchanged |
| P10 Form reset after submit | Simulate valid submission; assert all form fields empty/reset |

### Integration / Smoke Tests

- Load `index.html` in a headless browser (e.g., Playwright); verify page renders without JS errors.
- Confirm Chart.js CDN `<script>` loads and `Chart` global is available.
- Confirm `localStorage` keys are written on first expense add and read on reload.
- Confirm theme is applied before paint (no flash) — measure time from navigation start to first contentful paint with dark theme pre-stored.

### Accessibility Checks

- Run `axe-core` on the rendered page in both themes; assert zero critical violations.
- Manually verify keyboard navigation covers all interactive controls.
- Verify all `<input>` and `<select>` elements have programmatic `<label>` associations.
