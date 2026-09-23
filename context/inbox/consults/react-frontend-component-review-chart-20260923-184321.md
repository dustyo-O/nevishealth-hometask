# Component Review — `widgets/clients-chart` (react-frontend)

## Verdict

The slice is in good shape and is laid out the way 003 §2.1 asks. Recharts is imported by one file only (`bar-plot.tsx`). Every FR4/FR5 rule sits in one pure reducer (`model/month-reader.ts`). The drawn series and the read series are different types, so neither can be passed where the other belongs. The legend, the panel, the hidden table and the announcement are small presentational components, each fed from the same `MonthlySeries`. There is no `interface`, `any` or `@ts-` anywhere in the slice.

There are three problems a reviewer would notice:

1. **One test passes without testing anything.** `clients-chart-refetch.test.tsx` has been vacuous since 004 renamed `BarPlot`'s prop.
2. **The frame component is 239 lines.** About 65 of them are stateful interaction logic that belongs in a named hook.
3. **The public API has a prop that only tests use** (`initialDimension`).

The rest is small: a duplicated swatch, two parameters nobody passes, a magic number kept in two places, and one table row in the tech doc that points at a file that no longer exists.

## Findings, most noticeable first

### F1 — The refetch test has been vacuous since 004 s4. Fix before sending.
- `ui/clients-chart-refetch.test.tsx:11-16` mocks `./bar-plot` as `BarPlot: ({ series }: { series: MonthlySeries }) => { drawn.push(series); … }`.
- Since commit `8c39d46` ("004 s4: lift small parts in the drawn series"), `BarPlot` takes `drawing: DrawnSeries` (`ui/bar-plot.tsx:17`), and the widget calls it as `<BarPlot drawing={drawing} initialDimension={…} />` (`ui/clients-chart.tsx:215`).
- So `series` is always `undefined` and `drawn` fills with `undefined`. That makes `expect(new Set(drawn).size).toBe(1)` (line 44) true whatever the widget memoises.
- FR7-AC1 ("the bars grow once") is therefore guarded by nothing. The `vi.mock` factory is untyped, so `tsc` could not catch the rename.
- The test's own doc comment (lines 20-23) still says "memoises `toMonthlySeries`". The widget now has two memos (`clients-chart.tsx:102-106`).
- `git log` confirms the order: the test was written in `01f28ea` (003 s5) and the prop was renamed later, in `8c39d46`.
- **Fix (5 min, no risk):**
  - Read `drawing` in the mock and push it.
  - Tie the mock's props to the real type, e.g. `(props: ComponentProps<typeof import('./bar-plot').BarPlot>)`, so the next rename fails to compile.
  - Run it RED: drop the `useMemo` on `drawing` at `clients-chart.tsx:106` and watch it fail, then restore it.
  - Update the doc comment.

### F2 — `ClientsChart` both renders and runs the interaction machine. Extract `useMonthReader`.
`ui/clients-chart.tsx:91-239` does five jobs at once:
- derives two series (102-106);
- owns the reducer plus a separate `focused` flag (107-109);
- registers a document `pointerdown` listener (116-124) and a native `pointerleave` listener (130-139);
- defines three event handlers (149-171);
- works out the announcement (144-147);
- then renders a 65-line tree.

A first-time reader has to keep in mind: two state sources (`reader` and `focused`), two imperative listeners with different lifetimes (`reader.open` and `drawn`), the touch-versus-mouse exceptions spread over three places (135, 161, and a missing one in 168), and the render. Two smaller snags make it harder:
- The effect variable `drawing` (line 132) shadows the memoised `drawing` (line 106), which is a different thing: an element, not a series.
- The `drawn` flag (130), and the `return null` at 142 that it protects, cover a state the page never produces. `dashboard-page.tsx:84` mounts `<ClientsChart />` only when `data` is present.

The seam is clean. Lines 107-171 plus the announcement can become `useMonthReader({ months, point-lookup })`, returning:
- `{ index, open, announcement }`;
- `plotProps` (`onFocus`, `onBlur`, `onKeyDown`);
- `drawingProps` (`ref`, `onPointerDown`, `onPointerMove`, `onMouseDown`).

It would live in `model/` next to the reducer. The component then reads as "derive the series, wire the reader, lay out the parts", in about 110 lines.

Optionally, fold `focused` into `MonthReader` (the reducer already receives `focus` and `blur`, `model/month-reader.ts:40-43`). Then "announce only while the outline is here" becomes one more reducer rule and can be unit-tested with no DOM.

- **Spec check:** 003 §2.1 (`technical-considerations.md:30`) gives "focus target, key handling, live region, outside-pointer listener" to `clients-chart.tsx`. A hook in the same slice, called only by that file, keeps the responsibility in the frame. The §2.1 table would need one row added. The tech doc should be updated in the same commit, not contradicted.
- **Cost:** about 1 h.
- **Risk:** moderate this late. The listener lifetimes are subtle:
  - The native `pointerleave` exists because Chromium sends no `pointerout` when the node is replaced (comment at 126-129).
  - The document listener runs only while a month is open (test at `clients-chart.test.tsx:579`).
  - Both behaviours are pinned by the 40-odd component tests in `clients-chart.test.tsx:221-600`, which exercise the widget only through the DOM. They should pass unchanged, and that is the safety net.
- If the lead wants zero risk: at least rename the shadowing variable at line 132 (1 min).

### F3 — `initialDimension` is a public prop that only tests pass.
- `ClientsChartProps` (`ui/clients-chart.tsx:38-44`) is exported from the slice's public API (`index.ts:1`) and forwarded through `BarPlot` (`bar-plot.tsx:18, 45`).
- Its own comment says "Only tests pass it". `dashboard-page.tsx:84` renders `<ClientsChart />`, and no other caller exists (grep: only `clients-chart.test.tsx:58`).
- A reviewer reading the widget's API sees a test seam where a real input would be expected.
- **The cleaner route:** stub `ResizeObserver` and the element's size in the Vitest setup, or `vi.mock` `ResponsiveContainer` in the test, and delete the prop.
- **Cost:** 1-2 h. **Risk:** moderate to high now, because the whole 845-line suite renders through this seam.
- **Recommendation:** defer, with a ticket. The comment is honest about why the prop exists. At minimum, stop exporting `type ClientsChartProps` from `index.ts:1`: nobody outside the slice imports it (checked by grep).

### F4 — The channel swatch is written twice.
- `chart-legend.module.css:24-41` and `month-panel.module.css:66-83` are byte-identical: `.swatch`, `.existing`, `.organic`, `.paid`.
- `chart-legend.tsx:20` and `month-panel.tsx:36` build the same `<span className={cx(styles.swatch, styles[channelKey(name)])} />`.
- A fourth channel or a new swatch radius means two edits.
- **Fix:** add `ui/channel-swatch.tsx` plus its module inside this widget. It should **not** go in `shared/ui`: it knows channels, and one widget uses it. Give it `aria-hidden` itself; the legend currently adds `aria-hidden` and the panel relies on its `aria-hidden` wrapper.
- **Cost:** 15 min. **Risk:** low. The legend and panel tests cover the swatches.

### F5 — Two parameters that no caller and no test uses.
- `toDrawing(series, pxPerClientOf = pxPerClientFor)` (`lib/drawn-series.ts:57`): every call passes one argument (`clients-chart.tsx:106`, `drawn-series.test.ts:71-126`).
- `yScale({ points }, step = STEP)` (`lib/y-scale.ts:19`): only `drawn-series.ts:58` and `y-scale.test.ts:18-37` call it, always with one argument.
- These are injection points kept for a flexibility nobody asked for, so a reader goes looking for the caller that needs them.
- Also exported for nobody: `Size` and `Point` (`lib/plot-geometry.ts:17-18`, used only in that file) and `ChannelKey` (`model/channels.ts:2`). A `type` export is harmless but widens the surface a reader scans.
- **Cost:** 2 min. **Risk:** none.
- **Do not remove** `existingClients` (only tests use it outside its file). 004 `technical-considerations.md` §2.3 says to "keep the function and its tests".

### F6 — The plot height is one number kept in two places.
- `PLOT_HEIGHT = 338` (`lib/plot-geometry.ts:11`) repeats `--chart-plot-h: 338px` (`shared/styles/tokens.css:83`).
- `BARS_HEIGHT` and so the 004 lift in pixels (`drawn-series.ts:32-35`) are computed from the TS copy, while the box is sized by the CSS copy.
- If the token changes, the "one client = 4 px" promise (004 FR4-AC1) drifts silently. No unit test compares the two.
- **Fix:** a comment on each side naming the other, or a small test that reads the token. **Cost:** 10 min. **Risk:** none.

### F7 — The skeleton's frame is copied by hand.
- `clients-chart-skeleton.module.css:4-10` repeats `clients-chart.module.css:4-10` rule for rule.
- The "the card measures the same while loading and loaded" guarantee (001 FR3-AC2, cited at `clients-chart-skeleton.tsx:11-12`) therefore holds only while someone keeps the copies in sync.
- **Fix:** `composes: chart from './clients-chart.module.css';` makes that structural. **Cost:** 5 min. **Risk:** low.

### F8 — The tech doc names a file that does not exist (doc drift, not code).
- 003 `technical-considerations.md:27` and `:156` list `widgets/clients-chart/lib/month-ticks.ts` / `sparseMonthIndices` and a unit test for it. No such file exists (`grep -rn sparseMonthIndices apps/web/src` returns nothing).
- The functional spec was amended twice (`functional-spec.md:188`, `:190`) to accept Recharts' own label thinning, and the tech doc's §2.1 table was never updated.
- A reviewer who maps the doc to the code will look for the file.
- **Fix:** strike the row and the test line, and point to the amendment. **Cost:** 2 min. The lead owns this, not the lane.

### Nit
- `bar-plot.tsx:21-22`: `const MARGIN = { ...PLOT_MARGIN }` copies a constant, and its comment repeats `plot-geometry.ts`. Passing `PLOT_MARGIN` directly is probably fine, because TS lets a `readonly` object stand where a mutable one is expected. I did **not** run `tsc` to confirm, so treat this as unverified.

## Boundaries that are right (leave alone)

- **Widget fetches its own data** (`clients-chart.tsx:93-94`). Architecture §6 says the chart "takes MonthlySeries", but 003 `technical-considerations.md:134` specifies `<ClientsChart />` with no props, and the table widget does the same (002 `technical-considerations.md:87`). It is spec-sanctioned, so do not change it here. The one cost is outside this slice: the page (`dashboard-page.tsx:33-35`) and each widget re-read `readDevSwitches(window.location.search)` so their query keys match. A `useClients()` in `entities/clients` that reads the switches once would remove the copies. That call belongs to the entities reviewer.
- **`bar-plot.tsx` as the only `recharts` import** (003 §2.1). It draws and nothing else, and it is memoised for a measured reason (`bar-plot.tsx:34-35`).
- **`model/month-reader.ts`**: a pure reducer, 58 lines, with every rule documented and unit-tested with no DOM (`month-reader.test.ts`). It returns the same object when nothing changes, so the live region is not rewritten.
- **`DrawnSeries` vs `MonthlySeries`** (`lib/drawn-series.ts:6-23`, `clients-chart.tsx:98-101`). Two types on purpose, so a lifted height can never be read aloud (004 FR4-AC4). This is the best boundary in the slice.
- **`lib/existing-clients.ts` in the widget, not the entity.** It is domain arithmetic, but 004 §2.3 puts it explicitly in "how the widget assembles the three series". Leave it there.
- **`lib/plot-geometry.ts`**: one piece of column arithmetic, read by the drawing, the tint (CSS vars at `clients-chart.tsx:73-80`), the panel and the pointer. Without it, the library's hover index would disagree with the widget's (tech review F1).
- **`chart-legend.tsx`, `chart-data-table.tsx`, `month-panel.tsx`, `lib/describe-month.ts`, `model/channels.ts`, `lib/y-scale.ts`**: each is under 50 lines, does one thing and takes plain props. The legend's reasons for being static HTML are written down (`chart-legend.tsx:10-15`). `channelKey` throws on an unknown name, as 003 §2.1 requires.
- **`clients-chart.test.tsx` (845 lines)** is long, but it is grouped into three `describe`s, each case is named with its FR criterion, and it goes through the DOM only. It is the net that makes F2 safe to attempt.

## How the facts were checked
- Read every file in `apps/web/src/widgets/clients-chart/` (sources, CSS modules, the refetch test in full, test names in `clients-chart.test.tsx`).
- `grep -rln "\b<export>\b" apps/web/src apps/web/e2e` for each exported symbol (usage map for F3 and F5).
- `grep -rn "\binterface\b\|: any\|as any\|@ts-"` over the slice (no hits).
- `git log --oneline -- …/clients-chart-refetch.test.tsx` and `git log -S "drawing: DrawnSeries" -- …/bar-plot.tsx` (F1 order of events: `01f28ea`, then `8c39d46`).
- Read `context/product/architecture.md` §6; `context/spec/003-clients-trend-chart/technical-considerations.md` §2.1-2.5 and `:134`, `:156`; `functional-spec.md:188-194`; 004 `technical-considerations.md` §2.3; `pages/dashboard/ui/dashboard-page.tsx:31-90`; `shared/styles/tokens.css:82-83`.
- Not run: `tsc`, Vitest (read-only brief). F1 follows from reading the code: the mock destructures a prop the caller no longer passes.

---
_consult: react-frontend · perms: auto · model: default · 2026-09-23T18:43:21+02:00_
