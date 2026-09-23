# Technical Specification: The Data As Supplied, And An Uneven Company

- **Functional Specification:** `context/spec/004-supplied-payload-non-uniform-nesting/functional-spec.md`
- **Status:** Draft
- **Author(s):** Alexander Shleyko (lead)
- **Note on method:** no specialist consultation this time, deliberately. Spec 003 needed one because Recharts' behaviour was unknown; here every fact was measured during the grill and the audit below — the payload's real shape, the seven discrepancies, the remainder series, the table needing no change, and exactly which criteria in the completed specs stop being true. The one thing no document can settle is how the chart reads once colour carries the hierarchy — five shades of one hue, side by side — and that can only be answered by building it and looking (R-1, R-8).

---

## 1. High-Level Technical Approach

Three files of data change, the chart changes what it is made of, and one piece of state moves out of a widget into a store. Everything else is deletion of things we should never have written, and correction of documents that now describe the wrong behaviour.

The supplied payload replaces the completed one. The API needs **no code change**: its consistency check is already pure, already warns once per discrepancy, already logs a count, and already serves the data regardless — it simply has something real to report for the first time. Only its assertions move.

The table needs **no change**, measured: served the real payload it already renders every childless node as a row that does not open.

The chart is the whole of the work, and its model changed after slice 1 (spec Change Log, 2026-09-23). It no longer stacks acquisition channels: it divides the company by **exactly the rows the table is displaying**, so opening a row splits its slice in the chart as it reveals children in the table. That makes "which rows are open" shared state, which is the one architectural change here — a Zustand store in `features/expand-row/`, replacing the private state the tree grid held and the "no global store" line in `architecture.md` §1, both amended.

Slice 1's remainder work carries over untouched. `withNotRecorded` already turns a series plus the node's own figure into a series whose bar equals that figure, flooring at zero and falling back to the segment sum on overshoot. Only its **input** changes — from "every channel in the tree" to "the rows currently displayed" — and everything downstream (drawing, legend, panel, hidden table, live region) reads the one series it returns, exactly as it does today.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 The data

| Path | Change |
|---|---|
| `apps/api/src/clients/data/clients.json` | Replaced by the payload exactly as the brief supplies it |
| `context/inbox/data.json` | Same file, same content — it is the inbox copy of what we serve |
| `context/inbox/data.original.json` | Deleted. It was "the supplied payload" as distinct from our completed one; with the completed one gone it is a duplicate, and git history holds the variant we discarded |

`packages/contracts` needs nothing: `branches?`, `employees?` and `channels?` are already optional, and `childrenOf` already treats a missing or empty list as a leaf — the shape this spec restores is the shape the contract was written for.

**The tree shrinks from 44 nodes to 12** (Company + 3 branches + 5 advisers + 3 channels), which changes two log assertions (§2.2).

### 2.2 The API — assertions only

`findDiscrepancies` is pure, exact on integers, and depth-first over `childrenOf`; `reportConsistency` warns one line per discrepancy and logs the count, then the data is served either way. None of that changes. What changes:

- `apps/api/scripts/smoke.mjs` asserts `0 discrepancies` in the boot log. It becomes an assertion that the guard reports **exactly seven**, and the summary line it prints changes with it. This is a better test than the one it replaces: it proves the guard fires rather than proving it stays quiet.
- `src/clients/consistency.spec.ts` asserts `Checked 44 nodes`. That becomes 12.
- A test that pins the seven — each path, month, expected and actual — so a later data edit cannot silently change what we claim about the supplied figures. The seven: Company May (301 vs 279), Branch 1 Aug (214 vs 216), Anna May (31 vs 30), Jun (32 vs 33), Jul (34 vs 35), Aug (38 vs 36), Sep (27 vs 28).

### 2.3 The shared store, and what the chart is given

**`features/expand-row/model/store.ts`** — a Zustand store holding the open row ids and a `toggle`. It is the only thing the two widgets share, and it is a feature slice because opening a row is a user interaction, not a fact about clients. Both widgets subscribe with selectors so a toggle re-renders only what changed.

The tree grid stops owning expansion privately. Its hook keeps the keyboard cursor, the roving `tabindex` and everything else that is genuinely its own; only the open-ids move out. **This is a change to spec 002's widget boundary** and is the kind of seam the Component Review item exists to find — it is being made deliberately and early rather than discovered later.

**`entities/clients/model/visible-breakdown.ts`** — `visibleBreakdown(company, openIds)` → the rows the table is displaying at their deepest open level, in table order, each with its twelve figures and its branch ancestry. Pure, no DOM, no store: it takes the ids as an argument so it can be tested as a function of data. It is the same walk the table's `flattenVisibleRows` already does, stopping at rows that are not open rather than emitting them all — worth checking whether the two can share one traversal rather than drifting apart.

**(measured)** It returns 3 rows at load, 7 with Branch 1 open, 9 with Anna open; 9 is this data's maximum.

The chart then builds `withNotRecorded(seriesOf(visibleBreakdown(...)))` exactly as it builds its series today. The remainder is `max(0, company − Σ visible rows)`: **(measured)** 22 in May at load, and on overshoot — August with Branch 1 open, where the rows come to 352 against 350 — no slice and a bar of 352, which is the fallback slice 1 already built and tested.

### 2.4 The palette — colour carries the hierarchy

Three base colours already exist as tokens (the design's purple, salmon and plum). Each **branch** takes one by its position; every row inside that branch is a **shade of its branch's colour**, derived from depth and position within the level — so Branch 1's five advisers are five purples and Anna's three channels are three purples, all recognisably Branch 1's.

Derive the shades rather than hand-listing them: this data needs at most five in one level, but the rule must not break on a branch with more children. A lightness ramp over the base colour in `oklch` keeps perceived steps even, which a naive `color-mix` towards white does not.

`--color-channel-not-recorded` stays exactly as slice 1 built it — `color-mix(in srgb, var(--color-text) 12%, var(--color-surface))` — and is never a shade of a branch.

`model/channels.ts` maps a *name* to a token and throws on anything unknown. That model no longer fits: the slices are now rows, not channels, and their names are data. It is replaced by a function from a row's ancestry and position to a colour; the throw goes with it, because an unknown row name is now normal.

**Contrast is a real risk (R-8).** Five shades of one hue, side by side, must stay distinguishable — including for a colour-blind reader. The lane checks this in a browser against the card and reports what it measured; if five shades cannot be told apart, say so rather than shipping a bar nobody can read.

### 2.5 The chart, the legend, the panel, the hidden table

All four already read one series and follow one flag — slice 1 proved it by changing none of `bar-plot.tsx` while adding a fourth segment. They keep doing exactly that; what changes is how many members the series has and how often it changes.

- **The not-recorded slice stays at the base**, with the visible rows above it in table order, so the chart reads top-to-bottom the way the table does.
- **The legend** lists every slice, wrapping onto further lines; the card grows and **the plot's fixed height is untouched** (spec 003's `--chart-plot-h`), which is what keeps FR5's "the plot is the same height as before" true when the legend goes to three lines.
- **The panel and the hidden table** gain rows and columns with the series. At nine slices the hidden table is eleven columns — heavy, but it is the data.
- **The bar's height never changes while drilling**, so the axis is computed from the company's figures and does not move (FR3). Do not recompute the domain from the visible rows.

### 2.6 The amendments this spec pays for

Measured by auditing every criterion in both completed specs, not by guessing:

| Spec | What changes |
|---|---|
| **001** | The data decision it records — completing the payload — is reversed, with the reason, in its Change Log |
| **002** | **Exactly one criterion**: "Given Branch 1 is open, when the user opens Branch 2, then Branch 1 stays open" — Branch 2 no longer opens. Rewritten against a row that still has children, plus one new criterion asserting a childless branch offers nothing to open. Everything else in 002 survives untouched, including the criterion that moves the outline *to* Branch 2, which is still a row |
| **003** | **Its chart-composition requirements are superseded by this spec, not edited into it.** 003 FR1 (what a bar is divided into), FR3 (the legend's three fixed entries) and FR6-AC2 (the hidden table's columns) are replaced by 004 FR3–FR7; its Change Log records the supersession and why. Everything else in 003 survives **untouched and still true**, because it describes the chart's *behaviour* rather than its contents: the scale (FR2), pointing and tapping (FR4), the keyboard model (FR5), the announcement's shape (FR6), motion (FR7), narrow screens (FR8) and the loading and failure states (FR9). Splitting it this way avoids two documents both claiming to define what the bars are made of |
| **product-definition.md** | §4's "we completed the data rather than change the chart" reverses |
| **architecture.md** | §2's consistency invariant no longer claims every parent equals its children |

Each spec keeps its `Completed` status; the Change Log is what records the amendment, as it did for 002's three earlier ones.

### 2.7 Tests and fixtures

- `apps/web/src/test/fixtures/shipped-clients.ts` reads the served file through `?raw`, so it follows the data automatically — but every expectation derived from the completed tree changes with it.
- The e2e double (`e2e/support/clients-double.ts`) builds its own tree; it gains a non-uniform shape so the acceptance tests exercise leaves rather than only the shipped data.
- **Do not count bar segments.** Spec 003's tests assert 36 rectangles; with the real figures New organic and New paid are 0 in some months and a zero-height rectangle may not be rendered at all (measured: the real payload drew 31, not 36). Assert per month and per series by colour and value instead — which is also what the agreement test needs.

---

## 3. Impact and Risk Analysis

**System dependencies.** `apps/web` and the API's assertions. No contract change, no new dependency, no change to the table, the keyboard model, or the loading and failure states.

| # | Risk | Mitigation |
|---|---|---|
| R-1 | **The chart will not look like the mockup any more** — the legend names rows rather than channels, and at depth it carries nine entries over several lines. This is a visual judgement no test can make. | A `[User]` look-and-feel step before the spec is verified, with the chart in a browser at both widths and at three depths. |
| R-7 | **The announcement gets long.** At nine slices the live region reads nine figures and a total for every month the user moves to. Consistent with what a sighted user sees, but possibly tiring. | Build it consistently first, then judge it on a device; the `[User]` VoiceOver step is where that lands. Shortening it is a change to spec 003's FR6 shape and needs its own decision. |
| R-8 | **Five shades of one hue must stay distinguishable**, side by side and for a colour-blind reader. A unit test cannot assert this. | The palette task checks it in a browser and reports measured contrast between adjacent shades; if five cannot be told apart, the lane says so rather than shipping an unreadable bar. |
| R-9 | **The drawing now re-renders whenever a row opens.** Spec 003 measured that it does *not* re-render on hover — a guarantee that exists because a re-render under the pointer once cost a stuck panel (003 slice 3). That guarantee must survive a series that changes identity on expand. | Keep the memo boundary on `BarPlot` and derive the series above it; the existing fast-hover stress test stays as the regression, and the lane re-runs it after the change. |
| R-2 | **Segment counting breaks.** Zero-valued channels may draw no rectangle, so any test asserting a fixed number of segments is unreliable with the real data. | §2.7: assert per month and per series, by colour and value. Rewrite spec 003's affected assertions rather than patching the counts. |
| R-3 | **The agreement test must include the remainder**, or it will pass while the chart disagrees with the table by 90%. | It is the one test a reviewer will look at: bar total = Company row, with the remainder counted in. |
| R-4 | **The axis.** The company's maximum is still 350, so the scale should return to 0–400 — but that is a consequence of the numbers, not a guarantee. | Spec 003's swept label test and the axis assertions must be re-run, not assumed. |
| R-5 | **The four advisers lose their avatars' purpose?** No — they keep their initials; only their expandability changes. Listed because it looks like a regression in a screenshot diff and is not. | Nothing to do; noted so a reviewer does not chase it. |
| R-6 | **The README's story.** The most valuable output of this spec is the honest account of the reversal, and it is written in a different roadmap item. | Ship-Ready quotes this spec's overview and the seven discrepancies; the spec exists so that account is accurate rather than remembered. |

---

## 4. Testing Strategy

- **Unit (Vitest), no DOM:** `notRecorded` — the arithmetic, the zero floor on overshoot, and `shown` computed across the series rather than per month; `toMonthlySeries` against the real tree, where only one adviser contributes channels; the seven discrepancies pinned by path, month, expected and actual.
- **Component (RTL + jest-axe):** the legend with four entries and with three; a zero month still listing "Not recorded"; the hidden table's extra column; the announcement's extra clause.
- **End-to-end (Playwright, mocked data):** the table showing Branch 2 and Branch 3 with no control to open them, and only Anna expandable inside Branch 1; the Company row reading 301 for May above branches totalling 279, with no warning anywhere; each bar's height matching its Company row **with the remainder included**; February reading 225 / 25 / 0 / 0 = 250; the legend stable while the pointer moves.
- **The regression this spec exists to prevent:** a test that fails if the served data is ever made uniform again — assert that Branch 2 has no children and that at least one adviser has none, read from the served file. Without it, a future "tidy-up" quietly re-creates the mistake this spec corrects.
- **Gate:** `pnpm check:web` for a web lane, `pnpm check:api` for the API's assertions, `pnpm check` on the merged tree.
