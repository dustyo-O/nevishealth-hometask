# System Architecture Overview: Nevis Book-of-Business Dashboard

_Specialist coverage for this stack is recorded in `context/product/hired-agents.md` (owned by `/awos:hire`)._

_Inputs: `context/product/product-definition.md`, `context/product/roadmap.md` (Phase 1), owner's technical notes in `context/inbox/brief.md`. A local-only take-home: one repo, two apps, no cloud. Every choice below is sized for 6–8 hours and for the two things reviewers will read closely — the accessible tree table and the component boundaries._

---

## 1. Application & Technology Stack

- **Repository shape:** pnpm workspace monorepo (Node 22, pnpm 10). `apps/web` (UI), `apps/api` (REST API), `packages/contracts` (the API's response types, shared by both so the wire shape is written once). One `pnpm dev` starts both; one `pnpm test` runs everything.
- **Frontend framework:** React 19 + TypeScript (strict) on Vite 8. No SSR — a single authenticated-free dashboard page; client rendering keeps the build trivial and the tests fast.
- **Frontend structure:** Feature-Sliced Design (`app / pages / widgets / features / entities / shared`), one slice per business concept, public API via `index.ts`, imports only downward. Enforced by ESLint (`@feature-sliced/eslint-config` or `eslint-plugin-boundaries`) so the "clear boundaries" claim is checked, not asserted.
- **Styling:** CSS Modules + design tokens as CSS custom properties (`shared/styles/tokens.css`, values taken from the Figma variables: surface `#f8f6f1`-family background, purple / pink / plum channel colours, Inter Display). No Tailwind, no runtime CSS-in-JS.
- **Server state:** TanStack Query v5 — `useQuery` for the clients tree gives loading / error / retry for free and makes the "honest states" requirement a hook call, not hand-rolled state.
- **UI state:** React state only (expanded row ids live in the tree-grid hook). No global store — the page has one dataset and one interaction. _(Spec 004 briefly amended this for a chart that followed the table's drill-down; the design proved that model wrong and the amendment is withdrawn, 2026-09-23.)_
- **Component library:** **none for the core; build the tree grid ourselves.** Evaluated: Radix has no table/treegrid primitive; React Aria's `Tree` is a single-column `role="tree"` of `div`s and its `Table` has no expandable rows. The expandable monthly table is exactly the component the brief grades ("composable, clear boundaries", "hierarchy reaches AT"), so it is hand-built to the WAI-ARIA APG **TreeGrid** pattern (`role="treegrid"` on a real `<table>`, rows with `aria-level` / `aria-expanded` / `aria-setsize` / `aria-posinset`, roving `tabindex`, ↑↓ between rows, → expand / ← collapse or go to parent, Home/End, Enter/Space toggle). _(Alternative kept in reserve: Radix `Collapsible`/`VisuallyHidden` for small helpers — adopted only if a concrete need appears.)_
- **Announcements to assistive technology:** a live region reports *changes*, so it is mounted empty and filled later — and the update waits **1 s** (`LOADING_ANNOUNCE_DELAY_MS`): a screen reader spends the first moment after a page opens reading the page itself, and anything said underneath is lost (proven with VoiceOver, spec 001 FR3 amended 2026-09-22). A state that resolves faster than that is not announced at all. The visible signal — `aria-busy`, the skeleton — stays immediate.
- **Keyboard navigation:** a small `useRovingTabIndex` hook inside the tree grid (~50 lines, fully covered by tests). Considered `react-aria`'s `useFocusManager`/`FocusScope` and `@radix-ui/react-roving-focus`; neither knows tree semantics (→/← as expand/collapse vs. move), so they would sit beside our own key handling rather than replace it.
- **Charting:** Recharts 3 — `BarChart` with three stacked `Bar`s (`stackId`). **Recharts' `Tooltip` is not used either** (amended 2026-09-23, spec 003 slice 3): once the hover tint and the panel's text both had to come from our own state, it carried no content and still brought state that contradicted ours — a "dismissed" flag tied to a coordinate, so Escape then Right at the last month stayed hidden. The panel is our own HTML inside the `aria-hidden` wrapper, placed by a pure `plot-geometry` module. Data mapping is a pure function in the `entities` layer (`toMonthlySeries(tree)`), unit-tested independently of Recharts. A visually-hidden summary table backs the chart for screen readers.
  - **`accessibilityLayer` is off, and the keyboard layer is ours** (amended 2026-09-23, spec 003; measured in Recharts 3.10.1, `context/spec/003-clients-trend-chart/consults/react-frontend-chart-sections-20260922-234604.md` Q2). The stock layer is one tab stop and clamps at both ends correctly, but Escape hides its tooltip and leaves the cursor tint behind; leaving and re-entering resumes at the remembered month instead of the first; its tooltip carries no total; and the chart's accessible name is computed from its contents, so it reads out as every month label followed by every axis number. There is no prop to reset its index. So the drawing is wrapped in `aria-hidden`, and a focusable element around it owns the roving month, the arrow keys, Escape and a polite live region — about 60 lines, all testable as a pure reducer.
  - **The legend is plain HTML, not `<Legend/>`** (same source, Q3): Recharts' legend wraps to two lines at 375 px and steals 20 px from the plot, which would break the requirement that the plot keeps its height at every width. As HTML it also cannot be clicked into hiding a series, which is what the spec asks for.
- **Backend framework:** NestJS 12 (ESM-only) in TypeScript. A `ConfigModule` provides and exports `API_CONFIG` and is imported by both `AppModule` and `ClientsModule` — `@UseInterceptors` resolves its instances in the *controller's* module, so a provider registered only in `AppModule` is invisible to the interceptor. Then one module (`clients`), one controller (`GET /api/clients`), one service behind a `ClientsRepository` type whose only implementation reads `data.json` — so Phase 3's live source is a new provider, not a rewrite. Optional `?delay=ms` / `?fail=1` query params on the endpoint in dev to demo loading and error states.
- **Shared contracts:** `packages/contracts` exports the TypeScript types of the wire format (as `type` aliases — the project prefers types over interfaces everywhere), one `zod` schema for it, the `MONTHS` constant and `childrenOf(node)` (the single definition of "children" shared by the API's consistency check and the UI's flatten). It ships as **TypeScript source** (`exports` → `src/index.ts`, no build step): Vite/Vitest transpile it, `tsc` type-checks it, and the built API loads it through Node's built-in type stripping (Node ≥ 22.18; `engines` + `engine-strict` enforce it; contracts stays erasable TS via `erasableSyntaxOnly`). Decided in spec 001 (D-2). The response of `GET /api/clients` is an **envelope** `ClientsResponse { months: string[12], company: TreeNode }` (spec 001, D2): `months` are ISO year-months `"2024-02"` … `"2025-01"` — the axis the supplied data lacks — and `company` is the supplied tree unchanged (`TreeNode { id, name, values: number[12], branches? | employees? | channels? }`; a missing or empty child list is a leaf). The client parses every response with the schema; the API's tests validate its output against it.

---

## 2. Data & Persistence

- **Primary data store:** a JSON file (`apps/api/src/clients/data/clients.json`, copied from `context/inbox/data.json`) loaded at boot. No database — the brief supplies a fixed payload; a DB would be ceremony.
- **Data shape:** the supplied tree, structure unchanged: `Company → branches[] → employees[] → channels[]`, every node `{ id, name, values[12] }`. The API serves the tree as-is as the `company` field of the `{ months, company }` envelope (see §1 Shared contracts); naming stays the supplier's (`employees`), the UI labels it "Adviser".
- **Consistency invariant:** the API checks on boot that every parent's `values` equal the sum of its children's, per month, and logs any discrepancy (Roadmap Phase 2 "Data Consistency Guard" — the check is cheap, so the log line ships in Phase 1; failing the request on discrepancy is the Phase 2 decision).
- **Caching:** TanStack Query's in-memory cache on the client (`staleTime` long — the data changes monthly). No server cache; the payload is ~10 KB.
- **Derived data on the client:** `entities/clients/model` owns the pure transforms — flatten tree to rows with level/parent, `toMonthlySeries` for the chart (company-level channel split = sum over the tree), month labels. Pure functions → Vitest.

---

## 3. Infrastructure & Deployment

- **Runtime target:** local machine only. `pnpm i && pnpm dev` → Vite on `:5173` proxying `/api` to Nest on `:3000`. No Docker, no hosting (out of scope per the product definition).
- **Build:** `pnpm build` produces `apps/web/dist` (static) and `apps/api/dist` (Node). Not deployed; exists so CI proves it compiles.
- **CI:** one GitHub Actions workflow (`lint`, `typecheck`, `test`, `e2e` with Playwright's Chromium) on push and PR. The same commands are the harness gates in `harness.json`.
- **Tooling:** TypeScript **6.0.x pinned** (7.x is the native compiler without a JS API; typescript-eslint and the Nest CLI need 6), strict everywhere, ESLint **10** flat config (9 is EOL; `jsx-a11y` via a pnpm peer override; FSD boundaries with `@conarti/eslint-plugin-feature-sliced`), Prettier, `.nvmrc` = 22.23, `engines` pinned (`>=22.22.2 <23`). Convention: `type` aliases over `interface`.

---

## 4. Testing & Quality

- **Unit / component (Vitest + React Testing Library + `@testing-library/user-event`, jsdom):** tree-grid keyboard model (every key in the APG table), expand/collapse state, ARIA attributes per row, `toMonthlySeries` mapping, month labelling. `jest-axe` on the rendered table and chart.
- **End-to-end (Playwright, `@playwright/test`):** starts **its own Vite server on port 5273** (`reuseExistingServer: false`) — never the developer's 5173: with reuse, a running dev server is used instead of the checkout under test, which once made a lane's gate green against the wrong tree; a clash on 5273 now fails loudly. The API is **mocked by `page.route(url => url.pathname === '/api/clients', …)`** using a fixture derived from `data.json` — match on the pathname, **never** the glob `**/api/clients**`, which in dev also matches Vite's module URL `/src/entities/clients/api/…` and answers JSON to a module request. Deterministic and independent of Nest. Covers: expand/collapse by mouse and keyboard, the hierarchy as exposed to AT (`getByRole('treegrid')`, `row` with `aria-level`), loading and error → retry states, chart bars/legend present with correct segment count, and a 375 px viewport check for horizontal overflow. `@axe-core/playwright` audit on the dashboard.
- **API (Vitest + supertest — Nest 12 is ESM-only and Jest cannot load it on Node 22, spec 001 D-1):** `GET /api/clients` returns the envelope with 12 values per node; consistency check passes on the shipped data; dev switches gated off in production. Plus a **build-and-boot smoke** (`apps/api/scripts/smoke.mjs`): it runs `dist/main.js` under `NODE_ENV=production` on a free port and asserts health, the envelope against the asset-copied JSON, and that the switches are ignored — the only check that proves the built app boots and that `packages/contracts` loads as TypeScript source under Node's type stripping.
- **Gates:** `pnpm check` at the root = `prettier --check .` + `pnpm check:api` (contracts and API: lint, typecheck, tests, `nest build`, the boot smoke) + `pnpm check:web` (lint, typecheck, Vitest, Playwright incl. the `prod` project). A lane runs its own (`check:api` / `check:web`, per `harness.json → lanes.<agent>.gate`); the lead runs `pnpm check` on the merged tree. Green before any lane reports done.

---

## 5. External Services, Observability & Security

- **Authentication:** none (out of scope; everyone sees everything).
- **External services:** none at runtime. Figma is a design-time input only (tokens, measurements).
- **Logging:** Nest's built-in logger (request log + the consistency warnings). Client: a React error boundary around the dashboard rendering the same error UI as a failed fetch.
- **Metrics / tracing:** none — local tool. Phase 3's live data source is where this would arrive.
- **Security:** CORS limited to the Vite origin in dev; API is read-only; no secrets in the repo (the `.env` deny rules from the harness stay in force even though nothing needs one).

---

## 6. Frontend Layout (FSD) — the map lanes will work from

```
apps/web/src/
  app/                 entry, providers (QueryClientProvider, ErrorBoundary), global styles, tokens
  pages/dashboard/     the "Clients" page: composes the two widgets, owns the loading/error/retry states
  widgets/
    clients-chart/     Recharts stacked bar + legend + hidden summary table; takes MonthlySeries
    clients-table/     the monthly tree table: binds entities data to the TreeGrid, row name cell (level, chevron, avatar)
  features/
    expand-row/        (only if a feature-level slice earns its keep; otherwise expansion state stays in TreeGrid)
  entities/clients/    types re-exported from @contracts, `api` (fetch + zod parse), `queries` (TanStack), `model` (flatten, toMonthlySeries, MONTHS)
  shared/
    ui/tree-grid/      headless `useTreeGrid` + `useRovingTabIndex`, compound components TreeGrid / TreeGrid.Row / TreeGrid.Cell / TreeGrid.Toggle — no business knowledge
    ui/                Button, VisuallyHidden, Spinner, ErrorMessage, Avatar
    api/               http client, error type
    styles/            tokens.css, reset
apps/api/src/
  clients/             clients.module, clients.controller (GET /api/clients), clients.service, clients.repository (interface + json impl), data/clients.json, consistency.ts
packages/contracts/    types + zod schema for the wire format, MONTHS
```

**Boundary rules that reviewers can check:** `shared/ui/tree-grid` knows nothing about clients, months or channels (it takes rows with `id`, `parentId`, `level`, `hasChildren` and renders what it is given). `entities/clients` knows the data but no DOM. `widgets` are the only place the two meet — at runtime: `entities/clients` names the tree-grid's row *type* (type-only, a lower layer, so legal under FSD) so its flattened rows are tree-grid rows by construction (005 app F7). The API and the UI share one type definition and nothing else.
