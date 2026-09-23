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

The chart stays exactly what spec 003 built — company-wide, three stacked channels — and **one number is redefined**. "New organic" and "New paid" are summed from the tree as they always were; "Existing clients" becomes the company's own figure less those two, rather than the sum of recorded `Existing clients` nodes. That single change makes every bar equal the Company row using only supplied figures, and removes the need for any fourth category.

Slice 1 is merged and **part of it must now be undone**: the fourth segment, its colour token and the conditional legend/panel/table it drives all go. Its arithmetic survives — `max(0, company − Σ channels)` is exactly the amount Existing must absorb — so the pure function is kept and renamed for what it now does. That is the price of two wrong turns, and it is small only because slice 1 put the arithmetic in a pure function and fed every consumer from one series.

The second change is `minPointSize` on the bars: the newly acquired are 0–2 clients a month, under two pixels drawn to scale.

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

### 2.3 The one redefined number

`entities/clients/model/monthly-series.ts` keeps walking the tree and summing channels by name. What changes is how the widget assembles the three series it draws:

```
newOrganic[m] = Σ "New organic" in the tree          (as today)
newPaid[m]    = Σ "New paid" in the tree             (as today)
existing[m]   = company[m] − newOrganic[m] − newPaid[m]
```

**(measured)** That gives Existing `250, 266, 282, 299, 315, 331, 348, 247, 248, 248, 248, 346`, and the three sum to the Company row in all twelve months.

Slice 1's `notRecorded(series)` computed `max(0, company − Σ channels)` — which is precisely the amount Existing must absorb, since `company − organic − paid = recordedExisting + notRecorded`. Keep the function and its tests, rename it for its new job, and **delete `withNotRecorded`'s segment-adding behaviour** along with:

- `--color-channel-not-recorded` and its swatch classes,
- the `shown` flag and every conditional it drives in the legend, panel, hidden table and announcement,
- the `'Not recorded'` entry in `channels.ts` (its throw on unknown names stays — the three channel names are data again).

The floor at zero still matters: if a payload's recorded channels ever exceeded the company's figure, Existing would go negative. It is clamped at zero, and the bar is then the newly-acquired sum. This cannot happen with the supplied figures.

### 2.4 Keeping the small parts visible

`<Bar minPointSize={…}>`, as a **function** so zero stays zero: `(value) => (value > 0 ? 2 : 0)`. Recharts applies it per segment, so a 1-client segment draws at 2 px instead of 0.85 px.

The cost, which the spec states and the tests must respect: a stacked bar with two floored segments draws up to about 2 px taller than its figures warrant — under 1 % of a 250-client bar. So **assert figures exactly and drawn heights within a tolerance**; the existing pixel-reading acceptance tests need that tolerance widened, and the reason recorded beside it.

### 2.6 The amendments this spec pays for

Measured by auditing every criterion in both completed specs, not by guessing:

| Spec | What changes |
|---|---|
| **001** | The data decision it records — completing the payload — is reversed, with the reason, in its Change Log |
| **002** | **Exactly one criterion**: "Given Branch 1 is open, when the user opens Branch 2, then Branch 1 stays open" — Branch 2 no longer opens. Rewritten against a row that still has children, plus one new criterion asserting a childless branch offers nothing to open. Everything else in 002 survives untouched, including the criterion that moves the outline *to* Branch 2, which is still a row |
| **003** | **Much less than we thought.** Its chart is still company-wide with three stacked channels and a three-entry legend, so FR1, FR3, FR5, FR6 and everything about behaviour stand. Only the *figures* in its examples change — FR1-AC3, FR4-AC1 and FR6-AC1 name February as 221 / 15 / 14, which becomes 250 / 0 / 0 — plus a Change Log entry recording that Existing is now derived and that small parts have a minimum drawn height. FR1-AC4 ("August and January are the tallest at 350") still holds |
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
| R-1 | **The chart will look almost solid.** The newly acquired are 0–2 clients a month, so even floored at 2 px the bars read as one colour. That is the honest picture of this company, but it is unlike the mockup, whose data had roughly ten of each. | A `[User]` look-and-feel step. The README explains why the design's proportions cannot be reproduced from the supplied figures. |
| R-2 | **`minPointSize` makes the drawing disagree with the figures**, by up to ~2 px on a 250-client bar. | Stated in FR4 and enforced by the tests: figures asserted exactly, drawn heights within a tolerance, with the reason recorded next to the tolerance so nobody later "tightens" it. |
| R-3 | **Slice 1's segment work must be removed, not left dormant.** A dead `shown` flag and an unused token are exactly the debris a component review finds later. | Slice 3 deletes them explicitly and the gate proves nothing references them. |
| R-4 | **The derived Existing hides a data problem.** Because it is computed from the company's own figure, a payload whose recorded `Existing clients` disagreed with it would show no sign in the chart. | The consistency guard already reports that class of disagreement on boot, and this spec makes it report seven. The README states the assumption (D32) plainly. |
| R-5 | **The acceptance suite reads bars as pixels.** It was built that way deliberately in 003 so tests could not pass by agreeing with the code — and `minPointSize` now perturbs exactly what it measures. | Widen the tolerance to cover the floor, not to cover sloppiness: the figures come from the panel and the hidden table, which are exact. |
| R-6 | **The tree shrinks to 12 nodes**, so any test that assumed 44 or relied on generated advisers changes. | Audited in §2.6; the API's two log assertions and the web's shipped-data expectations. |

---

## 4. Testing Strategy

- **Unit (Vitest), no DOM:** `notRecorded` — the arithmetic, the zero floor on overshoot, and `shown` computed across the series rather than per month; `toMonthlySeries` against the real tree, where only one adviser contributes channels; the seven discrepancies pinned by path, month, expected and actual.
- **Component (RTL + jest-axe):** the legend with four entries and with three; a zero month still listing "Not recorded"; the hidden table's extra column; the announcement's extra clause.
- **End-to-end (Playwright, mocked data):** the table showing Branch 2 and Branch 3 with no control to open them, and only Anna expandable inside Branch 1; the Company row reading 301 for May above branches totalling 279, with no warning anywhere; each bar's height matching its Company row **with the remainder included**; February reading 225 / 25 / 0 / 0 = 250; the legend stable while the pointer moves.
- **The regression this spec exists to prevent:** a test that fails if the served data is ever made uniform again — assert that Branch 2 has no children and that at least one adviser has none, read from the served file. Without it, a future "tidy-up" quietly re-creates the mistake this spec corrects.
- **Gate:** `pnpm check:web` for a web lane, `pnpm check:api` for the API's assertions, `pnpm check` on the merged tree.
