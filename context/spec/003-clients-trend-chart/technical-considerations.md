# Technical Specification: Clients Trend Chart

- **Functional Specification:** `context/spec/003-clients-trend-chart/functional-spec.md`
- **Status:** Completed
- **Author(s):** Alexander Shleyko (lead); the frontend plan comes from the specialist consultation quoted throughout, `consults/react-frontend-chart-sections-20260922-234604.md`, which built a throwaway Recharts 3.10.1 prototype **outside the repo** (esbuild, served locally, driven with Playwright 1.63) and measured every claim below. Numbers here are measurements, not estimates; where something was not measured, it says so.

---

## 1. High-Level Technical Approach

One new widget, `widgets/clients-chart`, fills the upper card of the dashboard page. It is fed by the data the page already has — no API change, no new request, no change to `packages/contracts`. The tree is turned into twelve month points by a pure function in `entities/clients/model`, and the widget turns those into a drawing, a legend, a panel, a live region and a hidden table.

The one structural decision that shapes everything else: **Recharts draws, and we own the semantics.** The chart's SVG sits inside an `aria-hidden` wrapper with `accessibilityLayer={false}`; a focusable element around it carries the accessible name, the arrow keys, Escape, and a polite live region, and a visually-hidden `<table>` beside it carries all twelve months as text. This is a change from `architecture.md`'s original line, which has been amended (2026-09-23) with the measurements that forced it: Recharts' own keyboard layer fails six of this spec's criteria and offers no way to fix four of them.

The other three decisions worth stating once: the y-axis is computed by a pure function and handed to Recharts as explicit `ticks` (its own "nice" algorithm produces 0/90/180/270/360 for our data); the legend is plain HTML rather than `<Legend/>`, because Recharts' legend wraps at 375 px and steals height from the plot; and the widget owns one `{ index, open }` state that both the pointer and the keyboard write to, so there is a single source of truth for what is being read.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Where the code lives (FSD)

| Path | Responsibility |
|---|---|
| `entities/clients/model/monthly-series.ts` | `toMonthlySeries(data)` → twelve `MonthlyPoint`s. Pure, no Recharts, no DOM. |
| `widgets/clients-chart/lib/y-scale.ts` | `yScale(series)` → `{ ticks, top }`; step 100, top = first step **strictly above** the maximum (FR2). |
| ~~`widgets/clients-chart/lib/month-ticks.ts`~~ | **Never built.** It was to pick the months the narrow axis labels. FR8 was amended twice on 2026-09-23 — first to describe the stepping Recharts' own label thinning actually produces, then, on the owner's judgement of the rendered chart ("currently labels in chart on 375 are good enough"), to accept the four full labels it draws at 375 px. With nothing left to select, the file and `sparseMonthIndices` were never written. _(Recorded 2026-09-23, spec 005 chart F8: the row had outlived the amendments and sent a reader looking for a file that does not exist.)_ |
| `widgets/clients-chart/lib/describe-month.ts` | `describeMonth(point)` → "Feb 2024: existing clients 221, new organic 15, new paid 14, total 250" (FR6-AC1). |
| `widgets/clients-chart/model/month-reader.ts` | The reducer: `{ index, open }` × `focus / blur / key / hover / leave / tap / outside / escape`. Every FR4 and FR5 rule lives here, testable with no DOM. |
| `widgets/clients-chart/model/use-month-reader.ts` | `useMonthReader(series)` → `{ index, point, announcement, plotProps, drawingProps }`: runs the reducer, the key handling, the pointer handlers, the outside-pointer listener and the native `pointerleave` listener, and works out the announcement. Called only by `clients-chart.tsx` (005 chart F2). |
| `widgets/clients-chart/ui/clients-chart.tsx` | The frame: derives the two series, renders the focus target, the live region and the hidden table, and spreads `useMonthReader`'s props on the plot and the drawing; composes the rest. |
| `widgets/clients-chart/ui/bar-plot.tsx` | **The only file that imports `recharts`.** Inside the `aria-hidden` wrapper. |
| `widgets/clients-chart/ui/month-panel.tsx` | The panel's content, rendered from the widget's own state — not from Recharts' payload (see §3 R-4). |
| `widgets/clients-chart/ui/chart-legend.tsx` | Static HTML `<ul>` with token swatches (FR3). |
| `widgets/clients-chart/ui/chart-data-table.tsx` | The visually-hidden twelve-row table (FR6). |
| `widgets/clients-chart/ui/clients-chart-skeleton.tsx` | Moved from `pages/dashboard/ui/chart-card-skeleton.tsx` (D15), shape unchanged. |
| `shared/styles/tokens.css` | Three channel colours (below). |

`bar-plot.tsx` quarantines the library: a Recharts quirk or a future swap touches one file. The legend, the panel and the hidden table are all driven by the same `MonthlySeries`, so "the chart and the table agree" is a property of one input rather than of four code paths.

**The channel key is `name`, not `id`.** A channel node's `id` is unique per adviser — the payload holds 30 distinct channel ids — so the only thing identifying "New organic" across advisers is its name. `toMonthlySeries` groups by name and returns series in first-seen order, which is the bottom-up order FR1 requires. The widget maps names to colours and **throws on an unknown name** rather than silently dropping a channel; the entity stays generic.

### 2.2 New tokens

```css
--color-channel-existing: #b29df8;   /* decoded from the mockup: legend swatch and bar body agree */
--color-channel-organic:  #f4beb4;
--color-channel-paid:     #a75e6e;
```

Everything else already exists: `--color-line-dotted` is the design's grid colour, `--color-row-hover` is the tint FR4 asks for, `--card-chart-min-h: 430px` is the card height, and `--font-size-footnote` is the axis type.

### 2.3 The y-axis (FR2)

Recharts' default `<YAxis/>` **fails this spec**. Measured labels by data maximum: **350 → 0, 90, 180, 270, 360**; 400 → 0…400 with the tallest bar touching the ceiling; 420 → 0, 150, 300, 450, 600.

The verified fix keeps the axis data-driven — nothing is hardcoded:

```tsx
const { ticks, top } = yScale(series);
<YAxis ticks={ticks} domain={[0, top]} interval={0} allowDecimals={false} … />
```

`interval={0}` is required: with `ticks` alone and a maximum of 1234, Recharts silently dropped 0 and every other tick for collision, rendering 100…1300. Adaptivity was proven by raising January to 420 — the labels became 0…500 and the tallest bar's top sat below the top gridline. `yScale` is unit-tested directly; Recharts is not in that test.

### 2.4 The accessibility structure (FR5, FR6)

```tsx
<div className={styles.frame}>
  <div tabIndex={0} role="group" aria-roledescription="chart"
       aria-label="Clients per month by acquisition channel, Feb 2024 to Jan 2025"
       aria-describedby={hintId} onFocus onBlur onKeyDown>
    <div aria-hidden="true" onMouseDown={preventDefault}>   {/* the whole Recharts output */}
      <ResponsiveContainer …><BarChart accessibilityLayer={false} …/></ResponsiveContainer>
    </div>
  </div>
  <VisuallyHidden as="p" role="status">{announcement}</VisuallyHidden>
  <VisuallyHidden as="div"><table>… twelve rows …</table></VisuallyHidden>
</div>
```

- `aria-hidden` goes on the wrapper around **everything** Recharts renders, so the SVG and the panel are both inside it. The hidden table sits outside it and outside the focus target — it is the second deliberate route to the figures (FR6), so it is never hidden.
- The hidden table: `<caption>`, a header row of `th scope="col"` (Month, Existing clients, New organic, New paid, Total), then twelve rows each with `th scope="row"` for the month and four `td`s.
- `onMouseDown={e => e.preventDefault()}` on the wrapper is **load-bearing**, not a nicety: Recharts renders twelve `<g tabindex="-1">` layers, and a click or tap moves focus into them — i.e. inside the `aria-hidden` subtree. The guard keeps `activeElement` on `BODY`.
- **The focus ring sits 4 px out — corrected 2026-09-23 by slice 2's measurement.** The consult's prototype made the whole card the focus target, so its ring was clipped by `Card`'s `overflow: clip` and it recommended painting inset. In the built widget the focus stop is the **plot box**, 16/24/24 px inside the card's padding, so an outward ring is fully visible; an inset one instead ran through the axis's "400" label, whose box sits 2.7 px above the plot box and 1.1 px from its left edge. Final: `outline-offset: calc(2 * var(--focus-ring-width))`, verified whole and clear of the label at 1440 and 375. A measurement of the real thing beats a measurement of a stand-in.

Measured behaviour of this structure at 1440: Tab → panel "Feb 2024", tint on, live region "Feb 2024: existing clients 221, new organic 15, new paid 14, total 250"; Right → March; Left ×2 from February stays February; Right ×15 stays January 2025; Escape → panel and tint gone, focus kept; Tab out → cleared; Shift+Tab back → **February again**. Accessibility tree shows the group with a name of its own and **no stray axis text**; `@axe-core/playwright` scoped to the card reported **0 violations, 18 passes**.

### 2.5 Narrow screens (FR8)

Two label modes, chosen by the **chart's own measured width** via `ResponsiveContainer`'s `onResize` — not by a viewport media query, and **not at the table's ~600 px breakpoint**, which the grill assumed and the measurement disproved: twelve one-line labels only stop colliding at about **780 px of viewport** (they still overlap by 14.5 px at 600). Switch to the sparse mode when a band is narrower than about 60 px.

Sparse mode renders explicit `ticks={[0, 3, 6, 9, 11]}` with `interval={0}` — no `interval` value can produce that set, as it accepts a number or a preserve mode but never an index list. The labels are "Feb 2024", "May", "Aug", "Nov", "Jan 2025" (FR8, amended 2026-09-23): measured against the app's Inter at 12 px on the prototype's band geometry, the tightest pair (Nov → Jan 2025) clears by **+7.1 px** at 375 and stays clear to roughly 336 px. The superseded all-full-labels set overlapped by 9.5 px.

`margin={{ right: 16 }}` is required or January's label clips at the SVG's right edge.

**The plot's height must not change with the mode** (FR8-AC3): keep the `XAxis` `height` fixed across both, and keep the legend out of Recharts. Measured: with `<Legend/>` the plot was 332 px at 1440 but 312 px at 375 (the legend wraps); with an HTML legend and a fixed axis height it was **338 px at both**.

Other measurements at 375: bar width **17–18 px** (the grill's "~24 px" is not achievable — a band is 21–22.6 px including its gap), all twelve bars inside the card, `document.documentElement.scrollWidth` = 375, so no horizontal scroll. "New paid" at 7–14 clients is 6–12 px tall — thin but visible.

### 2.6 The container (R5)

The widget root is a flex column with `min-height: var(--card-chart-min-h)`. **The plot box has a fixed height of its own, `--chart-plot-h`**, and the HTML legend sits beneath it at whatever height it needs; the card is allowed to grow. _(Amended by 005 chart F6: the height is one number, `PLOT_HEIGHT` in `lib/plot-geometry.ts`, which the lift's arithmetic reads and which the chart and its skeleton hand to their stylesheets as `--plot-height`; the `--chart-plot-h` token below no longer sizes anything.)_ `<ResponsiveContainer width="100%" height="100%">` goes inside the plot box. The skeleton keeps the same two heights, so loading and loaded measure the same.

The earlier plan made the plot `flex: 1 1 auto` and the legend `flex: none`, which reads as equal-height only because our three legend entries happen to fit on one line at 375 px. A longer channel name, larger text or a 320 px screen would wrap the legend and **steal height from the plot**, breaking FR8-AC3 — the reviewer was right (F3), and a layout that holds by luck is not a layout. A fixed plot height makes the requirement true by construction, whatever the legend does. **Verify with the real legend**, not a stand-in: the plot box must measure the same height at 375 and at 1440.

Measured: a `ResponsiveContainer` in a parent with **no height renders no SVG at all, silently**, in a production build — no error, no warning. Every layout with a definite height rendered correctly at 1440 and 375 and survived 20 rapid resizes, and **no ResizeObserver loop error appeared in any of them** — the CSS Grid slot did not bite, because `.chartSlot` already carries `min-height`. Chromium only; Safari and Firefox were not tested.

### 2.7 Pointer, touch and motion (FR4, FR7)

One controlled state, `{ index, open }`, written by both input paths — the pointer, the keyboard, taps — and read by the panel, the tint and the live region alike.

**The library's `<Tooltip>` is not used at all** (amended 2026-09-23 by slice 2 and 3's measurements; this section originally specified a fully controlled `Tooltip active={open} defaultIndex={index}`). Once the tint had to be ours (tech review F1) and the panel's text had to come from our state rather than the library's payload (R-4), the component was carrying no content of its own — and it still brought its own contradicting state: `TooltipBoundingBox.js` keeps a "dismissed" flag tied to a coordinate, so Escape followed by Right at January would have stayed hidden, and it hides itself whenever its payload is empty. The panel is our own HTML inside the `aria-hidden` wrapper, positioned from `lib/plot-geometry.ts` — a pure module that also answers "which month is under this x?", tested with no DOM. It opens to the right of its column for Feb–Jul and to the left for Aug–Jan, and stays inside the card at 1440 and 375 for all twelve months.

The live region speaks **only while the chart has focus**, so a pointer sweeping the year does not announce twelve months at a screen-reader user.

- **Tint — ours, not Recharts'.** `<Tooltip cursor={{ fill: … }} />` follows Recharts' *own* active index, which the measurement showed can disagree with ours: with the pointer resting on August, Tab put the panel on August while the live region announced February. FR5-AC2 requires February's column tinted on arrival, so the cursor is turned **off** (`cursor={false}`) and the tint is drawn by us, positioned from the widget's `index`.

  The geometry is already known: the plot spans from the y-axis width (32) to the container width less `margin.right` (16), and a band is that width divided by twelve. So the tint is one absolutely-positioned element inside the plot box at `left = 32 + index × pitch`, `width = pitch`, filled with `--color-row-hover`. It sits inside the `aria-hidden` wrapper, like everything else decorative. If the lane can instead prove that Recharts' cursor follows our index in every case — including hover-then-focus — it may keep the `cursor` prop; the test below is the gate either way.

  **RED first:** hover June, then Tab to the chart, and assert the tint, the panel and the live region all say February.

- **Where a tap selects, and where it dismisses (FR4).** The rule is the **plot area**, not the widget root: a tap inside the plot lands in some month's band and selects that month, replacing the panel; a tap anywhere else — the legend, the axis labels, the card's padding, or outside the card — dismisses the panel and the tint. A document `pointerdown` listener attached **only while open** implements the second half by testing whether the target is inside the plot box.

  The earlier plan tested the *widget root*, which would have left the panel open on a tap on our own legend or padding — the reviewer was right (F2). Measured without any listener at all, tapping the table card left the panel open, so the listener is required regardless. (The stock tooltip only appeared to dismiss because tapping a bar had focused a Recharts `<g>`, and the next tap blurred it; once focus stealing is prevented that accident is gone.)

  Tests: tap the legend, tap the card's padding, tap the table card — all three dismiss; tap a band above a bar selects that month.
- **Fast pointer exits:** 120 stress trials left nothing behind.
- **Reduced motion needs no code.** `Bar`'s default `isAnimationActive: 'auto'` resolves to `!prefersReducedMotion`, and Recharts subscribes to the media query, so a live change is honoured without a reload. Measured: 6 distinct bar heights during load under `no-preference`, exactly 1 under `reduce`. Leave the prop unset.
- **"Once" (FR7-AC1):** re-rendering with a new array of the same values did not replay the animation; still, memoise `toMonthlySeries` so a refetch with unchanged figures is still by construction.

### 2.8 Page changes

`dashboard-page.tsx` renders `<ClientsChart data={data} />` _(the `data` prop since 005 app F3: the page owns the one query and hands both widgets its figures)_ in place of `<p>{formatPeriod(data.months)}</p>`, and `<ClientsChartSkeleton />` in place of `<ChartCardSkeleton />`. `formatPeriod` and its tests are deleted with it (FR9-AC3); `formatBranchCount` stays _(until 005 app F1: the table had replaced its line in 002, so nothing called it and it was deleted with its tests)_. The card keeps `label="Clients chart"`.

---

## 3. Impact and Risk Analysis

**System dependencies.** None beyond `apps/web`. No API, contract, or data change. The dashboard page's loading and error states are spec 001's and are untouched.

| # | Risk | Mitigation |
|---|---|---|
| R-1 | **Recharts adds ~103 kB gzip** (measured: React+ReactDOM 68.56 kB → 171.65 kB with the chart imports), pulling in Redux Toolkit, immer, reselect, d3 via victory-vendor, decimal.js-light and es-toolkit — more than the rest of the app plus React together. | Accepted: the brief names a charting library and Recharts was the owner's pick. Lazy-loading does not help — the chart is above the fold. **The README must state the number** (roadmap: Ship-Ready). |
| R-2 | **VoiceOver's real speech is unmeasured.** Chromium's accessibility tree is the strongest headless evidence, and it shows one live update per move, but it is not speech. This is the class of problem that already amended spec 001 FR3. | A `[User]` "Verify — device" task in `tasks.md`: VoiceOver on Safari, Tab to the chart, Right twice, confirm each month is spoken once and the total is included. |
| R-3 | **The tab order between chart and table is unproven.** The chart adds exactly one stop, but the prototype's "next element" was a stand-in button, not the real treegrid with its roving `tabindex`. | A lane test: Tab from the chart lands on the treegrid's active row (FR5-AC8), plus the e2e pass. |
| R-4 | **Pointer resting on a month while Tab arrives:** the panel shows the hovered month while the live region says February — Recharts' internal hover index beats `defaultIndex`. | **The panel _and_ the tint are both driven by the widget's own `index`** — see §2.7. FR5-AC2 requires February's column to be tinted the moment the outline arrives, so none of it may be left to Recharts' hover state. |
| R-5 | **jsdom has no `ResizeObserver`**, so `ResponsiveContainer` renders no SVG and component tests would assert against an empty `div`. | Pass `initialDimension={{ width, height }}` through a prop, or stub `ResizeObserver` in the Vitest setup. Decided in the lane; either is acceptable. |
| R-6 | **Safari and Firefox are unmeasured** for the container and the tint. Spec 002 found a WebKit-only defect in exactly this territory (`position: sticky` on `<tbody>`). | The existing opt-in WebKit Playwright project covers the chart specs too. |
| R-7 | **The axis at large numbers.** "Equal steps of one hundred" renders fourteen ticks at a maximum of 1234 — legible only because `interval={0}` forces them. | Out of scope for this data; a line in the README's assumptions rather than a stepping rule. |

---

## 4. Testing Strategy

- **Unit (Vitest), no Recharts and no DOM:** `toMonthlySeries` (grouping by channel name, order, totals equal to the Company row in all twelve months); `yScale` (350 → top 400; 400 → top 500, i.e. *strictly* above; adaptivity); `describeMonth`'s exact sentence; and the `month-reader` reducer against every FR4/FR5 rule — clamping at both ends, Escape, reset on blur, tap replaces, outside dismisses.
- **Component (RTL + jest-axe):** the hidden table's twelve rows and headers; the legend's three entries; the accessible name and `aria-hidden` placement; the keyboard walk end to end. Needs the `ResizeObserver` decision from R-5.
- **End-to-end (Playwright, mocked data, its own server on 5273):** the twelve bars and their labels at 1440 and the five sparse labels at 375 with no overlap; the axis ticks 0–400; tooltip content and tint on hover, on focus, and on tap under touch emulation; the outside-tap dismissal; Escape; Tab from chart to treegrid; `prefers-reduced-motion`; plot height identical at both widths; no horizontal page scroll; `@axe-core/playwright` on the card.
- **The three regressions this review bought:** hover June then focus the chart → February's tint, panel and announcement (F1); tap the legend, and tap the card's padding → the panel dismisses (F2); the plot box measures the same height at 375 and 1440 with the real legend rendered (F3).
- **Agreement test — the one a reviewer will look for:** for each of the twelve months, the three segment values read from the rendered chart sum to the figure the treegrid shows on the Company row (FR1-AC2). It reads both cards in one page, so it cannot pass while only one of them is right.
- **Gate:** `pnpm check:web` for the lane, `pnpm check` on the merged tree.
