# Functional Specification: Clients Data & Dashboard Shell

- **Roadmap Item:** Phase 1 — Clients Data & Dashboard Shell: serve the client data from a small read-only service, and a single "Clients" page that loads it with honest loading and error states.
- **Status:** Draft
- **Author:** Alexander Shleyko
- **Sources:** `context/inbox/clients-data-dashboard-shell.md` (grill decisions D1–D14), `context/product/product-definition.md`, `context/inbox/brief.md`

---

## 1. Overview and Rationale (The "Why")

Advisers and their managers will read the Clients dashboard to see how the book of business develops month by month. Before the chart and the expandable table can exist, three things must be true: the client figures are available from one place that the page — and later a real reporting system — can be asked for; the page tells the truth while it waits for those figures and when it cannot get them; and a reviewer can install, start and check the whole project from the README without guesswork.

This feature delivers exactly that foundation: the project skeleton with its install/start/check commands, the clients data service, and the "Clients" page with its three states — loading, failed, loaded. On success the page shows the design's layout with an honest one-line summary of the loaded data in each card; the next two features replace those summaries with the chart and the table.

Success looks like: a reviewer runs two commands and sees the page; adds one word to the address and sees the loading skeleton, adds another and sees a clear error with a Retry button that works; and the automated checks run green on every proposed change.

---

## 2. Functional Requirements (The "What")

### FR1 — One project, two commands

A developer can install and start the entire project (the page and the data service together) with the two commands documented in the README, and can run every check (code checks and all tests, for the page and for the data service) with one command. The same checks run automatically on every proposed change on GitHub.

- **Acceptance Criteria:**
  - [ ] Given a machine with Node 22 and pnpm, when a developer runs the install command and then the start command from the README, then both the page and the data service start, and opening `http://localhost:5173` shows the Clients page.
  - [ ] When a developer runs the single checks command from the README on the delivered code, then it runs the code checks and all tests for both the page and the data service and finishes reporting success.
  - [ ] When a pull request is opened on GitHub, then the same checks run automatically and their pass/fail result is shown on the pull request.
  - [ ] When a developer opens the README, then they find a "How to run" and a "How to test" section that name these commands and the two local addresses (page and data service). _(The README's assumptions and next-steps sections belong to the Ship-Ready feature.)_

### FR2 — The clients data service

The client figures are published by the project's own data service at a fixed local address, as one document with two parts: the list of the twelve months the figures cover (February 2024 to January 2025, in order), and the company tree exactly as it was supplied — Company, its branches, each branch's advisers, each adviser's acquisition channels, every item carrying its name and its twelve monthly figures. The service is read-only; nothing can be changed through it.

When it starts, the service checks the data it is about to serve: wherever an item's monthly figure does not equal the sum of the items beneath it, it prints a warning naming the item and the month. It still serves the data.

For development and demonstration only, the service can be asked to respond slowly or to fail on purpose by adding `delay` (milliseconds) or `fail=1` to the address. These switches do nothing in the production build.

- **Acceptance Criteria:**
  - [ ] When a tester opens `http://localhost:3000/api/clients` (browser or curl), then they receive one document containing `months` — twelve month identifiers from `2024-02` to `2025-01` in order — and `company` — the company tree.
  - [ ] When a tester compares the `company` part with the supplied dataset (`context/inbox/data.json`), then the names, order, nesting and every figure are identical, and the item nesting is Company → branches → advisers (`employees`) → channels, each item with an identifier, a name and exactly twelve figures.
  - [ ] When a tester opens `http://localhost:3000/api/health`, then they see a document reporting status "ok".
  - [ ] When the service starts with the delivered dataset, then it prints no data warnings.
  - [ ] Given a test dataset in which one item's monthly figure does not equal the sum of the items beneath it, when the service starts with it, then it prints one warning for that item and month, and the data is still served.
  - [ ] When a tester opens `http://localhost:3000/api/clients?fail=1` during development, then they receive an error response instead of the data.
  - [ ] When a tester opens `http://localhost:3000/api/clients?delay=3000` during development, then the response arrives no earlier than 3 seconds after the request.
  - [ ] When the production build of the service is asked with `?fail=1` or `?delay=3000`, then it responds with the data in under 1 second, as if the switches were not there.

### FR3 — Loading state

While the figures are being fetched, the page shows the design's layout in placeholder form: the "Clients" heading, then a chart card and a table card filled with grey placeholder blocks in the positions the real content will occupy. Assistive technology is told the content is loading. When the figures arrive, the placeholders are replaced in place — the page does not jump and does not reload.

- **Acceptance Criteria:**
  - [ ] Given the data service is slow to answer (development switch `delay=3000`), when the user opens the page, then within 1 second they see the "Clients" heading and two grey placeholder cards laid out as in the design, and a screen reader announces "Loading clients…".
  - [ ] When the figures arrive, then the placeholder cards are replaced by the loaded content in the same positions without a page reload and without the content shifting.

### FR4 — Failed state

If the figures cannot be loaded — the data service is unreachable, answers with an error, or answers with a document that does not have the expected shape — the page tries once more on its own, and if that also fails, replaces the two cards with a single error panel: the message "We couldn't load the clients data.", one short line of detail, and a "Retry" button. The error appears within 2 seconds of the failure. Retry fetches the figures again: the placeholders show while it works, then either the loaded content or the error panel again. Nothing else on the page is lost.

- **Acceptance Criteria:**
  - [ ] Given the data service fails on purpose (development switch `fail=1`), when the user opens the page, then within 2 seconds they see, in place of the two cards, "We couldn't load the clients data.", a detail line naming the failure (e.g. "Request failed with status 500"), and a "Retry" button.
  - [ ] Given the data service is stopped, when the user opens the page, then within 2 seconds they see the same error panel with a detail line such as "Network error".
  - [ ] Given the error panel is showing and the problem persists, when the user clicks Retry, then the placeholder cards appear while it retries and the same error panel returns within 2 seconds.
  - [ ] Given the error panel is showing and the problem has been fixed (the service is back, or the failure switch removed), when the user clicks Retry, then the loaded content appears without a page reload.
  - [ ] Given the data service answers with a document of the wrong shape (e.g. an item with eleven figures instead of twelve), when the user opens the page, then they see the error panel with the detail "Unexpected data shape".
  - [ ] When the error panel appears, then a screen reader announces the message without the user moving focus, and pressing Tab reaches the Retry button, and pressing Enter or Space on it retries.

### FR5 — Loaded state (honest placeholders)

When the figures have loaded, the page shows the "Clients" heading and the two cards in the design's layout. Until the chart and the table features replace them, each card shows one line summarising the loaded data: the chart card shows the number of months and the period ("12 months · Feb 2024 – Jan 2025"); the table card shows the top item and the number of branches ("Company · 3 branches"). The summaries are computed from the loaded data, not typed in. Month names are shown as short English month + year ("Feb 2024").

- **Acceptance Criteria:**
  - [ ] When the figures have loaded, then the page shows the "Clients" heading, a chart card reading "12 months · Feb 2024 – Jan 2025", and a table card reading "Company · 3 branches".
  - [ ] Given a test dataset with a different number of branches (e.g. two), when the figures load, then the table card reads "Company · 2 branches".
  - [ ] When the page has loaded, then it does not fetch the figures again on its own (switching to another tab and back triggers no new loading state); only Retry or reloading the page does.

### FR6 — Demonstration switches on the page

During development, the page forwards the two switches from its own address to the data service, so a reviewer can see any state by address alone: `http://localhost:5173/?delay=3000` shows the loading state for at least three seconds; `http://localhost:5173/?fail=1` shows the failed state. The production build ignores both. The README documents them.

- **Acceptance Criteria:**
  - [ ] When a reviewer opens `http://localhost:5173/?delay=3000` in development, then the placeholder cards stay for at least 3 seconds before the content appears.
  - [ ] When a reviewer opens `http://localhost:5173/?fail=1` in development, then the error panel appears.
  - [ ] When the production build of the page is opened with `?fail=1` or `?delay=3000`, then the figures load normally as if the switches were not there.

### FR7 — Nothing breaks at 375 px

In all three states the page stays usable at a 375 px wide viewport: no horizontal scrollbar, no content cut off, the Retry button reachable.

- **Acceptance Criteria:**
  - [ ] When the page is viewed at 375 px wide in the loading, failed and loaded states, then there is no horizontal scrollbar and no text or control is cut off.

---

## 3. Scope and Boundaries

### In-Scope

- The project skeleton: install, start and checks commands; automatic checks on pull requests; the "How to run" / "How to test" sections of the README.
- The clients data service at a fixed local address, serving the supplied dataset (as adjusted in `context/inbox/data.json`) with the month list, read-only, with the start-up consistency warnings and the development-only slow/fail switches.
- The "Clients" page with its loading, failed and loaded states, the Retry action, the honest placeholder summaries, and the development-only switches forwarded from the page address.
- Basic accessibility of the shell: the loading and error announcements, keyboard access to Retry.
- 375 px behaviour of the shell.

### Out-of-Scope

- The stacked monthly chart (roadmap: "Clients Trend Chart") and the expandable monthly table (roadmap: "Monthly Detail Table") — the next two specifications; this feature only leaves their cards in place with summaries.
- The README's assumptions, open questions and next-steps sections (roadmap: "Ship-Ready").
- Working offline, remembering anything between visits, or keeping several devices in step — not a constraint of the brief.
- Refusing to serve data that fails the consistency check (roadmap Phase 2 "Data Consistency Guard") — this feature only warns.
- Sign-in, roles, deployment, hosting, a database, and any filtering or drill-down controls.
- Any other roadmap item.

---

## Change Log

_Dated amendments made after the spec was first written — typically by `/awos:spec` in Update Mode when a bug fix changed documented behavior. Each entry records the date, the source reference (bug id or fix description), and what behavior changed and why. Leave empty until the first amendment._
