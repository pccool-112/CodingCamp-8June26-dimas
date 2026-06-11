# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a zero-dependency, client-only SPA in three files (`index.html`, `css/style.css`, `js/script.js`) using pure HTML5 / CSS3 / Vanilla JS ES6+. State flows unidirectionally: Event Handler → State Manager → Render Engine → DOM + Chart. All persistence is via `localStorage`. Chart.js v4 is loaded from CDN. No `<div>` elements are used anywhere. Property-based tests use fast-check; unit tests use Vitest + jsdom; smoke/integration tests use Playwright.

---

## Tasks

- [x] 1. Scaffold project structure and base HTML skeleton
  - Create `index.html` with `<!DOCTYPE html>`, `<html lang="en">`, `<head>` (viewport, charset, CSS link, Chart.js CDN script, `js/script.js` module script), `<header>`, `<main>`, `<footer>` — no `<div>` anywhere
  - Add all five `<section>` elements with correct `id` and `aria-labelledby` attributes: `budget-section`, `expense-section`, `chart-section`, `category-section`, `history-section`
  - Add theme-toggle `<button>` in `<header>` with accessible `aria-label`
  - Add `<figure>` + `<canvas id="pie-chart">` + `<figcaption id="chart-empty-message" hidden>` inside `chart-section`
  - Add `<ol id="transaction-list" aria-live="polite">` inside `history-section` with sort `<nav>` and `<select id="sort-select">`
  - Add `<output role="alert" aria-live="polite">` error containers for each form field
  - Create empty `css/style.css` and empty `js/script.js` placeholder files
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1_

- [x] 2. Implement CONSTANTS, STATE, and STORAGE modules in `js/script.js`
  - [x] 2.1 Define CONSTANTS section: `DEFAULT_CATEGORIES` array, `localStorage` key names (`ebv_budget`, `ebv_expenses`, `ebv_categories`, `ebv_sort_order`, `ebv_theme`), validation limits (`MAX_AMOUNT = 999_999_999.99`, `MAX_DESC_LEN = 255`, `MAX_CAT_LEN = 50`)
    - _Requirements: 2.1, 5.1, 9.2_
  - [x] 2.2 Implement `AppState` singleton with fields: `budget`, `expenses`, `categories`, `sortOrder`, `theme`
    - _Requirements: 1.7, 6.6_
  - [x] 2.3 Implement `safeGetItem(key, fallback)` and `safeSetItem(key, value)` with try/catch for quota and parse errors; implement `loadState()` to hydrate `AppState` from `localStorage`; implement `saveState()` to persist all keys
    - Handle corrupted data by returning `null` from `safeGetItem`; caller must detect and show error banner
    - _Requirements: 1.6, 3.1, 5.4, 5.5, 7.4, 9.4_
  - [ ]* 2.4 Write unit tests for STORAGE module
    - Mock `localStorage` with jsdom; test `safeGetItem` with valid data, missing key (returns fallback), invalid JSON (returns null), and `safeSetItem` with quota error (returns false)
    - _Requirements: 5.5, 9.4_

- [x] 3. Implement VALIDATION module
  - [x] 3.1 Implement `validateBudget(value)` — returns `{ valid, errors }`: rejects empty/whitespace, non-numeric, ≤ 0, > MAX_AMOUNT
    - _Requirements: 1.4, 1.5_
  - [x] 3.2 Implement `validateExpense({ amount, category, date, description })` — returns `{ valid, errors }`: rejects non-positive amount, > MAX_AMOUNT, > 2 dp; rejects empty category or category not in known list; rejects missing or future date; rejects description > 255 chars
    - _Requirements: 2.6, 2.7, 2.8, 2.10_
  - [x] 3.3 Implement `validateCategory(name, existingCategories)` — returns `{ valid, errors }`: rejects empty, > 50 chars, case-insensitive duplicate against `DEFAULT_CATEGORIES ∪ existingCategories`
    - _Requirements: 5.6, 5.7_
  - [ ]* 3.4 Write property test for `validateBudget` (Property 4)
    - **Property 4: Whitespace/empty budget is always rejected**
    - **Validates: Requirements 1.4, 1.5**
    - Generate: empty strings, whitespace-only strings, numeric strings ≤ 0 via fast-check; assert `valid === false` for every generated value (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 4: Whitespace/empty budget is always rejected`
  - [ ]* 3.5 Write property test for `validateExpense` (Property 3)
    - **Property 3: Expense form validation rejects all invalid inputs**
    - **Validates: Requirements 2.6, 2.7, 2.8**
    - Generate: tuples with at least one invalid field (amount ≤ 0, empty category, future date, amount > MAX_AMOUNT) via fast-check; assert `valid === false` and `Object.keys(errors).length > 0` (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 3: Expense form validation rejects all invalid inputs`
  - [ ]* 3.6 Write property test for `validateCategory` duplicate detection (Property 7)
    - **Property 7: Custom category duplicate detection is case-insensitive**
    - **Validates: Requirements 5.7**
    - Generate: category name already in defaults or custom list with randomised casing via fast-check; assert `valid === false` (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 7: Custom category duplicate detection is case-insensitive`
  - [ ]* 3.7 Write unit tests for VALIDATION module
    - One test per boundary: empty budget, zero budget, negative budget, budget at max, budget exceeding max; amount with 3 dp, amount = 0, future date, missing category, description length 255 vs 256, duplicate category (same/different case)
    - _Requirements: 1.4, 1.5, 2.6, 2.7, 2.8, 5.6, 5.7_

- [ ] 4. Implement computed value functions and core state mutations
  - [ ] 4.1 Implement `computeBalance(budget, expenses)` → `budget − Σ expense.amount`; implement `aggregateByCategory(expenses)` → `Map<string, number>`; implement `sortExpenses(expenses, sortOrder)` with secondary date-descending tie-break
    - _Requirements: 1.2, 1.3, 4.2, 6.3_
  - [~] 4.2 Implement state mutation helpers: `addExpense(expense)`, `deleteExpenseById(id)`, `setBudget(value)`, `addCategory(name)`, `setSortOrder(order)`, `setTheme(theme)` — each mutates `AppState` and calls `saveState()`
    - `deleteExpenseById` must re-insert at original index and return false if `safeSetItem` fails
    - _Requirements: 2.2, 2.3, 3.3, 3.4, 5.2, 5.3, 6.4, 7.3_
  - [ ]* 4.3 Write property test for balance invariant (Property 1)
    - **Property 1: Balance invariant**
    - **Validates: Requirements 1.2, 1.3, 2.4, 3.5**
    - Generate: random budget (0–999999999.99) + random expense array; assert `computeBalance(budget, expenses) === budget − Σ amounts` (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 1: Balance invariant`
  - [ ]* 4.4 Write property test for sort stability (Property 6)
    - **Property 6: Sort order stability — secondary sort by date**
    - **Validates: Requirements 6.3**
    - Generate: expense lists with duplicate amounts; assert that within equal-amount groups the date order is descending after `sortExpenses(..., 'amount-desc')` and `sortExpenses(..., 'amount-asc')` (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 6: Sort order stability — secondary sort by date`
  - [ ]* 4.5 Write unit tests for computed value functions
    - `computeBalance` with empty list, single expense, multiple expenses; `aggregateByCategory` with shared and unique categories; `sortExpenses` for all three orders including tie-break
    - _Requirements: 1.2, 4.2, 6.1, 6.3_

- [~] 5. Checkpoint — core logic complete
  - Ensure all unit tests and property tests for STORAGE, VALIDATION, and computed value functions pass; fix any failures before continuing

- [ ] 6. Implement STORAGE property-based tests
  - [~] 6.1 Write property test for `localStorage` round-trip (Property 2)
    - **Property 2: LocalStorage round-trip preserves expense data**
    - **Validates: Requirements 2.3, 3.1**
    - Generate: random valid `Expense` arrays; call `saveState()` then `loadState()`; assert each expense field is deeply equal to the original (min 100 runs); mock `localStorage` with an in-memory store
    - Tag: `// Feature: expense-budget-visualizer, Property 2: LocalStorage round-trip preserves expense data`
  - [~] 6.2 Write property test for custom category round-trip (Property 8)
    - **Property 8: Custom category round-trip**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - Generate: arrays of valid category name strings; serialise via `safeSetItem` then deserialise via `safeGetItem`; assert the resulting array equals the original (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 8: Custom category round-trip`

- [ ] 7. Implement RENDER module
  - [~] 7.1 Implement `renderSummary(state)` — writes budget amount and balance to DOM; applies green/red colour class to balance based on sign
    - _Requirements: 1.2, 1.3, 1.8_
  - [~] 7.2 Implement `renderTransactions(state)` — clears `#transaction-list`, renders an `<li>` per expense with amount, category, date, description, and a delete `<button>`; renders empty-state `<p>` when list is empty; applies current `sortOrder`
    - _Requirements: 3.1, 3.2, 3.7, 3.8, 6.1, 6.2_
  - [~] 7.3 Implement `renderCategories(state)` — repopulates `#category-select` with `DEFAULT_CATEGORIES ∪ state.categories`; sets placeholder option as selected (value="")
    - _Requirements: 2.1, 5.2, 5.4_
  - [~] 7.4 Implement `showError(outputId, message)` and `clearErrors(...outputIds)` helper functions used by all form handlers
    - _Requirements: 1.4, 2.6, 2.7, 2.8, 5.6, 5.7_
  - [~] 7.5 Implement `renderAll(state)` — calls `renderSummary`, `renderTransactions`, `renderCategories`, and `updateChart` in sequence; this is the single re-render entry point after every state change
    - _Requirements: 2.4, 2.5, 3.5, 3.6_

- [ ] 8. Implement CHART module
  - [~] 8.1 Implement Chart.js pie chart initialisation in an `initChart()` function — acquires canvas context, creates `new Chart(ctx, { type: 'pie', ... })`, wraps in try/catch; on failure hides `#chart-section` and renders a static text summary
    - _Requirements: 4.1, 4.4_
  - [~] 8.2 Implement `updateChart(expenses)` — calls `aggregateByCategory`, updates `pieChart.data.labels`, `.datasets[0].data`, `.datasets[0].backgroundColor` via `generateColors(n)`, calls `pieChart.update()`; shows/hides `#chart-empty-message` based on whether expenses exist
    - `generateColors(n)` generates `n` distinct HSL colours with equal lightness
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [ ]* 8.3 Write property test for pie chart proportions (Property 5)
    - **Property 5: Pie chart proportions sum to 360°**
    - **Validates: Requirements 4.2**
    - Generate: non-empty arrays of expenses with positive amounts; call `aggregateByCategory`; assert `Σ data values === Σ expense amounts` (i.e., no amount lost in aggregation) (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 5: Pie chart proportions sum to 360°`

- [ ] 9. Implement HANDLERS module
  - [~] 9.1 Implement `onSetBudget(event)` — calls `validateBudget`, on valid: calls `setBudget`, calls `renderAll`; on invalid: calls `showError` for budget field
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [~] 9.2 Implement `onAddExpense(event)` — calls `validateExpense`, on valid: creates `Expense` with `crypto.randomUUID()`, calls `addExpense`, calls `renderAll`, resets form fields; on invalid: calls `showError` for each offending field
    - Form reset: amount → empty, category → placeholder, date → empty, description → empty
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  - [~] 9.3 Implement `onDeleteTransaction(id)` — shows browser `confirm()` prompt; on confirmed: calls `deleteExpenseById`; if deletion fails (returns false) shows inline error; calls `renderAll` on success
    - _Requirements: 3.3, 3.4, 3.5, 3.6_
  - [~] 9.4 Implement `onAddCategory(event)` — calls `validateCategory`, on valid: calls `addCategory`, calls `renderCategories`; on invalid: calls `showError` for category form field
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_
  - [~] 9.5 Implement `onSortChange(event)` — reads selected value, calls `setSortOrder`, calls `renderTransactions`
    - _Requirements: 6.2, 6.3, 6.4_
  - [~] 9.6 Implement `onThemeToggle()` — reads current theme from `AppState`, flips to opposite, calls `setTheme`; applies `data-theme` attribute to `<html>` element; updates `aria-label` of toggle button; does NOT write to `localStorage` if no toggle was made this session (guard via session flag)
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  - [ ]* 9.7 Write property test for form reset after submission (Property 10)
    - **Property 10: Form reset after successful submission**
    - **Validates: Requirements 2.9**
    - Generate: valid expense field combinations; call `onAddExpense` with a synthetic event against the real form DOM (jsdom); assert amount field value is `""`, category selectedIndex is 0 (placeholder), date value is `""`, description value is `""` (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 10: Form reset after successful submission`
  - [ ]* 9.8 Write unit tests for HANDLERS
    - Test `onSetBudget` with valid and invalid values; test `onAddExpense` with all-valid and each-field-invalid cases; test `onDeleteTransaction` confirm/cancel paths and localStorage failure path; test `onAddCategory` valid/duplicate; test `onSortChange` persists order
    - _Requirements: 1.2, 1.4, 2.6, 2.7, 2.8, 2.9, 3.3, 3.4, 5.6, 5.7, 6.4_

- [~] 10. Checkpoint — handlers and render pipeline complete
  - Run full unit and property test suite; assert all tests pass; review DOM output in jsdom for semantic HTML correctness (no `<div>` elements)

- [ ] 11. Implement INIT module and wire everything together
  - [~] 11.1 Implement `init()` function called on `DOMContentLoaded`: calls `loadState()`, applies stored theme to `<html>` element immediately (before paint), calls `initChart()`, calls `renderAll(AppState)`, wires all event listeners (`budget-form` submit, `expense-form` submit, `category-form` submit, `sort-select` change, `theme-toggle` click, `transaction-list` click delegation for delete buttons)
    - Theme must be applied synchronously before `renderAll` to prevent flash (Req 7.4)
    - Corrupted state detection: if `loadState()` returns corruption flag, show error banner and disable `#expense-form`
    - _Requirements: 1.6, 1.7, 3.1, 5.4, 5.5, 6.5, 6.6, 7.4_
  - [ ]* 11.2 Write property test for delete removes exactly one (Property 9)
    - **Property 9: Transaction deletion removes exactly one record**
    - **Validates: Requirements 3.3, 3.5, 3.6**
    - Generate: non-empty expense arrays and a random valid index; call `deleteExpenseById(expenses[index].id)` on a cloned `AppState`; assert list length decreased by exactly 1, deleted id absent, all other expense objects unchanged (min 100 runs)
    - Tag: `// Feature: expense-budget-visualizer, Property 9: Transaction deletion removes exactly one record`
  - [ ]* 11.3 Write unit tests for INIT and wiring
    - Test that `DOMContentLoaded` causes `loadState`, `renderAll`, and chart init to be called; test event listener bindings with simulated events; test theme applied before first render
    - _Requirements: 1.6, 7.4_

- [ ] 12. Implement CSS — theme, layout, and visual states
  - [~] 12.1 Define CSS custom properties on `:root` and `[data-theme="dark"]` for all colour tokens (background, surface, text, accent-positive, accent-negative, border); add CSS transition on `body` for theme change (`150ms–400ms`)
    - _Requirements: 7.1, 7.2_
  - [~] 12.2 Implement mobile-first responsive layout using CSS Grid or Flexbox with `rem`/`%`/`vw` units; single-column below 768 px, two-column 768–1024 px, full desktop above 1024 px; minimum body font 16 px; minimum secondary font 12 px; minimum tap-target 44 × 44 px for all interactive controls
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [~] 12.3 Style `#balance-display` with `.balance-positive` (green token) and `.balance-negative` (red token) classes toggled by `renderSummary`; add visible focus indicators on all interactive elements meeting WCAG 2.1 AA; add `:hover`/`:focus` states
    - _Requirements: 1.8, 7.1_

- [~] 13. Checkpoint — visual and style complete
  - Open `index.html` in a browser and verify: no horizontal overflow at 320 px, theme toggle works, chart renders, transaction list renders; run axe-core check for zero critical violations

- [ ] 14. Integration and smoke tests (Playwright)
  - [~] 14.1 Write Playwright smoke test: load `index.html`; assert no JS console errors; assert `Chart` global is defined; assert `localStorage` keys written after first expense add; assert page reloads restore state
    - _Requirements: 4.1, 9.4_
  - [ ]* 14.2 Write Playwright theme flash test: pre-store `ebv_theme = "dark"` in `localStorage`; navigate to `index.html`; assert `data-theme="dark"` is present on `<html>` before first contentful paint (use `performance.getEntriesByType('paint')` to measure)
    - _Requirements: 7.4_
  - [ ]* 14.3 Write Playwright accessibility test: run `axe-core` on rendered page in both `light` and `dark` themes; assert zero critical violations; assert all `<input>` and `<select>` elements have matching `<label>` associations
    - _Requirements: 7.1, 8.3_

- [~] 15. Final checkpoint — all tests pass
  - Run `vitest --run` for all unit and property tests; run Playwright tests; assert all pass; verify no `<div>` elements exist in `index.html`; verify exactly three source files exist

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for full traceability
- The unidirectional flow (`onEvent → mutateState → saveState → renderAll`) must be respected in every handler — never mutate DOM directly in handlers
- Property tests tag format: `// Feature: expense-budget-visualizer, Property <N>: <text>` — do not omit tags
- fast-check arbitraries for `Expense` objects should honour all validation constraints so they generate only valid instances for P1, P2, P5, P6, P8, P9 tests
- Checkpoints 5, 10, 13, 15 are human-review gates; the coding agent should stop and surface results at each

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["2.4", "3.4", "3.5", "3.6", "3.7", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "6.1", "6.2"] },
    { "id": 4, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "9.1", "9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 6, "tasks": ["9.7", "9.8", "11.2", "12.1"] },
    { "id": 7, "tasks": ["11.1", "12.2", "12.3"] },
    { "id": 8, "tasks": ["11.3", "14.1"] },
    { "id": 9, "tasks": ["14.2", "14.3"] }
  ]
}
```
