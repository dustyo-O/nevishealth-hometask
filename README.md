# Nevis — Clients dashboard

A single "Clients" page that shows how a book of business develops month by month, served by a
small read-only data service. One pnpm workspace, three packages:

| Package              | What                                                     | Address                            |
| -------------------- | -------------------------------------------------------- | ---------------------------------- |
| `apps/web`           | The page — React 19 on Vite 8, Feature-Sliced Design     | `http://localhost:5173`            |
| `apps/api`           | The data service — NestJS 12 (ESM), read-only REST       | `http://localhost:3000/api/health` |
| `packages/contracts` | The wire types + zod schema both sides share (TS source) | —                                  |

Product and feature documents live in `context/` (`product/` for the what and why, `spec/` for
each feature's functional spec, technical considerations and task ledger).

## How to run

Requirements: **Node 22.23** (`.nvmrc`; anything from 22.22.2 up to, not including, 23 — the API
loads the shared contracts as TypeScript source through Node's built-in type stripping, and jsdom
needs 22.22.2) and **pnpm 10.18** (`packageManager` in `package.json`; `corepack enable` picks it
up).

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts both apps side by side (output is prefixed per package):

- the page at **http://localhost:5173** — Vite proxies `/api` to the data service;
- the data service at **http://localhost:3000/api/health** → `{ "status": "ok" }`.

Other root scripts: `pnpm build` (builds every package), `pnpm format` (Prettier, write mode).

### Motion

Rows slide in and out as they are opened and closed. A viewer whose system is set to reduce
motion sees none of it — the rows simply appear and disappear. That setting is read **once, as
the page starts**: `@formkit/auto-animate` asks the `prefers-reduced-motion` media query when it
initialises and never asks again, so a change made in System Settings applies on the next reload
rather than to the open page.

## How to test

One command runs every check for every package — the same command CI runs on each pull request
(`.github/workflows/ci.yml`):

```sh
pnpm check
```

It runs, in order: `prettier --check .`, then `pnpm check:api` (contracts + API: lint, typecheck,
unit and e2e tests, `nest build`, and a boot smoke that starts the built API under
`NODE_ENV=production` and calls `/api/health`), then `pnpm check:web` (lint, typecheck, unit and
component tests, Playwright e2e against the Vite dev server and against a production build served
by `vite preview`).

The first run needs Playwright's Chromium once:

```sh
pnpm --filter @nevis/web exec playwright install chromium
```

Per-package scripts (run with `pnpm --filter <name> <script>` from the root, or `pnpm <script>` inside
the package):

| Package            | Scripts                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `@nevis/contracts` | `lint`, `typecheck`, `test`, `check`                                                             |
| `@nevis/api`       | `dev`, `build`, `start`, `start:prod`, `lint`, `typecheck`, `test`, `test:e2e`, `smoke`, `check` |
| `@nevis/web`       | `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `e2e`, `check`                           |

Playwright output (traces, screenshots) goes to `docs/screenshots/`, which is git-ignored.

### Development switches

During development the page and the data service honour two query switches, so every state can be
reached by address alone (the page forwards them to `GET /api/clients`; Retry keeps them):

- `?delay=<ms>` — the service answers after the delay, capped at 30 000 ms
  (`http://localhost:5173/?delay=3000` shows the loading skeleton for at least three seconds);
- `?fail=1` — the service answers `500` (`http://localhost:5173/?fail=1` shows the failed state with a
  Retry button within about three seconds — the page makes one automatic second attempt half a second
  after the first failure, then shows the panel);
- both together — wait, then fail (`?delay=3000&fail=1` shows the skeleton for about 6.5 s, then the
  panel).

Each attempt is limited to 10 seconds, so a service that never answers shows the panel after about
21 seconds ("Request timed out"); a stopped service shows it within three seconds ("Network error").

The production builds ignore both switches (`vite build` drops the forwarding; the API only honours
them when `NODE_ENV` is not `production`).

---

## Assumptions, and where we think the brief got it wrong

The brief asked us to say what we assumed and where we think it, the design or the data is wrong. The most useful thing we can tell you is a mistake we made and had to undo.

### We inverted the data requirement, and it took three attempts to get right

The brief says the nesting is deliberately not uniform — Branch 2 and Branch 3 have no employees, only Anna Blackwood has channels — **and that the UI has to handle that**. We read those gaps as defects and generated the missing advisers and channels so the tree was even. That made the data fit the UI instead of the other way round, and quietly deleted the requirement.

It is now served **exactly as supplied**, gaps and all. The table needed no change to cope: it had been built to treat a row with nothing beneath it as a row with nothing beneath it, and simply had never been shown the real payload.

The chart was harder, because our model for it had come from the design's _legend_ rather than from the task, and it could not survive real data — only one adviser in ten records a channel, about a tenth of the company. Two answers were tried and thrown away before the Figma frame settled it:

1. **invent a fourth "Not recorded" category** to hold the 90 % — rejected: it makes the chart nine-tenths grey and invents a category the business does not have;
2. **have the chart follow the table's drill-down**, stacking whatever rows are open — rejected: the design frame shows the bars reaching the **Company row's own figures**, stacked by the three channels.

### Existing clients is derived — this is the assumption to challenge first

The three categories are exhaustive by their own names. "New organic" and "New paid" are the clients newly acquired, which the data records wherever they exist; everyone else is an existing client. So:

```
Existing clients = company total − new organic − new paid
```

Every bar then equals the figure the table shows on its Company row, in all twelve months, using only supplied numbers and inventing nothing. **But it does attribute 225 of February's 250 clients to "Existing" on the strength of what the words mean, not on recorded data.** If the business means something narrower by "Existing clients", this is the first thing to revisit.

### The supplied figures disagree with themselves in seven places

They are served untouched and the table shows stored figures, never recalculated — so the Company row honestly reads 301 for May above branches totalling 279. The data service reports all seven when it starts and serves the data anyway:

| Item           | Month    | Stored | Its children come to |
| -------------- | -------- | -----: | -------------------: |
| Company        | May 2024 |    301 |                  279 |
| Branch 1       | Aug 2024 |    214 |                  216 |
| Anna Blackwood | May 2024 |     31 |                   30 |
| Anna Blackwood | Jun 2024 |     32 |                   33 |
| Anna Blackwood | Jul 2024 |     34 |                   35 |
| Anna Blackwood | Aug 2024 |     38 |                   36 |
| Anna Blackwood | Sep 2024 |     27 |                   28 |

In production this invariant belongs to whatever writes the data, not to a dashboard. We would want the service to refuse figures that do not add up rather than warn about them — but refusing here would have shown you an error page instead of a dashboard.

### The newly acquired are drawn larger than they are

They are 0–2 clients a month against 250 or more: under two pixels, invisible. So a part with clients in it is drawn on a stretched scale — one client four pixels, two about six, tailing off — and **the height it gains is taken from the existing-clients part of the same bar**, so the bar's total still matches the table exactly. It is a deliberate distortion, and worth naming: on that scale two clients look about one and a half times one client, not twice. Every figure you can read — in the tooltip, in the table, to a screen reader — is exact.

### Where the design and the data disagree, the data wins

- The design's chart has visible slices of new clients each month; the supplied figures have almost none, so **our chart looks flatter than the mockup**. The mockup was drawn with different numbers.
- The design's opened table shows Branch 1 at 291 for July where the data says 201, and its January bar reaches about 365 where the company's figure is 350.
- The design only specifies 1440 px. At 375 the name column narrows from 264 to 160 so two whole months fit beside it, and the chart's axis labels thin out — **February is not labelled on a phone**. The exact month is a tap away.

### Smaller calls

- The design photographs advisers; the data has no photographs, so adviser rows show initials in a tinted circle.
- The UI says "Adviser" as the design does; the data's key is `employees`, and the boundary keeps the supplier's name.
- Nothing is remembered between visits — no persistence, no offline story. It is a local, read-only dashboard.
- The chart is company-wide and does not re-scope when you open a row in the table. The design shows no link between them.

## What a screen-reader user hears

The table is an ARIA **treegrid**: each row reports its name, its level, its position among its siblings and whether it is open, and each monthly figure announces the row and the month it belongs to. Every expand and collapse works from the keyboard, and the whole table is a single tab stop with arrow keys inside it.

The chart is a single tab stop too. Left and Right move month by month, announcing the month with all its figures, and the same twelve months are also available as a plain table that is not shown on screen. The drawing itself is hidden from assistive technology so nothing is read twice.

**One thing you will hear that we cannot fix.** VoiceOver repeats _"You are currently on a cell, inside a tree grid. To navigate the cells within this table press Control-Option, and then the Up Arrow…"_ on **every** cell. That is VoiceOver's own instruction hint — Verbosity → Hints → Speak instructions, on by default with a five-second delay — not anything the page sets, and no ARIA suppresses it. The only way to avoid it would be to make the figures non-focusable, which would cost the per-figure announcement of row and month. We judged the announcement worth more than the repetition.

## What we would do next

**Soon**

- **Let the chart follow the drill-down.** Opening a branch and seeing the chart divide into its advisers is the obvious next step, and we prototyped it — the arithmetic works, because every node holds the level beneath it. It is not in the design, which is why it is not here.
- **Make the data service refuse inconsistent figures** rather than warn, once something upstream owns the invariant.
- **Make the accessibility audit a gate.** `axe` already runs over the page in the end-to-end tests; it should fail the build, not just report.
- **Revisit the charting library.** Recharts costs **+92 kB gzip** — measured against this app, more than the rest of it plus React together — and brings Redux Toolkit, immer and d3 with it. For one stacked bar chart that is a lot.

**Later**

- Date-range and branch filters, sorting, and finding an adviser by name — all of which the design shows none of.
- Virtualisation, if a real book of business is thousands of rows rather than twelve.
- A rule for the y-axis at larger numbers: "equal steps of one hundred" renders fourteen ticks at a maximum of 1234.

**Known limits, deliberately left**

- The narrow-screen axis thins its labels to whatever fits; below about 336 px two of them would collide.
- At the very bottom of the page, closing a row moves the view up — the rows beneath no longer exist and the browser has nowhere to hold the old position.
