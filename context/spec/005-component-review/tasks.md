# Tasks — 005 Component Review

The last roadmap item before the work is sent. **No functional change anywhere**: every acceptance criterion in specs 001–004 must still pass, unedited, at the end of this. If a change would alter behaviour, it is the wrong change.

Four reviewers read the codebase in parallel and reported 29 findings; the reports are the contract for this work and are quoted by id in every task:

- `context/inbox/consults/react-frontend-component-review-shared-20260923-184320.md`
- `context/inbox/consults/react-frontend-component-review-table-20260923-184320.md`
- `context/inbox/consults/react-frontend-component-review-chart-20260923-184321.md`
- `context/inbox/consults/react-frontend-component-review-app-20260923-184321.md`

## Standing rules

- **Read your slice's report first**, in full. Each finding names files and lines, says what a reader struggles with, and estimates the cost. Where a finding proposes a seam, take the seam it proposes unless you can say why a better one exists.
- **Behaviour does not change.** The gate is the proof: every existing test must pass **unedited**, except where a task explicitly says a test is wrong. If you find yourself editing a test to make it pass, stop and report it.
- `type` aliases over `interface`. FSD import direction downward only. `recharts` stays imported in one file.
- Where a finding contradicts a spec or tech doc, **the document is amended in the same commit** — never silently diverged from. Say so in your ledger note.
- Gate before you finish: `pnpm check:web` (or `pnpm check` for the API lane). Not green → `PARTIAL` with the failure quoted.
- Every finished sub-task ends with `_(Done <date>: what actually happened, incl. surprises)_`.

---

- [ ] **Slice 1: The two big extractions, and the dead weight around them**

  > Two lanes, no shared files: one works only inside `shared/`, the other only inside `widgets/clients-chart/`.
  - [ ] **shared F1 — split `useTreeGrid` (220 lines, five jobs).** Per the report's seam: `useRevealOnOpen(ids, rows, expandedIds)` returning `markOpening(id)` takes lines 129-149 plus the `openingRef` line in `toggle`; `useFocusCursor(ids, cursor, rows, hasMovedRef)` takes 95-124. Cursor, keys and focus-follow stay, about 90 lines. **The layout-effect order is load-bearing** — focus-scroll must still run before reveal-scroll, so call the extracted hooks in that order. Also extract `useRowMotion(ref)` next to `row-motion.ts` so `TreeGrid` is markup (report's second bullet). Re-run the **WebKit** e2e afterwards, not only Chromium. **[Lane: shared]** **[Agent: react-frontend]**
  - [ ] **shared F3 — the comments are a changelog.** Keep every rule and every decision id (`D-7`, `D-15a`, the WebKit `tbody { position: sticky }` note — that one must survive in some form or the next person reverts it). Move the dated measurement stories into the owning spec's `tasks.md`, where the ledger already keeps them. Named in the report: `use-tree-grid.ts:108-118`, `tree-grid.tsx`, `row-motion.ts:46-60`, `tree-grid.module.css:64-73` and `:83-90`, `tree-grid-row.tsx:20-28`. **[Lane: shared]** **[Agent: react-frontend]**
  - [ ] **shared F4, F6, F7, F9 — the free wins.** Drop the dead `_expandedIds` parameter from `reduceKey` and its call site **and amend spec 002's tech doc §2.1 lines 54-55**, which already diverges from the code in two other ways (the report lists them). Trim `shared/ui/tree-grid/index.ts` and `shared/api/index.ts` to what is imported outside the slice — the report names every unused export. Delete the tautological test at `shared/api/query-client.test.ts:27-30`. Fix the two cosmetic inaccuracies in `avatar` (`hue.ts:3` says unsigned but folds a signed Int32; `avatar.module.css:15` says 20 px where the default is 24). **[Lane: shared]** **[Agent: react-frontend]**
  - [ ] **chart F1 — the refetch test has guarded nothing since 004.** `ui/clients-chart-refetch.test.tsx:11-16` mocks `BarPlot` as `({ series })`, but the prop has been `drawing: DrawnSeries` since commit `8c39d46`, so `series` is always `undefined` and the assertion is true whatever the widget does — **FR7-AC1 is unguarded**. Read `drawing` in the mock, **type the mock against the real component** (`ComponentProps<typeof import('./bar-plot').BarPlot>`) so the next rename fails to compile, prove it RED by dropping the `useMemo` at `clients-chart.tsx:106`, and correct the stale doc comment. **[Lane: chart]** **[Agent: react-frontend]**
  - [ ] **chart F2 — extract `useMonthReader` from the 239-line frame.** Lines 107-171 plus the announcement become a hook in `model/`, returning `{ index, open, announcement }`, `plotProps` and `drawingProps`. Fold `focused` into the reducer if it comes out cleanly — it already receives `focus` and `blur`. **The listener lifetimes are the risk**: the native `pointerleave` exists because Chromium sends no `pointerout` when the node is replaced, and the document `pointerdown` listener is attached only while open. Keep both, and keep the fast-hover stress test green. Fix the `drawing` shadowing at line 132, and delete the `drawn` flag and the `return null` it protects — the page mounts the widget only when data is present. **Add the hook to 003 §2.1's table in the same commit.** **[Lane: chart]** **[Agent: react-frontend]**
  - [ ] **chart F3, F4, F5, F6 — the rest of the slice.** `initialDimension` is a public prop only tests pass: hide it behind a test-only path or document why it must stay. De-duplicate the channel swatch. Delete the two parameters no caller and no test uses. Make the plot height one number rather than two. **[Lane: chart]** **[Agent: react-frontend]**
  - [ ] Verify — browser: the table and the chart behave exactly as before at 1440 and 375 — open and close rows, arrow through rows and figures, hover and tap a month, check the panel and the hidden table. Nothing in this slice is allowed to change what the user sees. Delete the check's artifacts. **[Lane: shared]** **[Agent: react-frontend]**
  - [ ] Merge both lanes, run `pnpm check` **and** the WebKit pass, push, record ledger notes, `swarm.sh clean 005`. **[Lead]**

- [ ] **Slice 2: The boundaries between the page, the widgets and the data**

  > One lane: every finding here touches `clients-table.tsx`, the dashboard page, or both, so splitting it would collide.
  - [ ] **table F1 + app F3 — the widget fetches data the page already fetched.** `clients-table.tsx` runs its own query, so it holds two components and a guard that exists only because of that fetch; and "read the switches, then query" is written three times across the page and the widgets. Give the page the data once and pass it down, so each widget takes what it renders. Check spec 001's FR3/FR4 criteria still hold — the loading and failure states are the page's, and must stay the page's. **[Agent: react-frontend]**
  - [ ] **app F2 — the two skeletons live in different layers.** The chart's skeleton moved into its widget in 004; the table's is still in `pages/dashboard`. Move it to `widgets/clients-table` so the two read the same way. **[Agent: react-frontend]**
  - [ ] **app F4 — the page renders and runs a timer state machine inline.** Lift it into a named hook that can be read and tested on its own, per the roadmap item. Spec 001's announcement timing (the 1 s delay that VoiceOver proved necessary) must not change; its tests are the proof. **[Agent: react-frontend]**
  - [ ] **shared F2 — the boundary leaks in CSS token names and comments.** `shared/ui/tree-grid` takes its column widths from app-global `--table-*` tokens, and the word "months" appears 20 times in the "generic" layer. Rename to grid-scoped custom properties with fallbacks (`--tree-grid-col-min-w`, `--tree-grid-name-col-w`, …), have the widget or `tokens.css` set them from the Figma values, and say "columns"/"figures" in the comments. `clients-table.module.css:63` reads `--table-name-col-w` and must follow the rename. The README claims this boundary, so closing it matters. **[Agent: react-frontend]**
  - [ ] **shared F5 + F8 + table F5 — the grid's wiring.** Have `gridProps` carry `{ id, columnCount, onKeyDown, onFocus }` so the widget stops passing the same id and column count twice to two places that each rebuild the ids independently — today a mismatch throws nothing, focus just stops moving. Rename `TreeGrid.ColumnHeader`'s boolean `name` prop, which reads like a prop missing its value. **[Agent: react-frontend]**
  - [ ] **table F3 + F4 — the tests.** They find elements by CSS-module class-name substrings, which breaks on any rename, and the 500-line file repeats the same three-line setup in every test. Replace the class-name lookups with role- or text-based queries, and lift the repeated setup. These are the widget's own tests; behaviour assertions must not change. **[Agent: react-frontend]**
  - [ ] Verify — browser: the dashboard behaves exactly as before at 1440 and 375, including the loading, failed and retry states and the `?delay=` / `?fail=1` switches. Delete the check's artifacts. **[Agent: react-frontend]**
  - [ ] Merge the lane, run `pnpm check`, push, record ledger notes, `swarm.sh clean 005`. **[Lead]**

- [ ] **Slice 3: The entity and the service**

  > Small and self-contained; it runs alongside nothing else because slice 2 touches the page that consumes these.
  - [ ] **app F1 + F6 + F7 — the entity.** `formatBranchCount` survives only because of its own test: delete both. Trim `entities/clients`'s public API to what its consumers import. The entity imports a type from `shared/ui`; record whether that is acceptable under FSD (it is a lower layer, so it is legal) or whether the type belongs elsewhere — a note is enough if the answer is "legal". **[Agent: react-frontend]**
  - [ ] **app F5 — `ApiConfig.isProduction` is never read.** Delete it and whatever exists only to populate it. **[Agent: nest-backend]**
  - [ ] Merge, run `pnpm check`, push, record ledger notes, `swarm.sh clean 005`. **[Lead]**

- [ ] **Slice 4: A second opinion on the component APIs**

  > The roadmap item's own last bullet: the cross-vendor reviewer reads the **public surface** of every slice — the props, the exports, the boundaries — rather than the diff.
  - [ ] Run `bin/harness/second-opinion.sh code 005 main`, triage every finding in writing, and put whatever is not worth doing now into the README's "what we would do next". **[Lead]**
