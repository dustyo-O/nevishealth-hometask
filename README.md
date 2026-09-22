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
