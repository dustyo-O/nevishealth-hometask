# Component Review — entities, features, pages, API (react-frontend)

## Verdict

This slice is mostly in good shape. `entities/clients` is almost all pure functions: one file per job, each a screen or less, each tested on its own, and none touches the DOM. The API is textbook small NestJS: a controller that passes through to a service, a repository behind a symbol, the dev switches in one interceptor, and the consistency check as pure functions with the logger injected. `apps/web/src/features/` does not exist (`find` → "No such file or directory"), which is correct. Architecture §6 says `expand-row` exists "only if a feature-level slice earns its keep", and it didn't. No `interface` appears anywhere in the slice (`grep -rnw interface apps/api/src apps/web/src/entities apps/web/src/pages` → nothing). The findings below are leftovers from the slice-by-slice build: one dead export kept alive by its tests, one skeleton that never moved to its widget, one line of logic repeated in three components, one page that holds a timer effect a reader has to decode, and one dead config field. None needs more than about 30 minutes, and none contradicts a functional spec.

## Findings (most visible first)

### F1 — `formatBranchCount` survives only because of its own test
- `apps/web/src/entities/clients/model/summaries.ts:1-13`, exported at `entities/clients/index.ts:8`, tested in `model/summaries.test.ts:1-25`.
- `grep -rln formatBranchCount apps/web/src apps/web/e2e` returns only `summaries.ts` and `summaries.test.ts`. No component calls it.
- It was the table card's placeholder, `"Company · 3 branches"`. Its own doc comment says "The table card's honest placeholder until spec 002" (`summaries.ts:9`). Spec 002 replaced it: 002 functional-spec l.147 says "the table simply takes the place of the summary line". The page test even asserts that the string is gone (`dashboard-page.test.tsx:33,211`).
- **What a reader struggles with:** the entity's public API offers a formatter for UI that doesn't exist, and a first-time reader will look for its caller.
- **Spec note:** the 003 tech doc says "`formatBranchCount` stays" (`003/technical-considerations.md:134`, `003/tasks.md:30`). That is a tech-doc note from before the table landed, not a functional requirement. No functional-spec AC needs the string rendered today (001 FR5-AC1–3 were superseded by 002). The lead should amend that tech-doc line in the same commit.
- **Fix:** delete `summaries.ts`, `summaries.test.ts`, the `index.ts:8` export and the `BRANCHES` negative assertion if the lead wants it gone (it is harmless to keep). About 5 minutes, no risk.

### F2 — The table's skeleton still lives in the page, while the chart's lives in its widget
- `apps/web/src/pages/dashboard/ui/table-card-skeleton.tsx:1-33` and `.module.css:1-64`, used at `dashboard-page.tsx:10,87`. For comparison, `ClientsChartSkeleton` comes from `@/widgets/clients-chart` (`dashboard-page.tsx:2,84`).
- The file says it should not be here. Its comment at `table-card-skeleton.tsx:11` reads "Spec 002 replaces this file with the table widget's own skeleton". The 001 tech doc says "deleted by 002/003 (each widget owns its skeleton)" (`001/technical-considerations.md:119`). 003 did this for the chart (`003/tasks.md:30`, `git mv`); 002 never did it for the table.
- **What a reader struggles with:** the page renders `<ClientsChartSkeleton/>` next to `<TableCardSkeleton/>`, with two naming schemes and two owners for the same idea. The table's geometry (264 px name cell, 28 px indent, 56 px rows) is written twice: once in the page's CSS and once in the widget's.
- Minor, same file: `cx(styles.row, styles.header)` at `table-card-skeleton.tsx:15` references a `.header` class that the stylesheet doesn't define (`grep header table-card-skeleton.module.css` → nothing), so it resolves to `undefined` and `cx` drops it.
- **Fix:** `git mv` both files to `widgets/clients-table/ui/clients-table-skeleton.{tsx,module.css}`, export `ClientsTableSkeleton`, and update two lines in the page. Drop the `.header` reference. About 10 minutes, low risk. The page tests find placeholders by the `Skeleton` class (`dashboard-page.test.tsx:85-86`), so they need no change. The widget's own files belong to the table-widget reviewer, so the lead should coordinate with that report.

### F3 — "Read the switches once, then query" is repeated in three components, and the page's data never reaches the widgets
- The same two lines appear in `dashboard-page.tsx:33-35`, `widgets/clients-table/ui/clients-table.tsx:23-24` and `widgets/clients-chart/ui/clients-chart.tsx:93-94`:
  `const [switches] = useState(() => readDevSwitches(window.location.search)); … useClientsQuery(switches)`
- The page already holds `data` and mounts the widgets only when it has it (`dashboard-page.tsx:84,87`). Each widget then re-derives the query key from `window.location` and handles `data === undefined` again (`clients-table.tsx:26-28`: "the belt to that braces").
- **What a reader struggles with:** the dev-switch rule, "read once, carry in the key so Retry reuses it" (tech doc D-6), is enforced by convention in three places. If one of them drifts (say a widget calls `useClientsQuery()` with no argument), it quietly subscribes to a different cache entry, `['clients', {}]` against `['clients', {fail:'1'}]`. That widget then never gets the page's data under `?fail=1`/`?delay=`, and no type catches it.
- **Seam, cheapest first:**
  1. In the entity, have `useClientsQuery()` take no arguments and read the switches itself. Its body would be `const [switches] = useState(() => readDevSwitches(window.location.search))` followed by `useQuery(clientsQueryOptions(switches))`. The three call sites become one line each. About 15 minutes, low risk. `clientsQueryOptions(switches)` stays for the tests that seed the cache (`clients-chart.test.tsx:55`).
  2. Alternatively, the widgets take `data` as a prop and the page passes it. That is the more "composable" API: the widgets become pure views, and the `null` guard and the switch reading leave them. But it changes both widgets' signatures and their tests, and the 002 tech doc explicitly says the widget "Owns: `useClientsQuery`" (`002/technical-considerations.md:87`). This is a tech-doc decision, not a functional-spec one, but it touches the other reviewers' files. About 45 minutes. I'd call it risky this late; option 1 is what I'd recommend.

### F4 — The page renders and also runs a timer state machine inline
- `dashboard-page.tsx:36-56`. The page decides three things before it renders:
  - (a) the view, from TanStack's `data`/`status`/`isFetching` (l.39, with a 3-line comment about query-core 5.103 internals);
  - (b) a delayed-announcement flag, from `useState` plus a `useEffect` whose cleanup resets it (l.48-56, with a 6-line comment);
  - (c) Retry's focus handling (l.60-63).
- It then renders three layouts. The component is 94 lines, but about 30 of them are comments explaining (a) and (b).
- **What a reader struggles with:** reading the JSX means first understanding why `announced` resets in a cleanup, and why `status === 'error' && !isFetching` is needed on top of `data`. Both are real, spec-driven subtleties (001 FR3 amended 2026-09-22; tech doc D-11), and both are testable on their own.
- **Seam:** extract `useDelayedFlag(active, ms)` (b) into `pages/dashboard/model/`, not `shared/lib`: it has one caller, so putting it in shared would create the Q3 problem. Optionally, a `toView(query)` pure function for (a). The page then reads as "state → one of three layouts". The existing page tests already cover both behaviours with fake timers (`dashboard-page.test.tsx:239-300, 379-406`), so no new tests are needed. About 20 minutes, low risk.
- **Small extra:** the test mirrors the constant as `ANNOUNCE_DELAY_MS = 1000` (`dashboard-page.test.tsx:37`). If the hook file exports `LOADING_ANNOUNCE_DELAY_MS`, the test can import it instead.

### F5 — `ApiConfig.isProduction` is never read
- Declared at `apps/api/src/config.ts:5` and set at `:27`. The only other occurrence in `apps/api` (src, test and scripts) is the interceptor spec's fixture (`clients/dev-switches.interceptor.spec.ts:11`, `isProduction: !enabled`). Everything that depends on production is already derived into `devSwitches.enabled` and `corsOrigin` inside `loadConfig`.
- **What a reader struggles with:** a config field suggests a consumer somewhere, and there isn't one.
- **Fix:** remove the field and the fixture line. About 3 minutes, no risk. It is `nest-backend`'s file.

### F6 (minor) — The entity's public API is wider than its consumers
- `entities/clients/index.ts` exports `CLIENTS_PATH`, `buildClientsUrl`, `fetchClients`, `FetchClientsOptions` and `ClientKind`. None of them is imported outside the slice: grep finds them only in their own files, their tests and `clients-query.ts`. `buildClientsUrl` also has a test that imports the file directly, not through the index.
- **What a reader struggles with:** the index is supposed to say what the slice offers, and today it lists internals too.
- **Fix:** trim these five exports. About 2 minutes, no risk. Optional.

### F7 (minor, note only) — The entity imports a type from `shared/ui`
- `entities/clients/model/flatten-rows.ts:2` does `import type { TreeGridRow } from '@/shared/ui/tree-grid'`. The FSD direction is legal (entities → shared), and it is type-only. But §6 says widgets are "the only place [shared/ui/tree-grid and entities/clients] meet", and this is a second meeting point.
- The rows are a list flattened for the tree-grid, so the coupling is honest. TypeScript's structural typing would let `ClientRow` declare its own six fields and drop the import.
- I would **leave it**. The current form documents the intent ("a tree-grid row plus…", l.17), and changing it buys purity at the cost of duplicated fields. Mention it only if another reviewer raises the same boundary.

## Leave this alone
- **`entities/clients/model/*`**: `flattenVisibleRows` (59 lines, one depth-first walk, one job), `toMonthlySeries` (pure, groups by channel name for a reason documented at l.31-36), `formatMonth`, `toInitials`, and the `kind` from level, which is settled once in the entity rather than guessed in the view. Each has focused tests named after the spec criteria.
- **`entities/clients/api/*`**: `fetchClients` (validate the parsed body, then throw a typed error), `readDevSwitches` (the build-time gate is the `import.meta.env.DEV` branch itself), and `buildClientsUrl`. The filename is odd for a documented reason: the Vite module URL collides with the e2e route glob (`build-clients-url.ts:7-10`, `001/tasks.md:34`). Don't rename it.
- **`entities/clients/queries/clients-query.ts`**: `queryOptions` plus a thin hook, with the switches in the key. It is correct and minimal. F3 option 1 only changes the hook's argument.
- **`dashboard-page.tsx` structure**: the persistent live region outside `aria-busy`, the same `Card` shells in both loading and loaded states (no layout shift, 001 FR3-AC2), and focus moving to the heading on Retry (D-11). All of these are spec-driven. F4 only moves logic into a hook; it doesn't change behaviour.
- **The API as a whole**:
  - The controller is 16 lines, and the service has a seam for Phase 2.
  - `ClientsRepository` is a `type` behind a symbol, with the data path injectable for tests.
  - `DevSwitchesInterceptor` is bound to `ClientsController` only, so health stays instant (001 FR2), and `clampDelay` is pure.
  - In `consistency.ts`, `findDiscrepancies`, `formatDiscrepancy` and `countNodes` are pure, and `reportDiscrepancies` takes its logger as a parameter. Returning the list is used only by tests, but it's a harmless and natural return value.
  - `HealthModule` is used by `scripts/smoke.mjs:55` and `test/health.e2e-spec.ts`.
- **No `features/` layer**: that is the correct outcome of §6's "only if it earns its keep".

## Commands used
- `find apps/web/src/entities apps/web/src/features apps/web/src/pages apps/api/src -type f | xargs wc -l`: file list; `features/` is absent.
- `cat -n` of every non-test source file in the slice; `grep -n "describe(\|it("` over every test file.
- `grep -rln "\b<symbol>\b" src e2e` for each export of `entities/clients/index.ts`: consumer map (F1, F6).
- `grep -rn "readDevSwitches\|useClientsQuery" widgets/…`: the three call sites (F3).
- `grep -rn isProduction apps/api …` (src, test, scripts): only the definition and one spec fixture (F5).
- `grep -n header table-card-skeleton.module.css`: no `.header` class (F2).
- `grep -rnw interface apps/api/src apps/web/src/entities apps/web/src/pages`: none.
- Spec cross-checks: `001/technical-considerations.md:119`, `002/technical-considerations.md:87`, `003/technical-considerations.md:134`, `002/functional-spec.md:147`, `001/tasks.md:34`, `003/tasks.md:30`.

---
_consult: react-frontend · perms: auto · model: default · 2026-09-23T18:43:21+02:00_
