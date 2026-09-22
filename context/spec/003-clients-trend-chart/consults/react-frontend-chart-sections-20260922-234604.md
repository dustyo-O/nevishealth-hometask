# react-frontend consult: chart sections (spec 003)

**How the answers were measured.** I built a throwaway prototype outside the repo, in `…/scratchpad/proto/`. It used `react@19.3.0`, `react-dom@19.3.0` and `recharts@3.10.1`, the current `latest` according to `npm view recharts dist-tags` (`latest: 3.10.1`, `canary: 3.11.0-canary.4`). I bundled it with esbuild 0.28.2 (production `NODE_ENV`), served it on `localhost:8765`, and fed it the twelve real months from the brief. The Inter Variable woff2 was copied from the repo's `@fontsource-variable/inter` so label widths match the app.

The Playwright MCP could not be used: it returned `Browser is already in use for …/mcp-chrome-16b7e22`, so another session holds it. Instead I drove the same Chromium with `playwright@1.63.0`, installed in the scratch dir; the repo's version is also 1.63.0. Each result below names the script that produced it. All scripts are in `scratchpad/proto/`, and screenshots are there too, not in `docs/screenshots/`, because this consult may write no repo files.

The prototype has three setups:
- **stock:** Recharts' own `accessibilityLayer` with a default `<Tooltip/>` (`?s=stock`).
- **proposal:** my recommended structure (`?s=proposal&rc=1&ctl=full&nofocus=1`).
- **narrow:** layout and label variants (`?s=narrow…`).

Nothing in the repo was modified, and Recharts was not installed in it.

---

## Q1: the axis (FR2, R1)

**The default fails FR2 for this data.** `q1.mjs` renders a 600×320 stacked `BarChart` with a bare `<YAxis/>` and reads `.recharts-yAxis-tick-labels text`:

| data max | default `<YAxis/>` labels |
|---|---|
| **350 (the real data)** | **0, 90, 180, 270, 360** |
| 400 | 0, 100, 200, 300, 400 (the tallest bar's top y = 5.0 = the top gridline's y, so it **touches the ceiling**) |
| 420 | 0, 150, 300, 450, 600 |
| 1234 | 0, 350, 700, 1050, 1400 |

R1 is real. Recharts' nice-tick algorithm (`tickCount` 5) picks a step of 90 for a max of 350. The design's 0–400 axis is lost. `shot-stock-escape-tint-left.png` shows the 0/90/…/360 axis as rendered.

**Variants measured (max 350 / 400 / 420):**

| props | 350 | 400 | 420 |
|---|---|---|---|
| `domain={[0, m => top(m)]}` | 0…400 ✓ | 0,150,300,500 ✗ | 0,150,300,500 ✗ |
| `domain` fn + `tickCount={n}` | ✓ | 0…500 ✓ | 0…500 ✓ |
| `ticks={t}` only | ✓ | 0…500 ✓ | 0…500 ✓ |
| `ticks={t}` + `domain={[0,'dataMax']}` | ✓ labels, but gridlines drawn **above** the plot (grid top y = −35) ✗ | ✗ | ✗ |
| **`ticks={t}` + `domain={[0, t.at(-1)]}` + `interval={0}`** | **0,100,200,300,400** | **0,100,…,500** | **0,100,…,500** |

`top(m) = (floor(m/100)+1)*100` and `t = [0, 100, …, top]`. Both are computed from the series, so nothing is hardcoded.

**Recommended props (verified):**

```tsx
const { ticks, top } = yScale(series); // pure: step 100, top = first step strictly above max
<YAxis ticks={ticks} domain={[0, top]} interval={0} allowDecimals={false} width={32}
       tickLine={false} axisLine={false} />
```

- **Why `interval={0}`:** with max 1234, `ticks` alone rendered `100,300,…,1300`. The default `interval="preserveEnd"` silently dropped 0 and every other tick for collision. With `interval={0}` all fourteen render: `0,100,…,1300`.
- **The first step strictly above the max:** at max = 400 the top becomes 500 and no bar touches the ceiling. FR2 needs this, and the domain-function variant got it wrong (0,150,300,500).
- **Adaptive proof:** raising Jan 2025 to 420 (existing 394) renders `0,100,200,300,400,500`, and the tallest bar's top (y 49.8) sits below the top gridline (y 5.0).

`yScale` is a pure function; see Q6 for where it lives. It is unit-tested, not tested through Recharts.

## Q2: the accessibility layer (FR5, FR6, R2, R3)

### What stock `accessibilityLayer` does (measured, `q2.mjs`, `q2t.mjs`)

In 3.10.1, `accessibilityLayer` defaults to **true**: `CartesianChart.js:24 accessibilityLayer: true`.

- **Focusable element.** The root `<svg role="application" tabindex="0">` (`RootSurface.js:40-57`) is **one tab stop**. From a button before it, Tab lands on `svg[role=application]`, and the next Tab leaves to the button after it.
  - It also renders **twelve `<g tabindex="-1">`** (the z-index layers). They are not tab stops, but Chrome exposes each as a `group focusable=true`, and a click or tap moves focus onto one (see Q5).
- **Emitted ARIA.** Only `role="application"` on the SVG and `role="status" aria-live="assertive"` on the *default* tooltip content (`DefaultTooltipContent.js:141`). A custom `content` renderer loses even that. The legend icons get `aria-label="… legend icon"`.
- **Accessibility tree** (Playwright `ariaSnapshot` + CDP `Accessibility.getFullAXTree`):
  ```
  - application: Feb 2024 Mar 2024 … Jan 2025 0 90 180 270 360
  - status: paragraph "Nov 2024", list [ "Existing clients : 222", "New organic : 15", "New paid : 13" ]
  - list: img "Existing clients legend icon", text "Existing clients", …
  ```
  - The application **has no name of its own**. Its name is computed from its content: every month label and every axis number. With `title="…"` it becomes `application "Clients per month by channel": Feb 2024 … 360`; the loose text is still attached.
  - The tooltip has **no total**. FR4 and FR6 both require one.
  - The bars themselves are twelve unnamed `group`s plus about 36 more unnamed groups.
- **On focus.** February becomes active immediately and its tooltip and tint appear: `Tab -> {"focus":"svg[role=application]","tooltip":"visible","label":"Feb 2024","cursor":true}`.
- **Left/Right.** Arrows move one month, and **neither end wraps**: Left ×3 from Feb stays Feb, Right ×15 stays Jan 2025. Home and End are not handled.
- **Enter** toggles the tooltip.
- **Escape** hides the tooltip but **leaves the tint behind**: `Escape -> tooltip hidden, cursor:true` (see `shot-stock-escape-tint-left.png`). **This violates FR5-AC6.**
- **Leave and re-enter** does **not** reset. After Home was pressed (a no-op) and then Left ×3, the chart was on Oct. Tab out and Shift+Tab back: `tooltip hidden, label ""`, meaning **no month is shown** on arrival. The next Right shows **Nov 2024**, so Recharts resumed from the remembered index. **This violates FR5-AC2 and AC7.** The source confirms it: `keyboardEventsMiddleware.js` only seeds index 0 `if (keyboardInteraction.index == null)`, and `blurAction` keeps the index.
- **Screen reader.** The live region would say the month label and three `name : value` items, with no total and in an assertive voice. The focused application's name would also be the full string of axis labels. The stock layer therefore fails FR6-AC1, AC4 and AC5.

**Verdict: do not use Recharts' keyboard layer.** It fails FR5 in two places (Escape leaves the tint; re-entry does not reset) and FR6 in three (no total; loose axis text; no own name). There is no prop to reset its internal index.

### What to build instead (measured, `q2p_final.mjs`)

Keep Recharts as the drawing only (`accessibilityLayer={false}`) and put the semantics in plain HTML around it:

```tsx
<div className={styles.frame} ref={rootRef}>
  <div
    tabIndex={0}
    role="group"
    aria-roledescription="chart"
    aria-label="Clients per month by acquisition channel, Feb 2024 to Jan 2025"
    aria-describedby={hintId}            /* "Use Left and Right to read each month." */
    onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown}
    className={styles.plot}
  >
    <div aria-hidden="true" onMouseDown={preventFocusSteal}>   {/* the whole drawing */}
      <ResponsiveContainer …><BarChart accessibilityLayer={false} …>…</BarChart></ResponsiveContainer>
    </div>
  </div>
  <VisuallyHidden as="p" role="status">{announcement}</VisuallyHidden>   {/* polite; '' when closed */}
  <VisuallyHidden as="div"><table>…twelve rows…</table></VisuallyHidden>
</div>
```

The accessible name comes from the focus target's `aria-label`. `Card` keeps its region name "Clients chart" (D14). `aria-hidden` goes on **the wrapper around the whole Recharts output**, so the SVG, the tooltip panel and any Recharts legend are all inside it. The tooltip panel's own content is `aria-hidden` too, which is harmless inside that subtree.

Measured behaviour of this structure (Chromium, 1440 px):

```
on heading   -> focus H1, nothing shown, live ""
Tab ->       focus DIV#plot, panel "Feb 2024", tint true,
             live "Feb 2024: existing clients 221, new organic 15, new paid 14, total 250"
Right        panel "Mar 2024", live "Mar 2024: existing clients 252, new organic 8, new paid 7, total 267"
Left x2      "Feb 2024"   (clamped, no wrap)
Right x15    "Jan 2025"   (clamped, no wrap)
Escape       focus DIV#plot, tooltip hidden, tint false, live ""
Left         "Dec 2024" again, panel and tint back
Tab out      focus BUTTON#after, tooltip hidden, tint false, live ""
Shift+Tab    back on DIV#plot → "Feb 2024" again (reset)
```

The accessibility tree of the card while Feb is read:

```
- region "Clients chart":
  - group "Clients per month by acquisition channel, Feb 2024 to Jan 2025. Use Left and Right to read each month."
  - status: "Feb 2024: existing clients 221, new organic 15, new paid 14, total 250"
  - table "Clients per month by acquisition channel":
    - row "Month Existing clients New organic New paid Total" (columnheaders)
    - row "Feb 2024 221 15 14 250": rowheader "Feb 2024", cell "221", cell "15", cell "14", cell "250"
    … twelve rows …
```

- **No stray text.** No axis number or month label appears anywhere; the `group` has no text children. FR6-AC4 is met.
- **axe** (`@axe-core/playwright` 4.x, scoped to the card): **0 violations, 18 passes**. The twelve Recharts `g[tabindex=-1]` inside the `aria-hidden` subtree do not trip `aria-hidden-focus`, because they are not tabbable. The `onMouseDown` guard in Q5 is what keeps a click from focusing them.

**How "announced once" was checked, and its limit.** Each move changes exactly one live node, the `status` paragraph, and nothing else in the accessibility tree changes. The group's name is static, and the panel is inside `aria-hidden`. At the ends, Left on Feb leaves the string unchanged, so nothing new is announced. That is the right behaviour: FR5 says the outline "stays where it is". On arrival, the group name is read first and then the status fills with February: one announcement of the figures.

What I **could not** measure is VoiceOver's or NVDA's real speech. Chromium's accessibility tree is the strongest evidence available headless. The tasks need a `[User]` "Verify — device" step: VoiceOver on macOS Safari, Tab to the chart, press Right twice, and check that each month is spoken once. This is the same class of risk that amended spec 001 FR3.

**Hidden table structure (FR6-AC2):**
- `<caption>` names it.
- Header row: `th scope="col"` for Month, Existing clients, New organic, New paid, Total.
- Twelve body rows, each with `th scope="row"` for the month and four `td`s.
- Wrap it in the existing `shared/ui/visually-hidden` (as `div`), and place it **outside** the `aria-hidden` wrapper and **outside** the focus target.
- Do **not** give it `aria-hidden`: it is the second, deliberate route to the figures.

**R3 (the table's tab order).** The chart adds exactly one tab stop, and the next Tab reaches whatever follows it. In the prototype that is a stand-in button in the table card. Not measured: the real treegrid's roving `tabindex` placed after it. That belongs to the lane's RTL test ("Tab from the chart focuses the treegrid's active row") and the testing-expert's e2e test.

**Focus ring: a real bug to avoid (measured, `focusring.mjs`).** The focus target fills the card (`plotBox` equals `cardBox`: 1408×430 at 16/81.5), and `Card` has `overflow: clip`. The project's `outline: var(--focus-ring); outline-offset: 2px` is therefore **fully clipped and invisible** (`shot-focus-offset-plus2.png`), even though `:focus-visible` matches. `outline-offset: -2px` draws it (`shot-focus-offset-minus2.png`). Paint the ring inset, or as an inset `box-shadow` built from `--focus-ring-width`/`--focus-ring-color` as the treegrid does (`tree-grid.module.css:175`).

## Q3: narrow screens (FR8)

Measured by `q3.mjs`, `q3sweep.mjs`, `q3two.mjs` and `q3fin.mjs`. Layout: page padding 16, card padding 24/24/16/16, `YAxis width={32}`, 12 px Inter, `barCategoryGap` default (10 %).

| `XAxis` config @ 375 | labels rendered | overlap |
|---|---|---|
| `interval={0}` | all 12 | yes (min gap −33 px) |
| `interval={2}` | Feb, May, Aug, Nov | no, but **no Jan** |
| `interval="preserveStartEnd"` | Feb, May, Aug, Jan | no, but **no Nov** |
| `interval="preserveEnd"` | Mar, Jun, Sep, Jan | no |
| `interval="equidistantPreserveStart"` | Feb, May, Aug, Nov | no |
| `ticks={[idx 0,3,6,9,11]} interval={0}` | **Feb, May, Aug, Nov, Jan** | **yes: Nov [250.6–306.5] vs Jan [297.0–350.4], −9.5 px** |

**FR8 as written cannot be met with one-line labels at 375.** This is geometry, not a Recharts limit. Every set of five labels that includes both ends has a two-month gap somewhere (11 = 3+3+3+2), so Nov and Jan are two bands apart: 2 × 22.6 = 45 px at 375. One "Nov 2024" label is 55.9 px wide in Inter 12. The width sweep in `q3sweep.mjs` puts the one-line five-label set clear of overlap only from about **440 px** viewport (gap +1.4). A single `interval` value cannot produce the set either: `interval` accepts one number or a preserve mode, never an index list.

**What works (measured):** explicit `ticks`, `interval={0}`, and a **two-line tick** ("Nov" above "2024", a custom `tick` renderer with two `<tspan>`s):
- **At 375:** the labels are Feb 2024, May 2024, Aug 2024, Nov 2024, Jan 2025. Min gap is **+15.6 px**, **with no overlap**.
- **At 320:** min gap is +6.4 px.
- **Right-edge clipping:** Jan's second line was clipped at the SVG's right edge with `margin.right = 0`. `margin={{ right: 16 }}` fixes it (`lastLabelClipped: false`).
- Screenshot: `shot-375-final-labels.png`.

The words are the ones FR8 names, `formatMonth` output split on the space; only the line break is new. If the spec wants one line, the choices are the table's "drop Nov" (Feb, May, Aug, Jan) or smaller type. See the last section.

**Breakpoint.** In this layout, all twelve one-line labels first stop overlapping at about **780 px viewport** (gap +0.5, a plot about 676 px wide). At 600 px they overlap by 14.5 px. **D13's "~600 px, like the table" is wrong for the chart.** Switch on the chart's own width, not the viewport:
- `ResponsiveContainer`'s `onResize(width, height)` prop exists in 3.10.1 (`ResponsiveContainer.d.ts:62`).
- Threshold: full labels when the plot's band is at least about 60 px (12 × 60 + 32 ≈ 750 px of chart width); otherwise the five two-line labels.

**Plot height (FR8-AC3).** Keep the X-axis `height` constant across modes, and move the legend out of Recharts:
- With Recharts' `<Legend/>`, the plot measured **332 px at 1440 but 312 px at 375**, because the legend wraps to two lines at 375 (`shot-375-custom-oneline.png`).
- With the legend as HTML outside the chart and a fixed axis height, the plot measured **338 px at 1440 and 338 px at 375**: identical.
- Single-line versus two-line axis heights differ by 14 px (352 vs 338), so the axis height must not change with the mode.

**Other 375 measurements.** Bar width is **18 px**, or 17 px with `margin.right = 16`. All 12 bars are inside the card (last bar right edge 333 < card right 359). `document.documentElement.scrollWidth` = 375, so there is no horizontal scroll.

D12's "~24 px" bars are **not possible**: the plot is about 255–271 px wide, so a band is about 21–22.6 px *including* its gap. `barCategoryGap="8%"` would give about 20 px. "New paid" is 7–14 clients, which is 6–12 px of a 338 px plot for 400: visible.

## Q4: the container (R5)

Measured by `q4.mjs`: load at 1440, resize to 375, back to 1440, then 20 rapid alternations 375↔775 at 30 ms. Console `error`/`warning` messages, `pageerror` and `window` `error` events (where "ResizeObserver loop" errors land) were all captured.

| layout | 1440 | 375 | after 20 rapid resizes | errors |
|---|---|---|---|---|
| RC `100%/100%` in a div with **no height** | **no SVG rendered** | no SVG | no SVG | none (silent) |
| RC `100%/100%` in a `div` with `height: 430px` + padding | svg 1368×390 | 303×390 | 703×390 | none |
| RC `100%/100%` directly in the `section` (grid item, `min-height` only) | 1408×430 | 343×430 | 743×430 | none |
| RC `width="100%" height={380}` | 1408×380 | 343×380 | 743×380 | none |
| `BarChart responsive` + `style={{width:'100%',height:'100%'}}` in a 430 px box | 1368×390 | 303×390 | 703×390 | none |
| RC `100%` in a flex column (`height:430`), plot `flex:1; min-height:0` + HTML legend | 1408×382 | 343×382 | 743×382 | none |

**Findings:**
- **The zero-height collapse is real and silent** in a production build: the first row renders nothing, not even an error.
- **No ResizeObserver loop error appeared** in any layout, including the grid-item case. The CSS Grid slot did not bite, because `.chartSlot` already has `min-height`.
- **This is Chromium only;** Safari and Firefox were not tested.

**Recommended pattern:**
- The widget root owns a definite height: `height: var(--card-chart-min-h)` (430) on a flex column.
- The plot box is `flex: 1 1 auto; min-height: 0`, the HTML legend `flex: none` below it.
- Inside the plot box: `<ResponsiveContainer width="100%" height="100%">`.
- The skeleton root already sets `height: var(--card-chart-min-h)` (`chart-card-skeleton.module.css`), so loading and loaded measure the same.
- Recharts 3.10.1 also offers the `responsive` prop on `BarChart` (`types/util/types.d.ts:1284`), which avoids the wrapper element and measured the same (row 5). Either works; I would use `ResponsiveContainer` because its `onResize` gives the label-mode switch from Q3 for free.
- **Explicit width/height alone is not enough:** the width must follow the card, so something has to observe it.

**For the unit tests** (measured, `bundle/jsdom-test.mjs`, jsdom 30): jsdom has **no `ResizeObserver`**, and `ResponsiveContainer` then renders **no SVG**. `initialDimension={{ width: 600, height: 380 }}` renders `svg 600x380, bars=2`, and explicit `width`/`height` also work. Pass `initialDimension` through a prop, or stub `ResizeObserver` in `vitest.setup`, or the RTL and jest-axe chart tests will assert against an empty `div`.

## Q5: motion, pointer and touch (FR4, FR7)

### Reduced motion (FR7)

Measured by `q5rm.mjs`: Playwright context `reducedMotion`, sampling the Feb "existing" rect height every 40 ms from load.
- **`no-preference`:** 6 distinct heights (42.8 → 61.1 → 156.1 → 191.3 → 194.3 → 194.5), so the bars grow.
- **`reduce`:** 1 distinct height, 194.5 from the first frame. **No growth.**

**No prop and no hook are needed.** `Bar`'s default is `isAnimationActive: 'auto'` (`Bar.js:503`), and `JavascriptAnimate.js:39` resolves `'auto'` as `!prefersReducedMotion`. `usePrefersReducedMotion` subscribes to the media query, so unlike the table's auto-animate plugin, a live change is picked up without a reload. Leave `isAnimationActive` unset.

**"Once" (FR7-AC1).** Re-rendering with a *new array holding the same values* did not replay the animation (`q5re.mjs`: a single height, 194.5, after the re-render). It is still worth memoising `toMonthlySeries` (`useMemo` or the query's `select`) so a refetch with unchanged figures stays still by construction.

### Pointer (FR4)

- **Tint colour.** `<Tooltip cursor={{ fill: 'var(--color-row-hover)' }} />` works. Measured with the literal `rgba(20, 20, 19, 0.04)`: the cursor `rect` has `fill="rgba(20, 20, 19, 0.04)"` and spans one whole band (x 32, width 111 at 1440 for Feb; x 700 for Aug). A CSS variable in `fill` is valid in SVG presentation attributes. I did not measure the `var()` form; the literal is verified.
- **Pointer leaves the chart.** Tooltip and tint both disappear (`q5m.mjs`: `pointer off chart → tooltip hidden, tint null`).
- **Fast exits.** 120 stress trials (enter, then leave within 0–24 ms) left **nothing behind** (`q5stress.mjs`: 0/40 on each of three setups).
- **One unexplained exception.** In one early run, a tooltip stayed visible after a keyboard-to-pointer handoff. It did not reproduce in 2 reruns or in the isolating script `q5stuck2.mjs`. It happened with the *half-controlled* design (Tooltip props switching between controlled and uncontrolled), so I recommend the **fully controlled** design below, which never switches.

### Fully controlled design

One `{ index, open }` state owned by the widget:
- `Tooltip active={open} defaultIndex={index}`.
- `BarChart onMouseMove={s => s.activeTooltipIndex != null && show(+s.activeTooltipIndex)}`, `onMouseLeave={hide}`, and `onClick` the same as `onMouseMove`, for taps.
- The keyboard handlers from Q2 write the same state.
- `onBlur` → `hide`.

It is measured in `q5stuck_final.mjs`, `q5m_full.mjs` and `q2p_final.mjs`:
- Keyboard results are identical to Q2.
- Hover Aug shows Aug, and the pointer moving away hides it.
- Tab out hides it.

**Two further measured edge cases:**
- **Pointer resting on Aug while Tab arrives.** The panel shows **Aug**, but the live region says **Feb**. Recharts' internal hover index wins over `defaultIndex`. The fix is to render the panel's text from the widget's `index` rather than from Recharts' `payload`. The tint would still sit on Aug until the pointer moves; this is a low-severity edge case.
- **Focus stealing.** A click or tap on a bar **moves focus into the `aria-hidden` drawing**. `document.activeElement` became `g.recharts-zIndex-layer_300 tabindex=-1 INSIDE aria-hidden`. Recharts' layers carry `tabindex=-1`, which makes them click-focusable. `onMouseDown={e => e.preventDefault()}` on the `aria-hidden` wrapper stops it: `activeElement` stays `BODY` on click and on tap.

### Touch (FR4-AC4…6)

Measured by `q5t.mjs` and `q5t2.mjs`: `devices['iPhone 13']` with `hasTouch`, 375 px wide, using `page.touchscreen.tap`.

| step | stock `<Tooltip/>` | fully controlled + mousedown guard + outside listener |
|---|---|---|
| tap Feb | panel Feb, tint | panel Feb, tint |
| tap Aug | **replaced** by Aug | replaced by Aug |
| tap Aug's column above the bar | Aug stays | Aug stays |
| tap the heading | dismissed | dismissed |
| tap May, then tap the table card | **dismissed** | dismissed only with the listener below; **without it the panel stayed** (measured: May left visible) |

- **Why the stock tooltip "dismisses" on an outside tap.** Tapping a bar focused a Recharts `g`, and the next outside tap blurred it.
- **Once focus stealing is stopped, that route is gone.** A document `pointerdown` listener, attached only while `open`, is needed: it closes the panel when `!rootRef.current.contains(e.target)`. With it, all five steps pass.
- **The tap itself** comes from Recharts' own touch handling plus `onClick`. No custom touch code was needed.

## Q6: shape and cost

### FSD placement

```
entities/clients/model/
  monthly-series.ts        toMonthlySeries(data: ClientsData): MonthlySeries   (pure, no Recharts)
  monthly-series.test.ts
  index.ts exports         toMonthlySeries, type MonthlyPoint, type MonthlySeries
widgets/clients-chart/
  index.ts                 export { ClientsChart } from './ui/clients-chart'; export { ClientsChartSkeleton } …
  lib/y-scale.ts           yScale(series, step = 100) → { ticks, top }       (Q1, pure + tested)
  lib/month-ticks.ts       sparseMonthIndices(n) → [0, 3, 6, 9, n-1]         (Q3, pure + tested)
  lib/describe-month.ts    describeMonth(p) → "Feb 2024: existing clients 221, …, total 250"
  model/month-reader.ts    reducer: {index, open} × focus|blur|key|hover|leave|tap|outside|escape (pure + tested)
  ui/clients-chart.tsx     frame: focus target, keyboard, live region, outside listener; composes the rest
  ui/bar-plot.tsx          the only file importing 'recharts'; aria-hidden; receives series + reader state
  ui/month-panel.tsx       tooltip content (text from widget state, not Recharts payload; see Q5)
  ui/chart-legend.tsx      HTML <ul>, static (FR3), CSS-module swatches from channel tokens
  ui/chart-data-table.tsx  the visually-hidden table (FR6)
  ui/clients-chart-skeleton.tsx (+ .module.css)   moved from pages/dashboard (D15)
shared/styles/tokens.css   --color-channel-existing #b29df8, --color-channel-organic #f4beb4, --color-channel-paid #a75e6e
```

**Why these boundaries:**
- `bar-plot.tsx` quarantines Recharts, so a library swap or a Recharts quirk touches one file. It is also the only piece that needs `initialDimension` in tests.
- The reader reducer carries every FR4/FR5 rule (clamp, no wrap, Escape, reset on blur, tap replace, outside dismiss). It is testable as a pure function without the DOM, so the RTL tests only need to prove the wiring.
- The legend and the hidden table are plain React driven by the same `MonthlySeries`. That makes "the chart and the table agree" a property of one input, not of two code paths.

**The channel key: a contract observation, not a blocker.** A channel node's `id` is unique per adviser; the data holds 30 distinct channel ids. The only thing that identifies "New organic" across advisers is `name`. So `toMonthlySeries` has to group by channel **name**. D2's "sum equals the Company row" makes this safe for the served data. I would make `toMonthlySeries` generic: series in first-seen order, which matches FR1's bottom-up order. The widget maps names to colours and throws on an unknown name, rather than hardcoding three keys in the entity.

### Bundle cost

Measured locally outside the repo, in `scratchpad/bundle/`, with Vite **8.3.0**, the same major as the repo, using `vite build` defaults:

| bundle | min | gzip |
|---|---|---|
| React 19.3 + react-dom only | 219.54 kB | 68.56 kB |
| + `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer` from recharts 3.10.1 | 577.38 kB | 171.65 kB |
| **Recharts' share** | **+357.8 kB** | **+103.1 kB** (`gzip -c | wc -c`: 169 563 − 67 861 = +101.7 kB) |

It brings `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`, `victory-vendor` (d3), `decimal.js-light` and `es-toolkit` (its `package.json` dependencies). That is more than the rest of the app plus React together. R6 holds: the README should say so. Lazy-loading does not help much, because the chart is above the fold.

---

## What I would do differently

1. **FR8-AC2 (five exact one-line labels at 375) is impossible as written.** The last two labels are 45 px apart at 375 and each is about 56 px wide. Cheapest honest fix: amend the AC to "…the five labels, **each on two lines (month above year)**, and no labels overlap". That is measured: +15.6 px gap at 375 and +6.4 at 320. The alternative, keeping one line and dropping Nov (Feb, May, Aug, Jan), breaks the spec's "every third month".
2. **D13's ~600 px breakpoint is wrong for the chart.** Twelve labels collide until about 780 px viewport. The switch should follow the chart's measured width (`onResize`), and the spec should not name the table's breakpoint.
3. **D12's "~24 px bars" at 375 is impossible.** A band is 21–22.6 px including its gap; the measured bars are 17–18 px. Amend to "thinner, about 18 px".
4. **D10's "Recharts' keyboard layer" should become "a keyboard layer we own over a Recharts drawing".** The stock layer fails FR5-AC2, AC6 and AC7 and FR6-AC1, AC4 and AC5 (measured above), and it has no reset API. Owning it costs about 60 lines: reducer, handlers, one live region. FR5 and FR6 need no change. The architecture doc's "`accessibilityLayer` on" line in §1 should be amended.
5. **Legend as HTML, not `<Legend/>`.** It is the only way I measured to keep the plot the same height at 375 (FR8-AC3). It also makes FR3's "clicking changes nothing" true by construction.
6. **FR2 "equal steps of one hundred" at any scale.** It is right for this data. At a max of 1234, fourteen ticks render in about 320 px (measured, readable only because `interval={0}` forces them). I would not build more now (the spec says "if the numbers change"). A note in the README's assumptions is cheaper than a stepping rule.
7. **Add a `[User]` "Verify — device" task** for VoiceOver speech (FR6-AC3, "announced once"). Headless Chromium proves the accessibility tree, not the speech.
