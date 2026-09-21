# Product Definition: Nevis Book-of-Business Dashboard

- **Version:** 1.0
- **Status:** Proposed
- **Sources:** Nevis frontend take-home brief and data model (verbatim in `context/inbox/brief.md`, payload in `context/inbox/data.json`), Figma "Web engineer home task" (screenshots in `context/inbox/design/`). Anything marked _(assumption)_ was decided by us where the brief is deliberately open and must appear in the README's "assumptions and open questions".

---

## 1. The Big Picture (The "Why")

### 1.1. Project Vision & Purpose

Give advisers and their managers one place to see how their book of business — the number of clients — develops month over month, and let them drill from the whole company down to a single branch, adviser or acquisition channel without exporting to a spreadsheet.

### 1.2. Target Audience

Client-facing financial advisers at Nevis and the people who manage them (branch and regional managers). Domain experts, not data analysts: they want "how are we doing, and who or what is driving it" at a glance, on a laptop, occasionally on a phone.

### 1.3. User Personas

- **Persona 1: "Maya, branch manager"**
  - **Role:** Runs a branch with a handful of advisers; reports upward on growth.
  - **Goal:** See her branch's client numbers against the company, and find which adviser explains a good or bad month.
  - **Frustration:** Today the answer lives in a monthly spreadsheet someone else assembles; by the time she has it, it is stale and she cannot ask a follow-up question.

- **Persona 2: "Daniel, adviser"**
  - **Role:** Owns a book of clients; acquires new ones through several channels.
  - **Goal:** See his own clients month by month, and how many are existing versus newly acquired organically or through paid channels.
  - **Frustration:** Company-wide reports bury his numbers; he wants to reach his own row in two clicks.

### 1.4. Success Metrics

- A manager can answer "how many clients did branch X have in month Y, and who contributed?" in under a minute, using only the dashboard.
- Chart and table always agree: a number read in the table is the number shown in the chart for the same month.
- A keyboard-only user, and a screen-reader user, can expand and collapse every level and always know which level they are on.
- Nothing breaks or overflows at 375 px wide.
- _(take-home framing)_ A reviewer runs and tests the project from the README in two commands, and every open call we made is written down with its reasoning — including where we think the brief or design is wrong.

---

## 2. The Product Experience (The "What")

### 2.1. Core Features

- **Clients trend chart** — a stacked bar per month, Feb 2024 to Jan 2025, y-axis in clients; each bar is stacked by acquisition channel (Existing clients / New organic / New paid) as in the design, with a legend beneath the chart.
- **Monthly detail table** — one column per month, one row per node of the hierarchy. The Company row is expanded on load, showing the branches; a branch expands to its advisers; an adviser expands to their acquisition channels (leaf rows). Rows collapse again.
- **Non-uniform hierarchy handled gracefully** — every branch in the served data now has advisers and every adviser has channels, so every non-leaf row expands as the design shows; but the brief says nesting is not uniform, so a node without children is still rendered as a leaf: it shows its numbers and offers nothing to expand.
- **Honest loading and error states** — the dashboard says when data is loading and when it failed, with a retry, rather than showing an empty chart.
- **Accessible by default** — every expand/collapse works from the keyboard; the tree structure and each row's level and state reach assistive technology; focus is visible.

### 2.2. User Journey

Maya opens the dashboard and lands on "Clients": a stacked bar chart of the last twelve months and, beneath it, the table with Company already expanded to its three branches. She spots the Aug 2024 peak and the drop in Sep. She expands Branch 1 and sees the five advisers; she expands Anna Blackwood and sees that nearly all of Anna's clients are existing ones, with a few new organic and new paid each month. She collapses back to Branch 1, then to Company. Throughout, the chart shows the same totals as the table. If the data cannot be loaded, she sees a clear message and a retry button instead of a blank screen.

---

## 3. Project Boundaries

### 3.1. What's In-Scope for this Version

- A single "Clients" dashboard page matching the Figma design (Mockup 2, 1440 px; chart node `1-2781`) and the behaviour of its prototype, with the table rows, levels and states from the design's components. Fidelity is "closely match", not pixel-strict: behaviour first.
- The stacked bar chart over the twelve months, driven by the served data.
- The hierarchical table (Company → Branch → Adviser → Channel) with expandable rows, keyboard-operable and exposed to assistive technology; Company expanded on load.
- The payload (`context/inbox/data.json` — the supplied data, structure unchanged, made internally consistent and completed; see `context/inbox/brief.md` "Data adjustments") served from a small REST API; loading and error states handled in the UI.
- Component APIs designed as on a real team — composable, with clear boundaries — this is a stated review criterion.
- Automated UI tests covering at least expand/collapse behaviour and how data maps into the chart.
- Nothing breaks or overflows down to 375 px (full responsiveness is not required).
- A short README: how to run and test, assumptions and open questions, what we would do next.

### 3.2. What's Out-of-Scope (Non-Goals)

- Sign-in, roles, or per-user visibility (everyone sees everything).
- Editing, importing or exporting data; the API is read-only over the fixed payload.
- A database, persistence or a live feed.
- Full responsive layouts; anything beyond "nothing breaks at 375 px".
- Filters beyond the drill-down (date ranges, search, comparisons) — the design shows none.
- Sorting the table, multiple currencies, localisation, printing, PDF export.
- Deployment or hosting; the deliverable runs locally.

---

## 4. Open Questions and Calls We Made

Resolved by the data model, the design and the owner's decisions (2026-09-21):

- **Metric:** a count of clients. **Hierarchy:** one nested tree Company → Branch → Adviser (`employees` in the data) → Acquisition channel (`channels`). **Period:** Feb 2024 – Jan 2025.
- **What the chart stacks by:** acquisition channel, as the design's legend says. The supplied data only had channels for one adviser, so we generated channels for every adviser (and advisers for Branch 2 and 3) — the company-level channel split is now the sum of the tree. _(README: "we completed the data rather than change the chart".)_
- **Stored totals vs. sum of children:** the supplied data had two typos and one drift that made parents disagree with children. We fixed them (Maria May 22 → 44 and consequently Branch 1 May 156 → 178; Robert Chen Aug 58 → 56; Anna's "Existing clients" absorbs her channel drift), so every parent equals the sum of its children in every month. The original payload is kept for the README. _(README: list each change; note that in production the API, not the UI, should own this invariant.)_
- **Design vs. data typos** (opened mockup: Branch 1 Jul 291 vs 201; chart Jan bar ≈365 vs 350): not strict — data wins, behaviour must work as expected, structure is kept.
- **Chevrons on Branch 2/3:** they are expandable rows; the data now gives them advisers.
- **Terminology:** UI copy follows the design — "Adviser"; the data key stays `employees` at the API boundary.
- **Time budget:** 6–8 hours, "ship the parts that matter most" — priority order: accessible expandable table → chart → API + loading/error states → tests → README.

Still open — for the grill / spec:

1. **Prototype behaviour.** Mockup 1 is a link to the interactive prototype (see `context/inbox/brief.md`). Someone must play it and note: does the whole row toggle or only the chevron; is there an animation; hover treatment; what happens to the chart when rows expand (the design suggests the chart is company-level and independent of the table).
2. **Does the chart follow the drill-down?** The brief's "drill from the whole company down to …" is satisfied by the table; whether the chart re-scopes to a selected branch/adviser is a possible enhancement, not shown in the design.
