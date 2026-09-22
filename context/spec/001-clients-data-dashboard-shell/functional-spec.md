# Functional Specification: Clients Data & Dashboard Shell

- **Roadmap Item:** Phase 1 — Clients Data & Dashboard Shell: serve the client data from a small read-only service, and a single "Clients" page that loads it with honest loading and error states.
- **Status:** Completed
- **Author:** Alexander Shleyko
- **Sources:** `context/inbox/clients-data-dashboard-shell.md` (grill decisions D1–D14), `context/product/product-definition.md`, `context/product/architecture.md` (§1–2 amended 2026-09-21 for the month-list document), `context/inbox/brief.md`

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
  - [x] Given a machine with Node 22 and pnpm, when a developer runs the install command and then the start command from the README, then both the page and the data service start, and opening `http://localhost:5173` shows the Clients page. _(Verified 2026-09-22: verified live: `pnpm install` + `pnpm dev` are running now; `curl localhost:5173` → `<title>Clients</title>`, `curl localhost:3000/api/health` → `{"status":"ok"}`)_
  - [x] When a developer runs the single checks command from the README on the delivered code, then it runs the code checks and all tests for both the page and the data service and finishes reporting success. _(Verified 2026-09-22: verified: `pnpm check` exit 0 — prettier clean, contracts 18, api 69 + build + production smoke, web 48 + Playwright 40)_
  - [x] When a pull request is opened on GitHub, then the same checks run automatically and their pass/fail result is shown on the pull request. _(Verified 2026-09-22: verified: PR #3 check `pnpm check` pass (2m42s), run 35724918486)_
  - [x] When a developer opens the README, then they find a "How to run" and a "How to test" section that name these commands and the two local addresses (page and data service). _(The README's assumptions and next-steps sections belong to the Ship-Ready feature.)_ _(Verified 2026-09-22: verified: README §"How to run" (pnpm install, pnpm dev, :5173, :3000/api/health) and §"How to test" (pnpm check breakdown, per-app scripts, switches))_

### FR2 — The clients data service

The client figures are published by the project's own data service at a fixed local address, as one document with two parts: the list of the twelve months the figures cover (February 2024 to January 2025, in order), and the company tree exactly as it was supplied — Company, its branches, each branch's advisers, each adviser's acquisition channels, every item carrying its name and its twelve monthly figures. A branch may have no advisers and an adviser may have no channels: a missing or empty list beneath an item is valid, and that item is simply the end of its line. The document is of the wrong shape only when the month list or the company is missing, an item lacks its identifier or its name, an item's figures are not exactly twelve numbers, or an item carries more than one kind of list beneath it (an item is a company with branches, a branch with advisers, or an adviser with channels — never two of these at once). The service is read-only; nothing can be changed through it.

When it starts, the service checks the data it is about to serve: wherever an item's monthly figure does not equal the sum of the items beneath it, it prints a warning naming the item and the month. It still serves the data.

For development and demonstration only, the service can be asked to respond slowly or to fail on purpose by adding `delay` (milliseconds) or `fail=1` to the address; with both present, the service waits for the delay and then fails. These switches do nothing in the production build.

- **Acceptance Criteria:**
  - [x] When a tester opens `http://localhost:3000/api/clients` (browser or curl), then they receive one document containing `months` — twelve month identifiers from `2024-02` to `2025-01` in order — and `company` — the company tree. _(Verified 2026-09-22: verified by curl: months 12, 2024-02 → 2025-01, company "Company")_
  - [x] When a tester compares the `company` part with the supplied dataset (`context/inbox/data.json`), then the names, order, nesting and every figure are identical, and the item nesting is Company → branches → advisers (`employees`) → channels, each item with an identifier, a name and exactly twelve figures. _(Verified 2026-09-22: verified by curl + python: deep-equal to context/inbox/data.json = True; walk of all 44 nodes — every node has id, name and exactly 12 values; nesting Company → branches → employees → channels)_
  - [x] Given a test dataset in which one branch has no advisers and one adviser has no channels, when a tester opens the data address, then the document is served with those items simply carrying no list beneath them. _(Verified 2026-09-22: verified: the API boots with `ends-of-lines.json` / `childless.json` injected at CLIENTS_DATA_PATH and serves them — acceptance + fixtures e2e, 18 passed (fresh run))_
  - [x] When a tester opens `http://localhost:3000/api/health`, then they see a document reporting status "ok". _(Verified 2026-09-22: verified by curl: {"status":"ok"})_
  - [x] When the service starts with the delivered dataset, then it prints no data warnings. _(Verified 2026-09-22: verified: production smoke on the built app — "0 discrepancies"; the running dev API logs `Checked 44 nodes: 0 discrepancies`)_
  - [x] Given a test dataset in which one item's monthly figure does not equal the sum of the items beneath it, when the service starts with it, then it prints one warning for that item and month, and the data is still served. _(Verified 2026-09-22: verified: fixtures e2e boots with `broken.json` / `root-broken.json` — Logger.warn called exactly once matching /Anna Blackwood.*2024-04/, data still served)_
  - [x] When a tester opens `http://localhost:3000/api/clients?fail=1` during development, then they receive an error response instead of the data. _(Verified 2026-09-22: verified by curl: HTTP 500, body {"message":"Failing on purpose (?fail=1)","error":"Internal Server Error","statusCode":500})_
  - [x] When a tester opens `http://localhost:3000/api/clients?delay=3000` during development, then the response arrives no earlier than 3 seconds after the request. _(Verified 2026-09-22: verified by curl: HTTP 200 after 3022 ms)_
  - [x] When a tester opens `http://localhost:3000/api/clients?delay=3000&fail=1` during development, then an error response arrives no earlier than 3 seconds after the request. _(Verified 2026-09-22: verified by curl: HTTP 500 after 3020 ms)_
  - [x] When the production build of the service is asked with `?fail=1`, then it returns the normal data document; when it is asked with `?delay=10000`, then the data document arrives without the 10-second wait (the switch is not honoured). _(Verified 2026-09-22: verified: production smoke — `?fail=1` → 200 data, `?delay=10000` answered in 1 ms (switches ignored))_

### FR3 — Loading state

While the figures are being fetched, the page shows the design's layout in placeholder form: the "Clients" heading, then a chart card and a table card filled with grey placeholder blocks in the positions the real content will occupy. Assistive technology is told the content is loading: the region is marked busy at once, and when the wait lasts longer than about a second a screen reader announces "Loading clients…". The announcement waits on purpose — a screen reader spends the first moment after a page opens reading the page itself, and anything said underneath it is lost; a wait shorter than that needs no announcement, because the figures are already there. When the figures arrive, the placeholders are replaced in place — the page does not jump and does not reload, and nothing further is announced.

- **Acceptance Criteria:**
  - [x] Given the data service is slow to answer (development switch `delay=3000`), when the user opens the page, then within 1 second they see the "Clients" heading and two grey placeholder cards laid out as in the design, and the content area is marked as busy. _(Verified 2026-09-22: verified in the browser (docs/screenshots/001-clients-data-dashboard-shell-loading-1440.png): heading + two grey cards at [16,84,1408,430] and [16,530,1408,280], aria-busy="true", 100 placeholder blocks)_
  - [x] Given the data service is slow to answer (development switch `delay=3000`), when the user opens the page with a screen reader running, then it announces "Loading clients…" once the wait passes about a second — after the screen reader's own page-opening announcement — and says nothing further when the figures land. _(Verified 2026-09-22: verified: live-region timeline silent at 0.7 s → "Loading clients…" at 1.4 s → empty once loaded; owner confirmed with VoiceOver ("okay, fix worked, proven by me"))_
  - [x] Given the data service answers quickly, when the user opens the page, then no loading announcement is made (the figures are already on screen). _(Verified 2026-09-22: verified in the browser: plain load → status region stays empty (sampled 1.3 s after the summaries appeared))_
  - [x] When the figures arrive, then the placeholder cards are replaced by the loaded content in the same positions without a page reload and without the content shifting. _(Verified 2026-09-22: verified: same boxes loading and loaded ([16,84,1408,430], [16,530,1408,280]) — no shift, no reload (docs/screenshots/…loading-1440.png vs …loaded-1440.png))_

### FR4 — Failed state

If the figures cannot be loaded — the data service is unreachable, answers with an error, does not answer within 10 seconds, or answers with a document that does not have the expected shape — the page tries once more on its own, starting within half a second of the first failure, and if that also fails, replaces the two cards with a single error panel: the message "We couldn't load the clients data.", one short line of detail, and a "Retry" button. The error appears within 2 seconds of the second attempt failing — so within 3 seconds of opening the page when the service fails at once, and at most about 21 seconds when the service never answers (two 10-second waits). Retry fetches the figures again with the same address switches the page was opened with (changing a switch means changing the address, which reloads the page) and under the same rules — one automatic second attempt, the same 10-second limit per attempt: the placeholders show while it works, then either the loaded content or the error panel again. So a problem that fails at once brings the panel back within 3 seconds of clicking Retry; a service that answers slowly and then fails takes two of its delays; a service that never answers takes about 21 seconds again. Nothing else on the page is lost.

- **Acceptance Criteria:**
  - [x] Given the data service fails on purpose (development switch `fail=1`), when the user opens the page, then within 3 seconds they see, in place of the two cards, "We couldn't load the clients data.", a detail line naming the failure (e.g. "Request failed with status 500"), and a "Retry" button. _(Verified 2026-09-22: verified in the browser: panel in 824 ms with "We couldn't load the clients data." + "Request failed with status 500" + Retry (docs/screenshots/001-clients-data-dashboard-shell-failed-1440.png))_
  - [x] Given the data service is stopped, when the user opens the page, then within 3 seconds they see the same error panel with a detail line such as "Network error". _(Verified 2026-09-22: verified in the browser during slice 3 (API stopped → panel in 1.73 s, detail "Request failed with status 502" through the dev proxy); e2e covers the direct network failure with route.abort → "Network error")_
  - [x] Given the data service accepts the request but never answers (test double), when the user opens the page, then the placeholders stay for about 20 seconds and the error panel then appears with a detail line such as "Request timed out". _(Verified 2026-09-22: verified by e2e `timeout.spec.ts` (hang double → "Request timed out" after ≈20.5 s), part of the 40 passing)_
  - [x] Given the error panel is showing and the problem persists as an immediate failure (`fail=1` or the service stopped), when the user clicks Retry, then the placeholder cards appear while it retries and the same error panel returns within 3 seconds. _(Verified 2026-09-22: verified in the browser: Enter on Retry → aria-busy="true", panel back within 3 s)_
  - [x] Given the error panel is showing because the service answers slowly, when the user clicks Retry with a screen reader running, then it announces "Loading clients…" once that wait passes about a second. _(Verified 2026-09-22: verified at unit level (RTL: Retry silent until its own wait passes, then announces) — no e2e; gap flagged by the lane)_
  - [x] Given the error panel is showing because the service never answers (test double), when the user clicks Retry, then the placeholders stay for about 20 seconds and the same error panel returns. _(Verified 2026-09-22: verified by e2e `timeout.spec.ts` (Retry with the hang still on → ≈20 s again))_
  - [x] Given the error panel is showing because the data service was stopped, when the service is started again and the user clicks Retry, then the loaded content appears without a page reload. _(Verified 2026-09-22: verified in the browser during slice 3: API restarted → Retry → summaries, navigation count unchanged (no reload))_
  - [x] Given the page was opened with `?fail=1` and shows the error panel, when the user clicks Retry, then the request fails again in the same way (the switch travels with Retry) — only opening the address without the switch clears it. _(Verified 2026-09-22: verified in the browser: after Retry location.search is still "?fail=1" and the request fails the same way)_
  - [x] Given the data service answers with a document of the wrong shape (e.g. an item with eleven figures instead of twelve), when the user opens the page, then they see the error panel with the detail "Unexpected data shape". _(Verified 2026-09-22: e2e `error.spec.ts` FR4-AC8 — an item with eleven figures → the panel with "Unexpected data shape"; unit `fetch-clients.test.ts` covers the same parse failure)_
  - [x] Given a test dataset in which a branch has no advisers, when the user opens the page, then the loaded content appears — a missing level beneath an item is not a wrong shape. _(Verified 2026-09-22: verified by e2e `error.spec.ts` FR4-AC9 (childless branch loads))_
  - [x] Given a test dataset in which one item carries two kinds of list beneath it (e.g. a branch with both advisers and channels), when the user opens the page, then they see the error panel with the detail "Unexpected data shape". _(Verified 2026-09-22: verified by e2e `error.spec.ts` FR4-AC10 + contracts test (two lists, one empty → rejected since code review F1))_
  - [x] When the error panel appears, then a screen reader announces the message without the user moving focus, and pressing Tab reaches the Retry button, and pressing Enter or Space on it retries. _(Verified 2026-09-22: verified in the browser: focus stays on BODY when the panel appears, Tab reaches "Retry", Enter retries (focus then moves to the heading by design D-11))_

### FR5 — Loaded state (honest placeholders)

When the figures have loaded, the page shows the "Clients" heading and the two cards in the design's layout. Until the chart and the table features replace them, each card shows one line summarising the loaded data: the chart card shows the number of months and the period ("12 months · Feb 2024 – Jan 2025"); the table card shows the top item and the number of branches ("Company · 3 branches"). The summaries are computed from the loaded data, not typed in. Month names are shown as short English month + year ("Feb 2024").

- **Acceptance Criteria:**
  - [x] When the figures have loaded, then the page shows the "Clients" heading, a chart card reading "12 months · Feb 2024 – Jan 2025", and a table card reading "Company · 3 branches". _(Verified 2026-09-22: verified in the browser: "12 months · Feb 2024 – Jan 2025" and "Company · 3 branches" (docs/screenshots/001-clients-data-dashboard-shell-loaded-1440.png))_
  - [x] Given a test dataset with a different number of branches (e.g. two), when the figures load, then the table card reads "Company · 2 branches". _(Verified 2026-09-22: verified by unit tests (formatBranchCount 3/2/1/0) and e2e `loaded.spec.ts` with a two-branch double)_
  - [x] Given a test dataset whose company has no branches at all, when the figures load, then the table card reads "Company · 0 branches" and no error is shown. _(Verified 2026-09-22: verified by unit tests ("Company · 0 branches", no error) and e2e `loaded.spec.ts`)_
  - [x] When the page has loaded, then it does not fetch the figures again on its own (switching to another tab and back triggers no new loading state); only Retry or reloading the page does. _(Verified 2026-09-22: verified by e2e `loaded.spec.ts` (tab switch with real visibilitychange/focus events → no new request) and the query-client unit test)_

### FR6 — Demonstration switches on the page

During development, the page forwards the two switches from its own address to the data service, so a reviewer can see any state by address alone: `http://localhost:5173/?delay=3000` shows the loading state for at least three seconds; `http://localhost:5173/?fail=1` shows the failed state; `?delay=3000&fail=1` shows the loading state for about six and a half seconds — two attempts of three seconds each, half a second apart — and then the failed state. The production build ignores both. The README documents them.

- **Acceptance Criteria:**
  - [x] When a reviewer opens `http://localhost:5173/?delay=3000` in development, then the placeholder cards stay for at least 3 seconds before the content appears. _(Verified 2026-09-22: verified in the browser: skeleton held ≈4 s under ?delay=4000 before the summaries)_
  - [x] When a reviewer opens `http://localhost:5173/?fail=1` in development, then the error panel appears. _(Verified 2026-09-22: verified in the browser: panel in 824 ms (screenshot above))_
  - [x] When a reviewer opens `http://localhost:5173/?delay=3000&fail=1` in development, then the placeholder cards stay for at least 6 seconds (two delayed attempts) and the error panel then appears within 9 seconds of opening. _(Verified 2026-09-22: verified in the browser during slice 3: skeleton ≈6.5 s then the panel (e2e `switches.spec.ts` asserts it too))_
  - [x] When the production build of the page is opened with `?fail=1`, then the loaded content appears and no error panel is shown; when it is opened with `?delay=10000`, then the loaded content appears without a 10-second wait. _(Verified 2026-09-22: verified: `vite build && vite preview` with ?fail=1&delay=10000 → single request /api/clients with no query, loaded in 622 ms; e2e project `prod` asserts it every run)_

### FR7 — Nothing breaks at 375 px

In all three states the page stays usable at a 375 px wide viewport: no horizontal scrollbar, no content cut off, the Retry button reachable.

- **Acceptance Criteria:**
  - [x] When the page is viewed at 375 px wide in the loading, failed and loaded states, then there is no horizontal scrollbar and no text or control is cut off. _(Verified 2026-09-22: verified in the browser at 375: scrollWidth = clientWidth = 375 in all three states, nothing clipped, Retry inside the viewport; @verify-ui swept 320–1920 and found equal 16 px gutters everywhere (docs/screenshots/…-375.png))_

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

- [2026-09-22] — code review `reviews/code-codex-20260922-1152.md` F2, then the owner's device check with VoiceOver — **FR3: the loading announcement now waits until the wait passes about a second.** The first implementation announced on the next tick after mount; VoiceOver read only its own page-opening announcement ("Clients. You are currently at…") and the live region was never heard. A screen reader is busy for the first moment after a page opens, so an announcement made underneath it is lost. FR3's text and acceptance criteria now separate the visible busy state (immediate) from the spoken announcement (after ~1 s, and not at all for a fast load); FR4 gains the matching criterion for Retry.
