# Requirements Document

## Introduction

The Expense & Budget Visualizer is a Single-Page Web Application (SPA) built with pure HTML5, CSS3, and Vanilla JavaScript (ES6+). It runs entirely in the browser with no backend, persisting data in Local Storage. Users can set a monthly budget, track expenses by category, view a real-time Chart.js pie chart of spending, manage transaction history, add custom categories, sort transactions, and toggle between dark and light themes. The application uses strictly semantic HTML elements — no `<div>` elements are permitted anywhere.

## Glossary

- **App**: The Expense & Budget Visualizer SPA as a whole.
- **Budget**: A user-defined monthly spending limit, expressed as a positive number.
- **Expense**: A single financial transaction consisting of an amount, category, date, and optional description.
- **Category**: A named classification for an expense (e.g., Food, Transport). Categories include default categories and user-created custom categories.
- **Custom_Category**: A user-defined category created at runtime and persisted to Local Storage.
- **Transaction_List**: The ordered collection of all recorded expenses rendered in the UI.
- **Balance**: The value computed as `Budget − sum of all expense amounts`.
- **Pie_Chart**: A Chart.js-powered pie chart visualising expense totals grouped by category.
- **Local_Storage**: The browser Web Storage API used for all client-side data persistence.
- **Theme**: The visual colour scheme of the App, either "light" or "dark".
- **Sort_Order**: The currently active sorting criterion applied to the Transaction_List.
- **Validator**: The client-side input validation logic that checks expense form fields before submission.

---

## Requirements

### Requirement 1: Budget Management

**User Story:** As a user, I want to set and update a monthly budget, so that I can track how much money I have remaining for the month.

#### Acceptance Criteria

1. THE App SHALL display a budget input field and a "Set Budget" control in the UI.
2. WHEN the user submits a valid budget value, THE App SHALL store the budget in Local_Storage and update the displayed Budget amount within 100 milliseconds.
3. WHEN the user submits a valid budget value, THE App SHALL recalculate and display the updated Balance within 100 milliseconds.
4. IF the user submits a budget value that is empty, non-numeric, zero, or negative, THEN THE Validator SHALL display an inline error message adjacent to the budget input field and reject the submission, preventing any storage update or Balance recalculation.
5. IF the user submits a budget value greater than 999,999,999.99, THEN THE Validator SHALL display an inline error message and reject the submission.
6. WHEN the App loads and a budget is stored in Local_Storage, THE App SHALL retrieve and display the stored Budget and recalculate and display the Balance before any user interaction.
7. WHEN the App loads and no budget is stored in Local_Storage, THE App SHALL display a Budget of 0 and a Balance of 0, and the expense entry form SHALL remain accessible.
8. THE App SHALL display the Balance in green (or equivalent accessible colour token) when it is greater than zero, and in red (or equivalent accessible colour token) when it is zero or negative.

---

### Requirement 2: Expense Entry

**User Story:** As a user, I want to add an expense with amount, category, date, and description, so that I can record my spending accurately.

#### Acceptance Criteria

1. THE App SHALL provide a form containing fields for Amount (numeric, positive, up to 999,999,999.99, max 2 decimal places), Category (select/dropdown), Date (date picker, no future dates), and Description (optional text, up to 255 characters).
2. WHEN the user submits the expense form with all required fields valid, THE App SHALL create a new Expense record and append it to the Transaction_List.
3. WHEN a new Expense is created, THE App SHALL persist the updated Transaction_List to Local_Storage.
4. WHEN a new Expense is created, THE App SHALL recalculate and update the displayed Balance.
5. WHEN a new Expense is created, THE App SHALL update the Pie_Chart to reflect the new category totals.
6. IF the user submits the expense form with the Amount field empty, non-numeric, non-positive, or greater than 999,999,999.99, THEN THE Validator SHALL display an inline error on the Amount field and prevent submission; any validation error SHALL always block submission to preserve data integrity.
7. IF the user submits the expense form with no Category selected, THEN THE Validator SHALL display an inline error on the Category field and prevent submission; any validation error SHALL always block submission to preserve data integrity.
8. IF the user submits the expense form with no Date provided or with a future date, THEN THE Validator SHALL display an inline error on the Date field and prevent submission; any validation error SHALL always block submission to preserve data integrity.
9. WHEN a valid expense form is successfully submitted, THE App SHALL reset the Amount field to empty, the Category field to the unselected placeholder, the Date field to empty, and the Description field to empty.
10. THE Description field SHALL be optional; THE Validator SHALL NOT block submission when the Description field is empty.

---

### Requirement 3: Transaction History

**User Story:** As a user, I want to see a list of all my past transactions, so that I can review my spending history.

#### Acceptance Criteria

1. WHEN the App loads, THE App SHALL retrieve all persisted expenses from Local_Storage and render them in the Transaction_List, ordered by Date (most recent first) unless a stored Sort_Order overrides this default.
2. THE App SHALL display each transaction's Amount, Category, Date, and Description in the Transaction_List.
3. WHEN the user confirms a deletion prompt for a transaction, THE App SHALL remove that Expense from the Transaction_List and from Local_Storage; THE App SHALL NOT remove a transaction unless the user has confirmed the deletion prompt.
4. IF Local_Storage cannot be updated during deletion, THE App SHALL restore the transaction to the Transaction_List and display an inline error message indicating the deletion could not be saved.
5. WHEN a transaction is deleted, THE App SHALL recalculate and update the displayed Balance.
6. WHEN a transaction is deleted, THE App SHALL update the Pie_Chart to reflect the new category totals.
7. IF no expense records exist in Local_Storage, THEN THE App SHALL display the message "No transactions yet. Add an expense to get started." in place of the Transaction_List.
8. WHEN a transaction is deleted and the Transaction_List becomes empty, THE App SHALL replace the list with the empty-state message described in criterion 7.

---

### Requirement 4: Visual Dashboard — Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending per category, so that I can quickly understand where my money is going.

#### Acceptance Criteria

1. THE App SHALL render a Pie_Chart using the Chart.js library loaded via CDN.
2. THE Pie_Chart SHALL display one segment per category that has at least one associated expense with an amount greater than zero, where each segment's arc angle equals (category_total / sum_of_all_positive_expense_amounts) × 360°.
3. WHEN expenses are added or deleted, THE Pie_Chart SHALL update within 1 second without requiring a page reload.
4. IF there are no expenses recorded, or IF all existing expenses have an amount of zero or no category assigned, THEN THE App SHALL display the message "No expense data to display." in place of the Pie_Chart.
5. THE Pie_Chart SHALL display a legend that maps each segment's color to its category name.

---

### Requirement 5: Custom Categories

**User Story:** As a user, I want to add my own expense categories, so that I can organise my spending in a way that suits my needs.

#### Acceptance Criteria

1. THE App SHALL provide a control that allows the user to add a Custom_Category by entering a non-empty name between 1 and 50 characters.
2. WHEN the user adds a Custom_Category, THE App SHALL add the new category to the Category dropdown in the expense form immediately.
3. WHEN the user adds a Custom_Category, THE App SHALL persist the custom categories list to Local_Storage.
4. WHEN the App loads, THE App SHALL retrieve custom categories from Local_Storage and populate the Category dropdown.
5. IF Local_Storage retrieval fails or the stored custom categories data is corrupted, THEN THE App SHALL display an error message and disable the expense entry form until the page is reloaded.
6. IF the user attempts to add a Custom_Category with an empty name, THEN THE Validator SHALL display an inline error and prevent the category from being added.
7. IF the user attempts to add a Custom_Category whose name (case-insensitive) already exists among both default categories and existing custom categories, THEN THE Validator SHALL display an inline error and prevent the duplicate from being added.

---

### Requirement 6: Transaction Sorting

**User Story:** As a user, I want to sort my transactions by amount or category, so that I can find and analyse specific expenses quickly.

#### Acceptance Criteria

1. THE App SHALL provide a Sort_Order control offering at least three options: "Amount: High to Low", "Amount: Low to High", and "Category (A–Z)" (case-insensitive alphabetical order).
2. WHEN the user changes the Sort_Order, THE App SHALL re-render the Transaction_List in the selected order within 100 milliseconds.
3. WHILE a Sort_Order is active, THE App SHALL maintain that Sort_Order when expenses are deleted; WHEN two expenses have equal amounts, THE App SHALL apply Date (most recent first) as a secondary sort key; newly added expenses MAY appear at the end of the Transaction_List until the user manually re-sorts.
4. WHEN the user changes the Sort_Order, THE App SHALL persist the active Sort_Order to Local_Storage before re-rendering the list.
5. WHEN the App loads and a Sort_Order is stored in Local_Storage, THE App SHALL retrieve and apply it to the Transaction_List.
6. WHEN the App loads and no Sort_Order is stored in Local_Storage, THE App SHALL apply "Amount: High to Low" as the default Sort_Order.

---

### Requirement 7: Dark / Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light themes, so that I can use the App comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a Theme toggle control that is keyboard-operable, has a visible focus indicator, and meets WCAG 2.1 Level AA contrast requirements in both themes.
2. WHEN the user activates the Theme toggle, THE App SHALL apply the selected Theme to all rendered elements using a CSS transition with a duration between 150 ms and 400 ms.
3. WHEN the user activates the Theme toggle, THE App SHALL persist the selected Theme preference to Local_Storage.
4. WHEN the App loads, THE App SHALL retrieve the stored Theme preference from Local_Storage and apply it before any page content is painted, so that no flash of a different theme is visible; IF no stored preference exists or Local_Storage is inaccessible, THEN THE App SHALL apply the "light" theme as the default.
5. THE Theme toggle control SHALL have an accessible label that conveys the control's purpose, the current Theme, and the Theme that will be applied when toggled.
6. IF the user has not activated the Theme toggle control during the current session, THEN THE App SHALL NOT write a new Theme value to Local_Storage.

---

### Requirement 8: Semantic HTML Structure

**User Story:** As a developer, I want the HTML to use only semantic elements, so that the page is accessible and standards-compliant.

#### Acceptance Criteria

1. THE App SHALL not use any `<div>` elements anywhere in the HTML document.
2. THE App SHALL always include `<header>`, `<main>`, and `<footer>` as top-level page regions; THE App SHALL use `<section>`, `<article>`, `<figure>`, and `<nav>` only where applicable content warrants their use.
3. THE App SHALL use `<form>`, `<label>`, `<input>`, `<select>`, `<button>` for all interactive form controls; each `<input>` and `<select>` SHALL be programmatically associated with a `<label>` via a matching `for`/`id` pair or by nesting the control inside the `<label>` element.
4. THE App SHALL not use `<span>` as a generic container element; `<span>` is permitted only for inline text annotation where no other semantic inline element applies.

---

### Requirement 9: Single-File Architecture & Technology Constraints

**User Story:** As a developer, I want a single CSS file and a single JavaScript file, so that the codebase is easy to navigate and maintain.

#### Acceptance Criteria

1. THE App SHALL be implemented in exactly three files: `index.html`, `css/style.css`, and `js/script.js`; `index.html` SHALL NOT contain any inline `<script>` blocks with application logic or inline `<style>` blocks.
2. THE App SHALL not use any external JavaScript libraries, frameworks, or utility packages (including but not limited to React, Vue, Angular, lodash, date-fns, jQuery) or external CSS frameworks or utility libraries (including but not limited to Tailwind, Bootstrap, Bulma), with the sole exception of Chart.js.
3. THE App SHALL load Chart.js version 4.x exclusively via a CDN `<script>` tag; Chart.js SHALL NOT be bundled, self-hosted, or loaded from any other source.
4. THE App SHALL use only Local_Storage for data persistence — no server-side calls (including analytics, error logging, or any other purpose), cookies, or IndexedDB are permitted.

---

### Requirement 10: Responsive Design

**User Story:** As a user, I want the App to be usable on both mobile and desktop screens, so that I can track expenses from any device.

#### Acceptance Criteria

1. THE App SHALL implement a mobile-first responsive layout that renders without horizontal overflow, content clipping, or element overlap on viewport widths from 320 px to 1920 px.
2. WHEN the viewport width is below 768 px, THE App SHALL stack all major sections vertically so that content remains readable without horizontal scrolling.
3. WHEN the viewport width is between 768 px and 1024 px (inclusive), THE App SHALL arrange major sections in a two-column layout or an equivalent intermediate layout that avoids both single-column stacking and the full side-by-side desktop layout.
4. THE App SHALL use relative units (rem, %, vw/vh) or CSS custom properties for all width, height, padding, and margin properties that define the layout; fixed pixel values are permitted only for decorative details such as borders and icon sizes.
5. THE App SHALL apply a minimum body font size of 16 px and a minimum secondary text font size of 12 px, and all interactive controls SHALL have a minimum tap-target size of 44 × 44 px on all devices.
