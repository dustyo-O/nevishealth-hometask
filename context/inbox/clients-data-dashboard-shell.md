# Clients Data & Dashboard Shell — grill notes 2026-09-21

Roadmap Phase 1, group 1 (`context/product/roadmap.md` L13–15). First spec of the project, so it also carries the repo scaffold. Sources: `context/product/{product-definition,architecture}.md`, `context/inbox/brief.md`, `context/inbox/data.json`.

## Decisions

- D1: Scope includes the monorepo scaffold as **slice 0** (runs alone, `developer` lane): pnpm workspace with `apps/web`, `apps/api`, `packages/contracts`; root scripts `check`, `check:web`, `check:api` (lint + typecheck + unit + e2e for the scope — these are the harness gates); GitHub Actions workflow running `pnpm check` on push/PR; `.nvmrc` = 22.
- D2: `GET /api/clients` returns an **envelope**: `{ months: string[12], company: <tree exactly as supplied> }`. `months` are ISO year-months `"2024-02"` … `"2025-01"`. The tree keeps the supplier's structure and keys byte-for-byte (`branches` → `employees` → `channels`, every node `{ id, name, values }`). README line: "we wrapped the payload, we did not change it."
- D3: The API's data file is a copy of `context/inbox/data.json` (`apps/api/src/clients/data/clients.json`), read at boot, served read-only. A boot-time check verifies every parent's `values` equal the sum of its children per month and **logs** each discrepancy; it never alters data and never fails a request (failing is Roadmap Phase 2).
- D4: Dev-only query parameters on the endpoint: `?delay=<ms>` (sleep before responding) and `?fail=1` (respond HTTP 500 JSON error). Disabled outside development.
- D5: The web app, in dev builds only (`import.meta.env.DEV`), forwards `delay` and `fail` from its own URL query string to the API request, so `localhost:5173/?fail=1` demonstrates the error state by URL alone. Documented in the README. Playwright tests do not rely on it — they mock the route.
- D6: Loading state = a **skeleton of the final layout**: the two card regions (chart, table) with grey placeholder blocks, the content region `aria-busy="true"`, a visually-hidden live region announcing "Loading clients…". No layout shift when data lands.
- D7: One TanStack Query feeds the page: `retry: 1`, `staleTime: Infinity`, `refetchOnWindowFocus: false`. The user sees the error within ~1–2 s of a failure.
- D8: Error state = **one panel replacing both cards**: "We couldn't load the clients data." + one technical detail line (HTTP status or error message) + a **Retry** button that calls `refetch` (the skeleton returns while retrying; success replaces the panel). The same panel covers network failure (server unreachable), HTTP errors, and a response that fails the contract schema (detail: "Unexpected data shape").
- D9: Success state in this spec = the "Clients" heading and the two card regions in the design's layout (1440 px reference, nothing overflows at 375 px), each card showing a one-line summary derived from the loaded data as an honest placeholder — chart card: "12 months · Feb 2024 – Jan 2025", table card: "Company · 3 branches". Specs 002 (table) and 003 (chart) replace the placeholders.
- D10: `packages/contracts` exports the TypeScript types **and one zod schema** for the envelope; the web app parses every response with it; the API's tests validate its own output against it. Owned by `nest-backend`; `react-frontend` consumes it read-only.
- D11: Month labels are formatted on the client from the ISO months ("Feb 2024", `en` locale, short month + numeric year). _(assumed)_
- D12: `GET /api/health` → `{ "status": "ok" }` for CI / e2e readiness. _(assumed — tiny; strike if unwanted)_
- D13: Ports: web 5173, api 3000; Vite proxies `/api` → api in dev; api allows the Vite origin via CORS for direct calls. _(assumed, per architecture §3)_
- D14: Trigger = the user opening the page; the fetch starts on mount. No other trigger, no polling.

## Out of scope

- The stacked chart and the expandable table themselves (Roadmap Phase 1 groups 2 and 3 — next two specs).
- Multi-device / offline / persistence of any kind — not a constraint of the brief (owner, 2026-09-21): no localStorage, no PWA cache, no background refetch. Reload = fresh fetch.
- Failing the request when the data is inconsistent (Phase 2 "Data Consistency Guard"); the shell only logs.
- Authentication, deployment, hosting, a database.
- Any filtering, date range or drill-down controls.

## Open risks

- R1: Three-package TypeScript wiring — `packages/contracts` consumed as a workspace dependency by Vite (ESM, browser) **and** Nest (Node) with one `tsconfig` story (project references vs. `exports` + build step). This is the first thing to prove; it decides how every later lane imports types. → slice 0.
- R2: NestJS current major + pnpm workspaces: Nest CLI build output location and Jest config inside a workspace app (not a fresh `nest new`).
- R3: Playwright in GitHub Actions: browser install time and the e2e needing only Vite (route mocked) — keep the API out of the e2e path so CI has one server to wait for.
- R4: Skeleton fidelity — the placeholder card heights are guesses until specs 002/003 exist; small layout shift may appear then and is fixed there, not here.
- R5: `?fail` / `?delay` forwarding must be provably absent from production builds (a unit test on the request builder under `DEV=false`).

## Suggested acceptance criteria

- AC1: `pnpm install && pnpm dev` starts both apps; `curl -s localhost:3000/api/clients` returns JSON whose `months` is 12 ISO strings from `"2024-02"` to `"2025-01"` and whose `company` is deep-equal to `apps/api/src/clients/data/clients.json`.
- AC2: Opening `http://localhost:5173/` first shows the skeleton (content region `aria-busy="true"`, "Loading clients…" announced), then — without a reload — the "Clients" heading and the two cards with summaries derived from the response ("Company · 3 branches", "12 months · Feb 2024 – Jan 2025").
- AC3: `http://localhost:5173/?fail=1` shows the error panel with "We couldn't load the clients data.", a detail line, and a Retry button within 2 s; when the failure is removed (e2e: route mock switched to success) and Retry is clicked, the success state appears without a reload.
- AC4: With the API process stopped, the page shows the same error panel; after starting the API, Retry recovers.
- AC5: A response that violates the contract (e.g. a node with 11 values) produces the error panel with the detail "Unexpected data shape".
- AC6: The API's boot check logs one warning per discrepancy for a deliberately broken fixture and nothing for the shipped data (Jest).
- AC7: `pnpm check` (lint, typecheck, unit, e2e) is green locally and in the CI run on the PR.
- AC8: Nothing overflows horizontally at a 375 px viewport in the loading, error and success states (e2e asserts `document.documentElement.scrollWidth <= 375`).

## Terminology

- **Envelope** — the API response object `{ months, company }`. **Tree** — the supplied `company` object and its descendants. **Card** — one of the two bordered regions in the design (chart, table). **Shell** — the page frame plus its three states, before the widgets exist.
